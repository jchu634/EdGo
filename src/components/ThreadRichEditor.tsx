import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { RaTeXView } from "ratex-react-native";
import { useUniwind } from "uniwind";

import { THREAD_EDITOR_HTML } from "@/src/lib/thread-editor-document";
import { escapeXml } from "@/src/lib/thread-composer";
import { useHighlighter } from "@/src/providers/highlightProvider";

export type ThreadEditorFormat =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "mark";
export interface ThreadRichEditorHandle {
  format: (format: ThreadEditorFormat) => void;
  flush: () => Promise<string>;
}

interface MathSlot {
  id: string;
  source: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

function parseMathSlot(value: unknown): MathSlot | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("source" in value) ||
    typeof value.source !== "string" ||
    !("top" in value) ||
    typeof value.top !== "number" ||
    !Number.isFinite(value.top) ||
    !("left" in value) ||
    typeof value.left !== "number" ||
    !Number.isFinite(value.left) ||
    !("width" in value) ||
    typeof value.width !== "number" ||
    !Number.isFinite(value.width) ||
    value.width <= 0 ||
    !("height" in value) ||
    typeof value.height !== "number" ||
    !Number.isFinite(value.height) ||
    value.height <= 0
  )
    return null;
  return {
    id: value.id,
    source: value.source,
    top: value.top,
    left: value.left,
    width: value.width,
    height: value.height,
  };
}

function NativeEquation({
  slot,
  dark,
  onHeight,
}: {
  slot: MathSlot;
  dark: boolean;
  onHeight: (height: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: slot.top,
        left: slot.left,
        width: slot.width,
        height: slot.height,
        overflow: "hidden",
        backgroundColor: dark ? "#262626" : "#f3f4f6",
      }}
    >
      {error ? (
        <Text
          style={{ color: dark ? "#f1f5f9" : "#111827" }}
          accessibilityLabel={`Equation could not be rendered: ${error}`}
        >
          {slot.source}
        </Text>
      ) : (
        <RaTeXView
          latex={slot.source.slice(0, 5000)}
          fontSize={24}
          color={dark ? "#f1f5f9" : "#111827"}
          style={{ width: slot.width, height: slot.height }}
          onContentSizeChange={(event) => {
            const height = event.nativeEvent.height;
            if (Number.isFinite(height) && height > 0) onHeight(height + 4);
          }}
          onError={(event) => setError(event.nativeEvent.error)}
        />
      )}
    </View>
  );
}

type EditorMessage =
  | { type: "ready" }
  | { type: "change"; content: string }
  | { type: "flush"; content: string; requestId: number }
  | { type: "height"; height: number }
  | { type: "math-layout"; slots: MathSlot[] }
  | { type: "error"; message: string }
  | {
      type: "decorate";
      id: string;
      kind: "code";
      source: string;
      language: string;
    };

function parseEditorMessage(raw: string): EditorMessage | null {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("type" in value)) return null;
  switch (value.type) {
    case "ready":
      return { type: "ready" };
    case "change":
      return "content" in value && typeof value.content === "string"
        ? { type: "change", content: value.content }
        : null;
    case "flush":
      return "content" in value &&
        typeof value.content === "string" &&
        "requestId" in value &&
        typeof value.requestId === "number"
        ? { type: "flush", content: value.content, requestId: value.requestId }
        : null;
    case "height":
      return "height" in value &&
        typeof value.height === "number" &&
        Number.isFinite(value.height)
        ? { type: "height", height: value.height }
        : null;
    case "error":
      return "message" in value && typeof value.message === "string"
        ? { type: "error", message: value.message }
        : null;
    case "math-layout": {
      if (!("slots" in value) || !Array.isArray(value.slots)) return null;
      const slots: MathSlot[] = [];
      for (const candidate of value.slots) {
        const slot = parseMathSlot(candidate);
        if (!slot) return null;
        slots.push(slot);
      }
      return { type: "math-layout", slots };
    }
    case "decorate":
      if (
        !("id" in value) ||
        typeof value.id !== "string" ||
        !("source" in value) ||
        typeof value.source !== "string" ||
        !("kind" in value) ||
        value.kind !== "code"
      )
        return null;
      return {
        type: "decorate",
        id: value.id,
        source: value.source,
        kind: value.kind,
        language:
          "language" in value && typeof value.language === "string"
            ? value.language
            : "txt",
      };
    default:
      return null;
  }
}

const SOURCE = { html: THREAD_EDITOR_HTML };

