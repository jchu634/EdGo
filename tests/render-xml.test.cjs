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

function findNodes(node, predicate, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) findNodes(item, predicate, out);
    return out;
  }
  if (predicate(node)) out.push(node);
  if ("children" in node) findNodes(node.children, predicate, out);
  return out;
}

test("auto-links plaintext emails in paragraphs without breaking explicit mailto links", () => {
  const { renderXmlNode, splitEmails } = loadRenderXml();

  assert.deepEqual(
    structuredClone(
      splitEmails(
        "email Alice (alice.smith@example.edu) and Bob (bob.jones@example.edu) immediately.",
      ),
    ),
    [
      { kind: "text", text: "email Alice (" },
      {
        kind: "email",
        text: "alice.smith@example.edu",
        email: "alice.smith@example.edu",
      },
      { kind: "text", text: ") and Bob (" },
      {
        kind: "email",
        text: "bob.jones@example.edu",
        email: "bob.jones@example.edu",
      },
      { kind: "text", text: ") immediately." },
    ],
  );

  assert.deepEqual(
    structuredClone(splitEmails("Contact user@example.com.au.")),
    [
      { kind: "text", text: "Contact " },
      {
        kind: "email",
        text: "user@example.com.au",
        email: "user@example.com.au",
      },
      { kind: "text", text: "." },
    ],
  );

  assert.deepEqual(
    structuredClone(
      splitEmails(
        "Reach support@example.org, hello@example.com, or team@example.co.uk and ops@sub.example.co.nz.",
      ),
    ),
    [
      { kind: "text", text: "Reach " },
      {
        kind: "email",
        text: "support@example.org",
        email: "support@example.org",
      },
      { kind: "text", text: ", " },
      {
        kind: "email",
        text: "hello@example.com",
        email: "hello@example.com",
      },
      { kind: "text", text: ", or " },
      {
        kind: "email",
        text: "team@example.co.uk",
        email: "team@example.co.uk",
      },
      { kind: "text", text: " and " },
      {
        kind: "email",
        text: "ops@sub.example.co.nz",
        email: "ops@sub.example.co.nz",
      },
      { kind: "text", text: "." },
    ],
  );

  const doc = {
    type: "document",
    tag: "document",
    attrs: {},
    children: [
      {
        type: "element",
        tag: "paragraph",
        attrs: {},
        children: [
          { type: "text", value: "email Alice (alice.smith@example.edu) and" },
          {
            type: "element",
            tag: "link",
            attrs: { href: "mailto:bob.jones@example.edu" },
            children: [{ type: "text", value: "bob.jones@example.edu" }],
          },
          { type: "text", value: "." },
        ],
      },
    ],
  };

  let renderer;
  act(() => {
    renderer = create(renderXmlNode(doc));
  });

  const tree = renderer.toJSON();
  const links = findNodes(tree, (n) => n.type === "LinkText");
  assert.equal(links.length, 2);
  assert.equal(links[0].props.href, "mailto:alice.smith@example.edu");
  assert.equal(collectText(links[0]), "alice.smith@example.edu");
  assert.equal(links[1].props.href, "mailto:bob.jones@example.edu");
  assert.equal(collectText(links[1]), "bob.jones@example.edu");
  assert.equal(
    collectText(tree),
    "email Alice (alice.smith@example.edu) and bob.jones@example.edu.",
  );
});

