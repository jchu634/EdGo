import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
  type TextStyle,
} from "react-native";
import { PlayIcon } from "phosphor-react-native";
import { useGlobalSearchParams } from "expo-router";
import { Effect, Fiber, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import type { ThemedToken } from "@shikijs/core";
import { cn } from "cnfast";
import { useHighlighter } from "@/src/providers/highlightProvider";
import { interruptFiber } from "@/src/lib/utils";
import { getApiKey, settings } from "@/src/lib/storage";

interface CodeBlockProps {
  code: string;
  lang?: string;
  lineNumbers?: boolean;
  /** When true, renders a "Run" button beneath the code. */
  runnable?: boolean;
}

const LANG_TO_READABLE_LANG: Record<string, string> = {
  x86: "x86",
  aarch64: "AArch64",
  adb: "Ada",
  mips: "MIPS",
  sh: "Bash",
  c: "C",
  cc: "C++",
  cs: "C#",
  css: "CSS",
  dart: "Dart",
  f95: "Fortran",
  go: "Go",
  html: "HTML",
  hs: "Haskell",
  java: "Java",
  js: "JavaScript (Node)",
  jsweb: "JavaScript (Web)",
  jsx: "JSX",
  json: "JSON",
  jl: "Julia",
  karel: "Karel",
  kt: "Kotlin",
  tex: "LaTeX",
  lisp: "Lisp",
  lua: "Lua",
  mysql: "MySQL",
  nim: "Nim",
  ml: "OCaml",
  m: "Octave",
  php: "PHP",
  sql: "Postgres",
  pro: "Prolog",
  py: "Python",
  arr: "Pyret",
  r: "R",
  rkt: "Racket",
  rb: "Ruby",
  rs: "Rust",
  sage: "Sage",
  scala: "Scala",
  dl: "Soufflé",
  sqlite: "SQLite",
  svelte: "Svelte",
  swift: "Swift",
  txt: "Text",
  ts: "Typescript",
  vb: "VB",
  v: "Verilog",
  vue: "Vue",
  yaml: "Yaml",
};

// FontStyle bitmask values from vscode-textmate.
const FONT_ITALIC = 1;
const FONT_BOLD = 2;
const FONT_UNDERLINE = 4;
const FONT_STRIKETHROUGH = 8;

function decodeFontStyle(fontStyle?: number): TextStyle {
  const style: TextStyle = {};
  if (!fontStyle || fontStyle <= 0) return style;
  if (fontStyle & FONT_BOLD) style.fontWeight = "bold";
  if (fontStyle & FONT_ITALIC) style.fontStyle = "italic";
  const decorations: ("underline" | "line-through")[] = [];
  if (fontStyle & FONT_UNDERLINE) decorations.push("underline");
  if (fontStyle & FONT_STRIKETHROUGH) decorations.push("line-through");
  if (decorations.length > 0) {
    style.textDecorationLine = decorations.join(
      " ",
    ) as TextStyle["textDecorationLine"];
  }
  return style;
}

// Shared style code lines as each line is a sibling <Text>.
const CODE_LINE_CLASSNAME =
  "font-mono text-sm text-gray-800 dark:text-gray-100";

const CodeRunReceiptResponse = Schema.Struct({
  ticket: Schema.String,
});

const CodeRunResult = Schema.Struct({
  stdout: Schema.String,
  stderr: Schema.String,
  exit_code: Schema.Number, // 0 = success, 1 = error
});

const RunFrameData = Schema.Struct({
  type: Schema.String, // "stdout" | "stderr" | ...
  data: Schema.String, // base64-encoded
});

const RunExitStatus = Schema.Struct({
  type: Schema.String, // observed as "normal" even on error
  value: Schema.Number, // 0 = success, 1 = error
  wall_time: Schema.Number,
  wait_status: Schema.Number,
});

const RunExitData = Schema.Struct({
  exit_status: RunExitStatus,
});

/** Decodes a base64 string to UTF-8 text. */
function decodeB64(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function stripAnsi(value: string): string {
  // Matches common CSI ANSI escape sequences, though main target is color codes like `\x1b[35m`).
  return value.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

const langConfig = {
  x86: {
    run_command: 'bash -c "nasm main.x86 -felf64 && ld main.o && ./a.out"',
  },
  aarch64: {
    run_command:
      'bash -c "echo "" >> main.aarch64 && mv main.aarch64 main.s && aarch64-linux-gnu-gcc -Wall -static -s main.s -o main && qemu-aarch64 main"',
  },
  adb: {
    run_command: "./main",
    build_command: "gnat make main.adb",
  },
  mips: { run_command: "mipsy main.mips" },
  sh: { run_command: "bash main.sh" },
  c: {
    run_command: "./main",
    build_command: "clang -std=c11 main.c -lm -lpthread -lcs50 -o main",
  },
  cc: {
    run_command: "./main",
    build_command: "clang++ -std=c++11 main.cc -lm -lpthread -lcs50 -o main",
  },
  cs: {
    run_command: "mono main.exe",
    build_command: "mcs main.cs",
  },
  css: { run_command: "" }, // Cannot run
  dart: {
    run_command: "./main",
    build_command: "dart compile exe main.dart -o main",
  },
  f95: { run_command: "./main", build_command: "gfortran main.f95 -o main" },
  go: { run_command: "./main", build_command: "go build main.go" },
  html: { run_command: "" }, // Cannot run
  hs: { run_command: "runhaskell main.hs" },
  java: {
    file_name: "Main.java",
    run_command: "java Main",
    build_command: "javac Main.java",
  },
  js: { run_command: "node main.js" },
  jsweb: { run_command: "" }, // Cannot run
  jsx: { run_command: "" }, // Cannot run
  json: { run_command: "" }, // Cannot run
  jl: { run_command: "julia main.jl" },
  karel: { run_command: "" }, // Cannot run: Relies on Custom Local Renderer
  kt: {
    run_command: "java -jar main.jar",
    build_command: "kotlinc main.kt -include-runtime -d main.jar",
  },
  tex: {
    run_command: "true",
    build_command:
      "pdflatex -interaction=nonstopmode -file-line-error main.tex",
  },
  lisp: { run_command: "clisp main.lisp" },
  lua: { run_command: "lua main.lua" },
  mysql: { run_command: "" }, // TODO: MySQL Support (Different Code Path)
  nim: { run_command: "./main", build_command: "nim c main.nim" },
  ml: { run_command: "ocaml main.ml" },
  m: { run_command: "octave -q main.m" },
  php: { run_command: "php -f main.php" },
  sql: { run_command: "" }, // TODO: PostGres Support (Different Code Path)
  pro: { run_command: "swipl -q -s main.pro" },
  py: { run_command: 'bash -c "python3 main.py"' },
  arr: { run_command: "pyret -q main.arr" },
  r: { run_command: "Rscript main.r" },
  rkt: { run_command: "racket -f main.rkt" },
  rb: { run_command: "ruby main.rb" },
  rs: { run_command: "./main", build_command: "rustc main.rs" },
  sage: { run_command: 'bash -c "mkdir -m 0700 .sage && sage main.sage"' },
  scala: { run_command: "scala3 main.scala" },
  dl: { run_command: "./main", build_command: "souffle main.dl -o main" },
  sqlite: {
    run_command:
      'bash -c "sqlite3 /tmp/sqlite.sqlite3 -column -init schema.sql < main.sqlite"',
  },
  svelte: { run_command: "" }, // Cannot run
  swift: { run_command: "swift main.swift" },
  txt: { run_command: "" }, // Cannot run
  ts: { run_command: "node main.js", build_command: "tsc main.ts" },
  vb: { run_command: "mono main.exe", build_command: "vbnc main.vb" },
  v: { run_command: "" }, // Cannot run
  vue: { run_command: "" }, // Cannot run
  yaml: { run_command: "" }, // Cannot run
};

const getApiKeyEffect = Effect.tryPromise({
  try: () => getApiKey(),
  catch: (error) => new Error(`Failed to read API key: ${String(error)}`),
}).pipe(
  Effect.flatMap((apiKey) =>
    apiKey ? Effect.succeed(apiKey) : Effect.fail(new Error("Missing API Key")),
  ),
);

function submitCodeRun(courseId: number, code: string, lang: string) {
  return Effect.gen(function* () {
    const apiKey = yield* getApiKeyEffect;
    const client = yield* HttpClient.HttpClient;
    const config = langConfig[lang as keyof typeof langConfig];
    const fileName = "file_name" in config ? config.file_name : `main.${lang}`;

    const request = yield* HttpClientRequest.bodyJson(
      HttpClientRequest.post(
        `https://edstem.org/api/courses/${courseId}/snippets/run`,
      ).pipe(
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.acceptJson,
      ),
      {
        snippet: {
          type: "code",
          // Unnecessary part of the header
          // pty_size: {
          //   cols: ,
          //   rows: ,
          // },
          run_command: config.run_command,
          ...("build_command" in config
            ? { build_command: config.build_command }
            : {}),
          files: {
            [fileName]: code,
          },
          dump_files: true,
        },
      },
    );

    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(CodeRunReceiptResponse)(
      response,
    );
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

type MsgTypes =
  | "status_created"
  | "status_built"
  | "dump_files"
  | "run_frame"
  | "run_exit";

function streamCodeRunResult(ticket: string) {
  return Effect.tryPromise({
    try: () =>
      new Promise<Schema.Schema.Type<typeof CodeRunResult>>(
        (resolve, reject) => {
          // Ticket acts as OTP
          const socket = new WebSocket(
            `wss://sahara.${settings?.getString("user.default_region")}.edstem.org/run?ticket=${ticket}`,
          );

          let stdout = "";
          let stderr = "";
          let exitCode = 0;

          socket.onmessage = (event) => {
            let msg: { type?: MsgTypes; data?: unknown }; // Data will have several formats depending on MsgType
            try {
              msg = JSON.parse(event.data as string);
            } catch {
              console.debug("Non-JSON message ignored:");
              return;
            }
            switch (msg.type) {
              case "run_frame": {
                // data: { type: "stdout" | "stderr", data: "<base64>" }
                try {
                  const frame = Schema.decodeUnknownSync(RunFrameData)(
                    msg.data,
                  );
                  const text = decodeB64(frame.data);
                  console.log("TEXT", text);

                  if (frame.type === "stderr") stderr += text;
                  else stdout += text;
                } catch {
                  console.error(
                    "Received Malformed run_frame message: ",
                    msg.data,
                  );
                }
                return;
              }
              case "run_exit": {
                try {
                  const exit = Schema.decodeUnknownSync(RunExitData)(msg.data);
                  exitCode = exit.exit_status.value;
                } catch {
                  console.error(
                    "Received Malformed run_exit message: ",
                    msg.data,
                  );
                }

                socket.close();
                resolve(
                  Schema.decodeUnknownSync(CodeRunResult)({
                    stdout: stripAnsi(stdout),
                    stderr: stripAnsi(stderr),
                    exit_code: exitCode,
                  }),
                );
                return;
              }
              // Ignore status_created, status_built, dump_files as they are not necessary
            }
          };

          socket.onerror = (error) => {
            reject(
              error instanceof Error
                ? error
                : new Error(`Code-run websocket error: ${String(error)}`),
            );
          };
        },
      ),
    catch: (error) =>
      error instanceof Error
        ? error
        : new Error(`Code-run stream failed: ${String(error)}`),
  });
}

/** Runs code end-to-end: submit, then stream the result. */
function runCode(courseId: number, code: string, lang: string) {
  return Effect.gen(function* () {
    const { ticket } = yield* submitCodeRun(courseId, code, lang);
    return yield* streamCodeRunResult(ticket);
  });
}

function renderLine(
  line: ThemedToken[],
  lineKey: string,
  lineNumbers?: boolean,
): React.ReactNode {
  const gutter = lineNumbers ? (
    <Text className="text-gray-400 dark:text-gray-500">
      {`${parseInt(lineKey) + 1}`.padStart(3, " ") + " "}
    </Text>
  ) : null;
  if (line.length === 0) {
    // Preserve blank lines so vertical spacing stays correct.
    return (
      <Text key={lineKey} className={CODE_LINE_CLASSNAME} selectable>
        {gutter}{" "}
      </Text>
    );
  }
  return (
    <Text key={lineKey} className={CODE_LINE_CLASSNAME} selectable>
      {gutter}
      {line.map((token, i) => (
        <Text
          key={`${lineKey}-${i}`}
          style={{
            ...(token.color ? { color: token.color } : {}),
            ...decodeFontStyle(token.fontStyle),
          }}
        >
          {token.content}
        </Text>
      ))}
    </Text>
  );
}

export default function CodeBlock({
  code,
  lang,
  lineNumbers,
  runnable,
}: CodeBlockProps) {
  const { ready, error, tokenize } = useHighlighter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "github-dark" : "github-light";
  const resolvedLang = lang ?? "text";
  /*
    Karel requires a custom renderer and cannot be run directly.
    SQL dialects require a different code path
  */

  const canRun = runnable && !["karel", "mysql"].includes(resolvedLang);

  // The effect only mutates state from the async callback (never synchronously),
  // so staleness is detected during render by comparing the stored inputs.
  const [result, setResult] = useState<{
    code: string;
    lang: string;
    theme: string;
    tokens: ThemedToken[][] | null;
  } | null>(null);

  const [runResult, setRunResult] = useState<Schema.Schema.Type<
    typeof CodeRunResult
  > | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runFiberRef = useRef<Fiber.Fiber<any, any> | null>(null);

  useEffect(() => {
    if (!ready || error) return;
    const program = Effect.gen(function* () {
      const tokenResult = yield* Effect.tryPromise({
        try: () => tokenize(code, resolvedLang, theme),
        catch: (err) => (err instanceof Error ? err : new Error(String(err))),
      });
      setResult({ code, lang: resolvedLang, theme, tokens: tokenResult });
    });
    const fiber = Effect.runFork(program);
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [code, resolvedLang, theme, ready, error, tokenize]);

  const { courseid } = useGlobalSearchParams();
  const courseIdNum = courseid
    ? Number(Array.isArray(courseid) ? courseid[0] : courseid)
    : NaN;

  const handleRun = () => {
    if (runFiberRef.current) return;
    if (Number.isNaN(courseIdNum)) return;
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    const program = runCode(courseIdNum, code, resolvedLang).pipe(
      Effect.tap((res) => Effect.sync(() => setRunResult(res))),
      Effect.tapError((err) =>
        Effect.sync(() => {
          const message = err instanceof Error ? err.message : String(err);
          setRunError(message);
          console.warn("Code run failed:", err);
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          runFiberRef.current = null;
          setRunning(false);
        }),
      ),
    );
    runFiberRef.current = Effect.runFork(program);
  };

  useEffect(
    () => () => {
      interruptFiber(runFiberRef);
    },
    [],
  );

  const tokens =
    result &&
    result.code === code &&
    result.lang === resolvedLang &&
    result.theme === theme
      ? result.tokens
      : null;

  return (
    <View className="my-2">
      <View
        className={cn(
          "flex w-full flex-row justify-between rounded-t-lg p-3",
          theme === "github-dark" ? "bg-gray-900" : "bg-gray-50",
        )}
      >
        <Text className="font-mono-bold text-sm text-gray-800 dark:text-gray-100">
          {lang ? LANG_TO_READABLE_LANG[lang] : "Unknown Language"}
        </Text>
        {canRun && (
          <Pressable
            onPress={handleRun}
            disabled={running}
            className="flex-row items-center gap-x-1 self-start rounded-lg bg-[#70069f] px-3 py-1.5"
          >
            <Text className="text-sm font-semibold text-white">
              {running ? "Running..." : "Run"}
            </Text>
            <PlayIcon size={14} color="white" weight="fill" />
          </Pressable>
        )}
      </View>

      {tokens ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className={cn(
            "rounded-b-lg p-3",
            theme === "github-dark" ? "bg-gray-900" : "bg-gray-50",
          )}
        >
          <View>
            {tokens.map((line, i) => renderLine(line, `${i}`, lineNumbers))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="rounded-lg bg-gray-200 p-3 dark:bg-gray-800"
        >
          <Text
            className="font-mono text-sm text-gray-800 dark:text-gray-100"
            selectable
          >
            {code}
          </Text>
        </ScrollView>
      )}

      {running ? (
        <View className="mt-2 rounded-lg bg-gray-900 p-3">
          <Text className="font-mono text-sm text-gray-400">Running…</Text>
        </View>
      ) : null}

      {runResult ? (
        <View className="mt-2 overflow-hidden rounded-lg">
          <View
            className={cn(
              "px-3 py-1.5",
              runResult.exit_code === 0 ? "bg-green-900" : "bg-red-900",
            )}
          >
            <Text className="font-mono-bold text-xs tracking-wide text-gray-100 uppercase">
              {runResult.exit_code === 0 ? "Success" : "Failed"} · exit{" "}
              {runResult.exit_code}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="bg-gray-900 p-3"
          >
            <View>
              {runResult.stdout ? (
                <Text className="font-mono text-sm text-gray-100" selectable>
                  {runResult.stdout}
                </Text>
              ) : null}
              {runResult.stderr ? (
                <Text className="font-mono text-sm text-red-400" selectable>
                  {runResult.stderr}
                </Text>
              ) : null}
              {!runResult.stdout && !runResult.stderr ? (
                <Text className="font-mono text-sm text-gray-500">
                  (no output)
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {runError ? (
        <View className="mt-2 rounded-lg bg-red-950 p-3">
          <Text className="font-mono-bold mb-1 text-xs tracking-wide text-red-300 uppercase">
            Error
          </Text>
          <Text className="font-mono text-sm text-red-300" selectable>
            {runError}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
