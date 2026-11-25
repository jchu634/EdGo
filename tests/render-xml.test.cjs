const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { act, create } = require("react-test-renderer");
const ts = require("typescript");

global.IS_REACT_ACT_ENVIRONMENT = true;

function loadRenderXml() {
  const mocks = {
    "expo-router": { useRouter: () => ({ push: () => {} }) },
    "phosphor-react-native": {
      CheckCircleIcon: (props) => React.createElement("CheckCircleIcon", props),
      InfoIcon: (props) => React.createElement("InfoIcon", props),
      WarningIcon: (props) => React.createElement("WarningIcon", props),
      XCircleIcon: (props) => React.createElement("XCircleIcon", props),
    },
    "ratex-react-native": { RaTeXView: "RaTeXView" },
    "react-native": { Text: "Text", View: "View" },
    uniwind: { withUniwind: (Component) => Component },
    "@/src/components/CodeBlock": { __esModule: true, default: "CodeBlock" },
    "@/src/components/ContentImage": {
      __esModule: true,
      default: "ContentImage",
    },
    "@/src/components/FileComponent": {
      __esModule: true,
      default: "FileComponent",
    },
    "@/src/components/LinkText": { __esModule: true, default: "LinkText" },
    "@/src/components/SpoilerText": {
      __esModule: true,
      default: "SpoilerText",
    },
    "@/src/components/VideoComponent": {
      __esModule: true,
      default: "VideoComponent",
    },
    "@/src/components/WebSnippetComponent": {
      __esModule: true,
      default: "WebSnippetComponent",
    },
  };

  const filename = path.resolve("src/lib/renderXML.tsx");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;

  const mod = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod.exports,
    module: mod,
    console,
    require: (id) => {
      if (id in mocks) return mocks[id];
      return require(id);
    },
  });

  return mod.exports;
}

function collectText(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node === "object" && "children" in node) {
    return collectText(node.children);
  }
  return "";
}

test("renders blockquote with paragraph children", () => {
  const { renderXmlNode } = loadRenderXml();
  const doc = {
    type: "document",
    tag: "document",
    attrs: {},
    children: [
      {
        type: "element",
        tag: "blockquote",
        attrs: {},
        children: [
          {
            type: "element",
            tag: "paragraph",
            attrs: {},
            children: [
              { type: "text", value: "Quoted " },
              {
                type: "element",
                tag: "bold",
                attrs: {},
                children: [{ type: "text", value: "text" }],
              },
            ],
          },
        ],
      },
    ],
  };

  let renderer;
  act(() => {
    renderer = create(renderXmlNode(doc));
  });

  const tree = renderer.toJSON();
  assert.equal(collectText(tree), "Quoted text");
  const quoteView = tree.children[0];
  assert.equal(quoteView.type, "View");
  assert.match(quoteView.props.className, /border-l-4/);
  assert.match(quoteView.props.className, /\bml-4\b/);
});

test("renders blockquote with direct inline children", () => {
  const { renderXmlNode } = loadRenderXml();
  const node = {
    type: "element",
    tag: "blockquote",
    attrs: {},
    children: [{ type: "text", value: "Direct quote" }],
  };

  let renderer;
  act(() => {
    renderer = create(renderXmlNode(node));
  });

  const tree = renderer.toJSON();
  assert.equal(tree.type, "View");
  assert.match(tree.props.className, /border-l-4/);
  assert.equal(collectText(tree), "Direct quote");
});

test("renders callouts with edge icon and without type label text", () => {
  const { renderXmlNode } = loadRenderXml();
  const cases = [
    ["info", "InfoIcon"],
    ["warning", "WarningIcon"],
    ["error", "XCircleIcon"],
    ["success", "CheckCircleIcon"],
    [undefined, "InfoIcon"],
  ];

  for (const [type, expectedIcon] of cases) {
    const node = {
      type: "element",
      tag: "callout",
      attrs: type ? { type } : {},
      children: [{ type: "text", value: "Callout message" }],
    };

    let renderer;
    act(() => {
      renderer = create(renderXmlNode(node));
    });

    const tree = renderer.toJSON();
    const text = collectText(tree);
    assert.equal(text, "Callout message");
    assert.doesNotMatch(text, /INFO|WARNING|ERROR|SUCCESS/);

    const edgeView = tree.children[0];
    assert.equal(edgeView.type, "View");
    assert.equal(edgeView.children[0].type, expectedIcon);
  }
});

test("omits bare marker on list-item that only wraps a nested list", () => {
  const { renderXmlNode } = loadRenderXml();
  const listNode = {
    type: "element",
    tag: "list",
    attrs: { style: "bullet" },
    children: [
      {
        type: "element",
        tag: "list-item",
        attrs: {},
        children: [
          {
            type: "element",
            tag: "list",
            attrs: { style: "bullet" },
            children: [
              {
                type: "element",
                tag: "list-item",
                attrs: { value: "1" },
                children: [
                  {
                    type: "element",
                    tag: "paragraph",
                    attrs: {},
                    children: [{ type: "text", value: "Nested item" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "element",
        tag: "list-item",
        attrs: { value: "1" },
        children: [
          {
            type: "element",
            tag: "paragraph",
            attrs: {},
            children: [{ type: "text", value: "Top-level item" }],
          },
        ],
      },
    ],
  };

  let renderer;
  act(() => {
    renderer = create(renderXmlNode(listNode));
  });

  const tree = renderer.toJSON();
  const wrapperItem = tree.children[0];
  assert.equal(wrapperItem.type, "View");
  // Only the nested list View should be rendered inside the wrapper list-item (no bare "•" Text)
  assert.equal(wrapperItem.children.length, 1);
  assert.equal(wrapperItem.children[0].type, "View");
  assert.equal(collectText(tree), "•Nested item•Top-level item");
});