test("renders underline and bold together in paragraphs and list-items", () => {
  const { renderXmlNode } = loadRenderXml();
  const doc = {
    type: "document",
    tag: "document",
    attrs: {},
    children: [
      {
        type: "element",
        tag: "paragraph",
        attrs: {},
        children: [
          { type: "text", value: "The workshop starts" },
          {
            type: "element",
            tag: "underline",
            attrs: {},
            children: [
              {
                type: "element",
                tag: "bold",
                attrs: {},
                children: [{ type: "text", value: "next Monday" }],
              },
            ],
          },
          { type: "text", value: "- bring a laptop" },
        ],
      },
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
                children: [
                  { type: "text", value: "Participants" },
                  {
                    type: "element",
                    tag: "underline",
                    attrs: {},
                    children: [
                      {
                        type: "element",
                        tag: "bold",
                        attrs: {},
                        children: [{ type: "text", value: "should" }],
                      },
                    ],
                  },
                  { type: "text", value: "register in advance." },
                ],
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
  const underlinedTexts = findNodes(
    tree,
    (n) =>
      n.type === "Text" &&
      typeof n.props?.className === "string" &&
      n.props.className.includes("underline"),
  );
  assert.equal(underlinedTexts.length, 2);

  for (const node of underlinedTexts) {
    assert.match(node.props.className, /\bfont-display-bold\b/);
    assert.match(node.props.className, /\bunderline\b/);
    assert.equal(node.props.style?.textDecorationLine, "underline");
  }
  assert.equal(collectText(underlinedTexts[0]), "next Monday");
  assert.equal(collectText(underlinedTexts[1]), "should");
});

test("avoids spurious spaces before closing punctuation and after opening punctuation", () => {
  const { renderXmlNode } = loadRenderXml();
  // Text nodes are trimmed to match react-native-turboxml output.
  const doc = {
    type: "document",
    tag: "document",
    attrs: {},
    children: [
      {
        type: "element",
        tag: "paragraph",
        attrs: {},
        children: [
          { type: "text", value: "When you spot a" },
          {
            type: "element",
            tag: "bold",
            attrs: {},
            children: [{ type: "text", value: "minor typo" }],
          },
          { type: "text", value: ", open the" },
          {
            type: "element",
            tag: "link",
            attrs: { href: "https://example.com/form" },
            children: [{ type: "text", value: "feedback page" }],
          },
          { type: "text", value: "before" },
          {
            type: "element",
            tag: "bold",
            attrs: {},
            children: [{ type: "text", value: "noon on Tuesday" }],
          },
          { type: "text", value: ". Updates post daily." },
        ],
      },
      {
        type: "element",
        tag: "paragraph",
        attrs: {},
        children: [
          { type: "text", value: 'Label it "' },
          {
            type: "element",
            tag: "italic",
            attrs: {},
            children: [{ type: "text", value: "draft" }],
          },
          { type: "text", value: '" (see:' },
          {
            type: "element",
            tag: "bold",
            attrs: {},
            children: [{ type: "text", value: "help desk" }],
          },
          { type: "text", value: "at" },
          {
            type: "element",
            tag: "link",
            attrs: { href: "mailto:help@example.edu" },
            children: [{ type: "text", value: "help@example.edu" }],
          },
          { type: "text", value: ")." },
        ],
      },
    ],
  };

  let renderer;
  act(() => {
    renderer = create(renderXmlNode(doc));
  });

  const tree = renderer.toJSON();
  assert.equal(
    collectText(tree),
    'When you spot a minor typo, open the feedback page before noon on Tuesday. Updates post daily.\n\nLabel it "draft" (see: help desk at help@example.edu).',
  );
});

test("does not partially auto-link emails preceded by non-delimiter characters", () => {
  const { splitEmails } = loadRenderXml();
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitEmails("Contact o'brien@example.edu or ssh://git@github.com"),
      ),
    ),
    [
      {
        kind: "text",
        text: "Contact o'brien@example.edu or ssh://git@github.com",
      },
    ],
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitEmails("Email (alice@example.edu) or bob@example.edu"),
      ),
    ),
    [
      { kind: "text", text: "Email (" },
      { kind: "email", text: "alice@example.edu", email: "alice@example.edu" },
      { kind: "text", text: ") or " },
      { kind: "email", text: "bob@example.edu", email: "bob@example.edu" },
    ],
  );
});

