const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { act, create } = require("react-test-renderer");
const ts = require("typescript");
const { XMLParser } = require("fast-xml-parser");

global.IS_REACT_ACT_ENVIRONMENT = true;

function load(filename, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      exports: module.exports,
      require: (name) => mocks[name] ?? require(name),
      AbortController,
      Error,
    },
    { filename },
  );
  return module.exports;
}

const model = load(path.resolve("src/lib/thread-composer.ts"));
const content = "<document><paragraph>Hello world</paragraph></document>";
const draft = { ...model.EMPTY_THREAD_DRAFT, title: "A question", content };

test("editing preserves unknown XML and rejects unsupported thread types", () => {
  const thread = {
    title: "Existing",
    type: "question",
    is_anonymous: true,
    category: "General",
    subcategory: "",
    subsubcategory: "",
    content:
      '<document><custom-node data="keep">original</custom-node></document>',
  };
  assert.equal(model.draftFromThread(thread).content, thread.content);
  assert.equal(model.draftFromThread(thread).isAnonymous, true);
  assert.throws(
    () => model.draftFromThread({ ...thread, type: "announcement" }),
    /not supported/,
  );
});

test("XML validation rejects malformed, empty, and multi-root drafts", () => {
  assert.equal(model.validateThreadDraft(draft), null);
  for (const invalid of [
    "<document><paragraph>broken</document>",
    "<p>wrong root</p>",
    "<document></document>",
    content + content,
    '<!DOCTYPE document [<!ENTITY x "text">]><document>&x;</document>',
  ]) {
    assert.ok(model.validateThreadContent(invalid), invalid);
  }
  assert.match(model.validateThreadDraft({ ...draft, title: "  " }), /title/);
  assert.match(
    model.validateThreadDraft({ ...draft, subcategory: "Orphan" }),
    /category/,
  );
  assert.match(
    model.validateThreadDraft({ ...draft, subsubcategory: "Orphan" }),
    /subcategory/,
  );
});

test("formatting preserves selected XML and escapes only new placeholder text", () => {
  const start = content.indexOf("Hello");
  const result = model.wrapThreadSelection(
    content,
    { start, end: start + 5 },
    "<bold>",
    "</bold>",
    "text",
  );
  assert.equal(result.content, content.replace("Hello", "<bold>Hello</bold>"));
  assert.equal(
    result.content.slice(result.selection.start, result.selection.end),
    "Hello",
  );
  const empty = model.wrapThreadSelection(
    content,
    { start, end: start },
    "<code>",
    "</code>",
    "a < b && c",
  );
  assert.ok(empty.content.includes("<code>a &lt; b &amp;&amp; c</code>"));
});

test("CDATA math remains valid and an empty attachment is not content", () => {
  assert.equal(
    model.validateThreadContent(
      "<document><math><![CDATA[x < y]]></math></document>",
    ),
    null,
  );
  assert.match(
    model.validateThreadContent("<document><file /></document>"),
    /Add some/,
  );
  assert.match(
    model.validateThreadContent("<document><!-- comment --></document>"),
    /Add some/,
  );
});

test("attachment URLs and filenames round trip and local URIs are rejected", () => {
  const attachment = {
    kind: "file",
    url: "https://files.example/a?x=1&y=2",
    filename: 'a < b "notes".pdf',
  };
  const xml = model.appendThreadBlock(
    content,
    model.threadAttachmentXml(attachment),
  );
  assert.equal(model.validateThreadContent(xml), null);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  assert.equal(parsed.document.file["@_url"], attachment.url);
  assert.equal(parsed.document.file["@_filename"], attachment.filename);
  assert.throws(
    () =>
      model.threadAttachmentXml({ ...attachment, url: "file:///cache/a.pdf" }),
    /HTTPS/,
  );
  assert.throws(
    () => model.appendThreadBlock("<document>", "<math>x</math>"),
    /closing/,
  );
  const image = model.threadAttachmentXml({ ...attachment, kind: "image" });
  assert.equal(
    model.validateThreadContent(`<document>${image}</document>`),
    null,
  );
});