const ThreadRichEditor = forwardRef<
  ThreadRichEditorHandle,
  {
    content: string;
    editable: boolean;
    onChange: (content: string) => void;
    onError: (message: string) => void;
  }
>(function ThreadRichEditor({ content, editable, onChange, onError }, ref) {
  const web = useRef<WebView>(null);
  const [height, setHeight] = useState(280);
  const [mathSlots, setMathSlots] = useState<MathSlot[]>([]);
  const [ready, setReady] = useState(false);
  const lastContent = useRef(content);
  const requestId = useRef(0);
  const decorationVersion = useRef(0);
  const pending = useRef(
    new Map<
      number,
      {
        resolve: (content: string) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const { tokenize, ready: highlighterReady } = useHighlighter();
  const { theme } = useUniwind();

  function inject(method: string, ...args: (string | number | boolean)[]) {
    web.current?.injectJavaScript(
      `window.threadEditor.${method}(${args.map((value) => JSON.stringify(value)).join(",")});true;`,
    );
  }

  useEffect(() => {
    if (!ready) return;
    if (lastContent.current !== content) {
      lastContent.current = content;
      inject("setContent", content);
    }
    inject("setReadOnly", !editable);
  }, [content, editable, ready]);

  useEffect(() => {
    if (!ready) return;
    decorationVersion.current++;
    inject("setTheme", theme === "dark" ? "dark" : "light");
    inject("refreshDecorations");
  }, [ready, highlighterReady, theme]);

  useEffect(() => {
    const requests = pending.current;
    return () => {
      for (const request of requests.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("The editor was closed."));
      }
      requests.clear();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    format(format) {
      if (ready && editable) inject("format", format);
    },
    flush() {
      if (!ready)
        return Promise.reject(
          new Error("The editor is still loading. Please try again."),
        );
      return new Promise<string>((resolve, reject) => {
        const id = ++requestId.current;
        const timer = setTimeout(() => {
          pending.current.delete(id);
          reject(
            new Error("The editor did not respond. Your draft is still here."),
          );
        }, 5000);
        pending.current.set(id, { resolve, reject, timer });
        inject("flush", id);
      });
    },
  }));

  async function decorate(
    message: Extract<EditorMessage, { type: "decorate" }>,
  ) {
    const version = decorationVersion.current;
    const tokens = await tokenize(
      message.source,
      message.language,
      theme === "dark" ? "github-dark" : "github-light",
    );
    const html = `<pre><code>${tokens ? tokens.map((line) => line.map((token) => `<span style="color:${/^#[0-9a-f]{3,8}$/i.test(token.color ?? "") ? token.color : "inherit"}">${escapeXml(token.content)}</span>`).join("")).join("\n") : escapeXml(message.source)}</code></pre>`;
    if (version === decorationVersion.current)
      inject("decorate", message.id, message.source, html);
  }

  function onMessage(event: WebViewMessageEvent) {
    try {
      const message = parseEditorMessage(event.nativeEvent.data);
      if (!message) return;
      switch (message.type) {
        case "ready":
          lastContent.current = content;
          inject("setContent", content);
          inject("setReadOnly", !editable);
          setReady(true);
          break;
        case "change":
          lastContent.current = message.content;
          onChange(message.content);
          break;
        case "flush": {
          const request = pending.current.get(message.requestId);
          if (request) {
            clearTimeout(request.timer);
            pending.current.delete(message.requestId);
            request.resolve(message.content);
          }
          break;
        }
        case "math-layout":
          setMathSlots(message.slots);
          break;
        case "height":
          setHeight(Math.max(280, Math.min(20000, message.height)));
          break;
        case "error":
          onError(message.message);
          break;
        case "decorate":
          void decorate(message).catch(() => {
            /* The plain-text block remains editable if decoration fails. */
          });
          break;
      }
    } catch {
      onError("The editor sent an invalid response.");
    }
  }

  return (
    <View
      className="overflow-hidden rounded-lg border border-gray-300 dark:border-neutral-700"
      style={{ height }}
    >
      <WebView
        ref={web}
        accessibilityLabel="Editable thread preview"
        source={SOURCE}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onError={() =>
          onError("Unable to load the editor. Your draft is still here.")
        }
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank"
        }
        scrollEnabled={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
      />
      {mathSlots.map((slot) => (
        <NativeEquation
          key={`${slot.id}:${slot.source}`}
          slot={slot}
          dark={theme === "dark"}
          onHeight={(height) =>
            inject("setMathHeight", slot.id, slot.source, height)
          }
        />
      ))}
    </View>
  );
});

export default ThreadRichEditor;