test("auto-links plaintext http and https URLs without breaking explicit links or punctuation", () => {
  const { renderXmlNode, splitLinks } = loadRenderXml();

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitLinks(
          "Visit https://example.com/docs and (http://localhost:3000/test), or see https://en.wikipedia.org/wiki/Foo_(bar)!",
        ),
      ),
    ),
    [
      { kind: "text", text: "Visit " },
      {
        kind: "link",
        text: "https://example.com/docs",
        url: "https://example.com/docs",
      },
      { kind: "text", text: " and (" },
      {
        kind: "link",
        text: "http://localhost:3000/test",
        url: "http://localhost:3000/test",
      },
      { kind: "text", text: "), or see " },
      {
        kind: "link",
        text: "https://en.wikipedia.org/wiki/Foo_(bar)",
        url: "https://en.wikipedia.org/wiki/Foo_(bar)",
      },
      { kind: "text", text: "!" },
    ],
  );

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitLinks(
          "Ignore ftp://example.com, ssh://git@github.com, foohttps://example.com, and https://.",
        ),
      ),
    ),
    [
      {
        kind: "text",
        text: "Ignore ftp://example.com, ssh://git@github.com, foohttps://example.com, and https://.",
      },
    ],
  );

  const doc = {
    type: "document",
    tag: "document",
    attrs: {},
    children: [
      {
        type: "element",
        tag: "paragraph",
        attrs: {},
        children: [
          {
            type: "text",
            value: "See https://example.com/path/@user#12 and",
          },
          {
            type: "element",
            tag: "link",
            attrs: { href: "https://explicit.example.com" },
            children: [{ type: "text", value: "explicit link" }],
          },
          { type: "text", value: "." },
        ],
      },
    ],
  };

  let renderer;
  act(() => {
    renderer = create(
      renderXmlNode(doc, "doc-0", { courseId: 1, maxThreadNumber: 100 }),
    );
  });

  const tree = renderer.toJSON();
  const links = findNodes(tree, (n) => n.type === "LinkText");
  assert.equal(links.length, 2);
  assert.equal(links[0].props.href, "https://example.com/path/@user#12");
  assert.equal(collectText(links[0]), "https://example.com/path/@user#12");
  assert.equal(links[1].props.href, "https://explicit.example.com");
  assert.equal(collectText(links[1]), "explicit link");
  assert.equal(
    collectText(tree),
    "See https://example.com/path/@user#12 and explicit link.",
  );
});

test("handles link autodetection edge cases: host validation, quotes, CJK, zero-width chars, and comma-separated URLs", () => {
  const { splitLinks } = loadRenderXml();

  // Rejects malformed / hostless URLs
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitLinks(
          "Bad: https://?q https:///path/x https://:8080/x https://.a/x https://user@/x",
        ),
      ),
    ),
    [
      {
        kind: "text",
        text: "Bad: https://?q https:///path/x https://:8080/x https://.a/x https://user@/x",
      },
    ],
  );

  // Single quotes and curly single quotes
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitLinks("Try 'https://example.com/a' or \u2018HTTPS://EXAMPLE.COM/b\u2019."),
      ),
    ),
    [
      { kind: "text", text: "Try '" },
      { kind: "link", text: "https://example.com/a", url: "https://example.com/a" },
      { kind: "text", text: "' or \u2018" },
      { kind: "link", text: "HTTPS://EXAMPLE.COM/b", url: "HTTPS://EXAMPLE.COM/b" },
      { kind: "text", text: "\u2019." },
    ],
  );

  // CJK adjacency and non-ASCII trailing punctuation
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitLinks("见https://example.com。和「https://example.org/x」…"),
      ),
    ),
    [
      { kind: "text", text: "见" },
      { kind: "link", text: "https://example.com", url: "https://example.com" },
      { kind: "text", text: "。和「" },
      { kind: "link", text: "https://example.org/x", url: "https://example.org/x" },
      { kind: "text", text: "」…" },
    ],
  );

  // Zero-width characters are not swallowed into the URL
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(splitLinks("Link: https://example.com\u200Bnext")),
    ),
    [
      { kind: "text", text: "Link: " },
      { kind: "link", text: "https://example.com", url: "https://example.com" },
      { kind: "text", text: "\u200Bnext" },
    ],
  );

  // Adjacent comma-separated URLs split cleanly while preserving commas inside a single URL
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        splitLinks(
          "https://a.com,https://b.com and https://maps.example.com/@37.7,-122.4",
        ),
      ),
    ),
    [
      { kind: "link", text: "https://a.com", url: "https://a.com" },
      { kind: "text", text: "," },
      { kind: "link", text: "https://b.com", url: "https://b.com" },
      { kind: "text", text: " and " },
      {
        kind: "link",
        text: "https://maps.example.com/@37.7,-122.4",
        url: "https://maps.example.com/@37.7,-122.4",
      },
    ],
  );
});