// Run the component through React. Only device-owned modules are substituted.
function fixture(props = {}, native = {}) {
  const Composer = load(path.resolve("src/components/ThreadComposer.tsx"), {
    "@/src/lib/thread-composer": model,
    "react-native": {
      ActivityIndicator: "ActivityIndicator",
      KeyboardAvoidingView: "KeyboardAvoidingView",
      Platform: { OS: "ios" },
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Switch: "Switch",
      Text: "Text",
      TextInput: "TextInput",
      View: "View",
    },
    "expo-document-picker": {
      getDocumentAsync: native.pick ?? (async () => ({ canceled: true })),
    },
    "react-native-turboxml": {
      parseXml:
        native.parse ??
        (async () => ({
          type: "element",
          tag: "document",
          attrs: {},
          children: [],
        })),
    },
    "@/src/lib/renderXML": {
      isXmlNode: (node) =>
        node?.type === "element" && Array.isArray(node.children),
      renderXmlNode: (node) => React.createElement("Preview", { node }),
    },
  }).default;
  let renderer;
  act(() => {
    renderer = create(
      React.createElement(Composer, {
        mode: "create",
        initialValue: draft,
        onCancel() {},
        onSubmit: async () => {},
        ...props,
      }),
    );
  });
  const button = (label) =>
    renderer.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === label);
  const field = (label) =>
    renderer.root
      .findAllByType("TextInput")
      .find((node) => node.props.accessibilityLabel === label);
  const press = async (label) => {
    await act(async () => {
      await button(label).props.onPress();
    });
  };
  const enter = (label, text) =>
    act(() => field(label).props.onChangeText(text));
  const error = () =>
    renderer.root
      .findAllByType("Text")
      .find((node) => node.props.accessibilityRole === "alert")?.props.children;
  const close = () => act(() => renderer.unmount());
  return { renderer, button, field, press, enter, error, close };
}

test("save preserves an existing draft and keeps it after adapter failure", async () => {
  const received = [];
  const f = fixture({
    mode: "edit",
    onSubmit: async (value) => {
      received.push(value);
      throw new Error("Offline. Retry later.");
    },
  });
  await f.press("Save changes");
  assert.equal(received[0].content, content);
  assert.equal(f.error(), "Offline. Retry later.");
  assert.equal(f.field("Thread content XML").props.value, content);
  assert.equal(f.button("Save changes").props.disabled, false);
  f.close();
});

test("invalid XML never reaches the save adapter", async () => {
  let called = false;
  const f = fixture({
    onSubmit: async () => {
      called = true;
    },
  });
  f.enter("Thread content XML", "<document>unfinished");
  await f.press("Create thread");
  assert.equal(called, false);
  assert.match(f.error(), /Line/);
  f.close();
});

test("code and LaTeX block insertion escape source without corrupting it", async () => {
  const f = fixture();
  await f.press("Code block");
  f.enter("Code language", "ts");
  const code = 'if (x < 2 && y > 1) { return "yes"; }';
  f.enter("Block content", code);
  await f.press("Insert block");
  await f.press("LaTeX");
  const latex = String.raw`\begin{aligned}x &= y\\z &= 2\end{aligned}`;
  f.enter("Block content", latex);
  await f.press("Insert block");
  const result = f.field("Thread content XML").props.value;
  assert.equal(model.validateThreadContent(result), null);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(result);
  assert.equal(parsed.document.snippet["@_language"], "ts");
  assert.equal(parsed.document.snippet["snippet-file"], code);
  assert.equal(parsed.document.math, latex);
  await f.press("Undo");
  assert.ok(!f.field("Thread content XML").props.value.includes("<math>"));
  await f.press("Redo");
  assert.equal(f.field("Thread content XML").props.value, result);
  f.close();
});

