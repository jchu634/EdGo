const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { act, create } = require("react-test-renderer");
const ts = require("typescript");

global.IS_REACT_ACT_ENVIRONMENT = true;

function fixture() {
  const scripts = [],
    changes = [],
    errors = [];
  const WebView = React.forwardRef(function NativeWebView(props, ref) {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (script) => scripts.push(script),
    }));
    return React.createElement("WebView", props);
  });
  const module = { exports: {} };
  const mocks = {
    "react-native": { View: "View" },
    uniwind: { useUniwind: () => ({ theme: "light" }) },
    "react-native-webview": { __esModule: true, default: WebView },
    "@/src/lib/thread-editor-document": { THREAD_EDITOR_HTML: "<html></html>" },
    "@/src/lib/thread-composer": {
      escapeXml: (text) =>
        text.replaceAll("&", "&amp;").replaceAll("<", "&lt;"),
    },
    "@/src/providers/highlightProvider": {
      useHighlighter: () => ({ tokenize: async () => null }),
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/components/ThreadRichEditor.tsx", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports: module.exports,
      require: (name) => mocks[name] ?? require(name),
      setTimeout,
      clearTimeout,
      Error,
    },
  );
  const ref = React.createRef();
  const props = {
    content: "<document><paragraph>Original</paragraph></document>",
    editable: true,
    onChange: (value) => changes.push(value),
    onError: (value) => errors.push(value),
    ref,
  };
  let renderer;
  act(() => {
    renderer = create(React.createElement(module.exports.default, props));
  });
  const message = async (data) => {
    await act(async () =>
      renderer.root
        .findByType("WebView")
        .props.onMessage({ nativeEvent: { data: JSON.stringify(data) } }),
    );
  };
  const update = (next) => {
    Object.assign(props, next);
    act(() =>
      renderer.update(React.createElement(module.exports.default, props)),
    );
  };
  return {
    ref,
    props,
    renderer,
    scripts,
    changes,
    errors,
    message,
    update,
    close: () => act(() => renderer.unmount()),
  };
}

test("native bridge waits for loading and preserves selection when reflecting edits", async () => {
  const f = fixture();
  await assert.rejects(f.ref.current.flush(), /still loading/);
  await f.message({ type: "ready" });
  assert.ok(
    f.scripts.some((script) =>
      script.startsWith("window.threadEditor.setContent("),
    ),
  );
  const edited = f.props.content.replace("Original", "Edited");
  await f.message({ type: "change", content: edited });
  assert.equal(f.changes[0], edited);
  f.scripts.length = 0;
  f.update({ content: edited });
  assert.ok(!f.scripts.some((script) => script.includes("setContent")));
  f.update({ content: f.props.content.replace("Edited", "Undo") });
  assert.ok(f.scripts.some((script) => script.includes("setContent")));
  f.close();
});

test("flush resolves only its response and closing rejects outstanding saves", async () => {
  const f = fixture();
  await f.message({ type: "ready" });
  let pending;
  act(() => {
    pending = f.ref.current.flush();
  });
  assert.ok(f.scripts.includes("window.threadEditor.flush(1);true;"));
  await f.message({ type: "flush", requestId: 2, content: "wrong response" });
  await f.message({ type: "flush", requestId: 1, content: "latest edits" });
  assert.equal(await pending, "latest edits");
  const interrupted = f.ref.current.flush();
  const rejection = assert.rejects(interrupted, /closed/);
  f.close();
  await rejection;
});

test("bridge decorates math safely, escapes code and applies readonly state", async () => {
  const f = fixture();
  await f.message({ type: "ready" });
  await f.message({
    type: "decorate",
    id: "math1",
    kind: "math",
    source: String.raw`\frac{a}{b}`,
  });
  assert.ok(
    f.scripts.some(
      (script) => script.includes("MathML") && script.includes("mfrac"),
    ),
  );
  await f.message({
    type: "decorate",
    id: "code1",
    kind: "code",
    source: "<script>",
  });
  assert.ok(f.scripts.some((script) => script.includes("&lt;script>")));
  f.update({ editable: false });
  assert.equal(f.scripts.at(-1), "window.threadEditor.setReadOnly(true);true;");
  await f.message({ type: "change", content: 42 });
  assert.equal(f.changes.length, 0);
  f.close();
});