test("double save presses call the adapter only once while saving", async () => {
  let finish;
  let saves = 0;
  const f = fixture({
    onSubmit: () => {
      saves++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const handler = f.button("Create thread").props.onPress;
  let saving;
  await act(async () => {
    saving = handler();
    await handler();
  });
  assert.equal(saves, 1);
  assert.equal(f.field("Thread title").props.editable, false);
  await act(async () => {
    finish();
    await saving;
  });
  assert.equal(f.button("Create thread").props.disabled, false);
  f.close();
});

test("a stale preview response cannot replace newer source edits", async () => {
  let finish;
  const f = fixture(
    {},
    {
      parse: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  );
  let preview;
  await act(async () => {
    preview = f.button("Preview").props.onPress();
  });
  await f.press("Source");
  f.enter("Thread content XML", content.replace("Hello", "Newer"));
  await act(async () => {
    finish({ type: "element", tag: "document", attrs: {}, children: [] });
    await preview;
  });
  assert.equal(f.renderer.root.findAllByType("Preview").length, 0);
  assert.ok(f.field("Thread content XML").props.value.includes("Newer"));
  f.close();
});

test("partial upload failure keeps completed attachments and the draft", async () => {
  const files = [
    { uri: "file:///a", name: "a.pdf" },
    { uri: "file:///b", name: "b.pdf" },
  ];
  const f = fixture(
    {
      onUploadAttachment: async (file) => {
        if (file.name === "b.pdf") throw new Error("Second upload failed");
        return {
          kind: "file",
          url: "https://files.example/a",
          filename: file.name,
        };
      },
    },
    { pick: async () => ({ canceled: false, assets: files }) },
  );
  await f.press("Add files or images");
  const result = f.field("Thread content XML").props.value;
  assert.ok(result.includes('filename="a.pdf"'));
  assert.ok(!result.includes("file:///"));
  assert.equal(f.error(), "Second upload failed");
  assert.equal(f.button("Create thread").props.disabled, false);
  f.close();
});

test("picker cancellation does not change the draft or invoke upload", async () => {
  let uploads = 0;
  const f = fixture({
    onUploadAttachment: async () => {
      uploads++;
    },
  });
  await f.press("Add files or images");
  assert.equal(uploads, 0);
  assert.equal(f.field("Thread content XML").props.value, content);
  assert.equal(f.error(), undefined);
  f.close();
});

test("unmount aborts an in-flight upload", async () => {
  let signal;
  let finish;
  const f = fixture(
    {
      onUploadAttachment: (_, abortSignal) => {
        signal = abortSignal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
    {
      pick: async () => ({
        canceled: false,
        assets: [{ name: "a.pdf", uri: "file:///a" }],
      }),
    },
  );
  let attaching;
  await act(async () => {
    attaching = f.button("Add files or images").props.onPress();
  });
  f.close();
  assert.equal(signal.aborted, true);
  await act(async () => {
    finish({ kind: "file", url: "https://files.example/a", filename: "a.pdf" });
    await attaching;
  });
});

test("the real XML renderer previews inline code, highlighting, and strike marks", () => {
  const mocks = {
    "react-native": { View: "View", Text: "Text" },
    uniwind: { withUniwind: (component) => component },
    "ratex-react-native": { RaTeXView: "RaTeXView" },
  };
  for (const name of [
    "CodeBlock",
    "FileComponent",
    "LinkText",
    "SpoilerText",
    "VideoComponent",
    "WebSnippetComponent",
    "ContentImage",
  ]) {
    mocks[`@/src/components/${name}`] = { __esModule: true, default: name };
  }
  const { renderXmlNode } = load(path.resolve("src/lib/renderXML.tsx"), mocks);
  const element = (tag, children, attrs = {}) => ({
    type: "element",
    tag,
    attrs,
    children,
  });
  const text = (value) => ({ type: "text", value });
  const rendered = renderXmlNode(
    element("paragraph", [
      element("code", [text("const x = 1")]),
      element("mark", [text(" highlighted ")]),
      element("strikethrough", [text("old")]),
    ]),
  );
  const runs = rendered.props.children;
  assert.ok(
    runs.some(
      (run) =>
        run.props.className.includes("font-mono") &&
        run.props.children === "const x = 1",
    ),
  );
  assert.ok(
    runs.some(
      (run) =>
        run.props.className.includes("bg-yellow-200") &&
        run.props.children === " highlighted ",
    ),
  );
  assert.ok(
    runs.some(
      (run) =>
        run.props.className.includes("line-through") &&
        run.props.children === "old",
    ),
  );
  assert.doesNotThrow(() =>
    renderXmlNode(element("callout", [text("A note")])),
  );
});
