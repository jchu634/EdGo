// Run against THREAD_EDITOR_HTML in the collaborative browser.
module.exports = function verifyThreadEditor(mathHtml) {
  const checks = [];
  function check(name, condition) {
    if (!condition) throw new Error(name);
    checks.push(name);
  }
  const editor = document.getElementById("editor");
  const api = window.threadEditor;
  const messages = [];
  window.addEventListener("editor-message", (event) =>
    messages.push(event.detail),
  );
  const original =
    '<document version="2"><paragraph>Hello world</paragraph><!--keep--><math><![CDATA[x < y]]></math><snippet language="ts"><snippet-file>const a = 1;</snippet-file><snippet-file filename="other.ts">keep second file</snippet-file></snippet><file filename="notes.pdf" url="https://files.example/notes"/><custom-node extra="keep">opaque</custom-node></document>';
  api.setContent(original);
  check(
    "unchanged XML is preserved byte for byte",
    api.getContent() === original,
  );
  check(
    "math and code request decoration",
    messages.filter((message) => message.type === "decorate").length === 2,
  );
  function select(start, end) {
    const node = editor.querySelector("p").firstChild;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }
  select(0, 5);
  api.format("bold");
  let xml = api.getContent();
  check(
    "selection becomes bold in saved XML",
    xml.includes("<bold>Hello</bold>"),
  );
  check("root attributes survive visual edits", xml.includes('version="2"'));
  check("comments survive visual edits", xml.includes("<!--keep-->"));
  check(
    "unknown nodes and attributes survive visual edits",
    xml.includes('<custom-node extra="keep">opaque</custom-node>'),
  );
  check(
    "attachments survive visual edits",
    xml.includes('filename="notes.pdf"'),
  );
  check(
    "CDATA equations survive text edits",
    xml.includes("<![CDATA[x < y]]>"),
  );
  const math = editor.querySelector('[data-ed-tag="math"]');
  api.decorate(math.id, "stale", "<b>stale</b>");
  check("stale decoration is ignored", !math.textContent.includes("stale"));
  api.decorate(math.id, "x < y", mathHtml);
  check("math preview renders MathML", !!math.querySelector("math mfrac"));
  math.querySelector("button").click();
  document.getElementById("block-text").value = String.raw`\frac{a}{b}`;
  api.flush(123);
  const reply = messages.find(
    (message) => message.type === "flush" && message.requestId === 123,
  );
  check(
    "save flush commits equation edits still open in dialog",
    reply.content.includes("\\frac{a}{b}"),
  );
  check(
    "flush closes the committed dialog",
    !document.getElementById("block-dialog").open,
  );
  const snippet = editor.querySelector('[data-ed-tag="snippet"]');
  snippet.querySelector("button").click();
  check(
    "code editing opens the first file only",
    document.getElementById("block-text").value === "const a = 1;",
  );
  document.getElementById("block-text").value = "if (a < 2 && b > 1) {}";
  document.getElementById("block-language").value = "js";
  api.flush(124);
  xml = api.getContent();
  check(
    "code edits are XML escaped",
    xml.includes("if (a &lt; 2 &amp;&amp; b &gt; 1) {}"),
  );
  check("code language is editable", xml.includes('language="js"'));
  check(
    "other snippet files survive edits",
    xml.includes(
      '<snippet-file filename="other.ts">keep second file</snippet-file>',
    ),
  );
  api.setReadOnly(true);
  check(
    "saving disables visual edits and block actions",
    editor.contentEditable === "false" &&
      [...editor.querySelectorAll("button")].every((button) => button.disabled),
  );
  api.setReadOnly(false);
  api.setContent("<document><paragraph>Hello world</paragraph></document>");
  select(0, 5);
  api.format("mark");
  check(
    "highlight serializes into Ed mark",
    api.getContent().includes("<mark>Hello</mark>"),
  );
  api.setContent("<document><paragraph>Hello world</paragraph></document>");
  select(0, 5);
  api.format("code");
  check(
    "inline code serializes into Ed code",
    api.getContent().includes("<code>Hello</code>"),
  );
  api.setContent("<document><paragraph></paragraph></document>");
  editor.querySelector("p").textContent = "Typed <text> & more";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  check(
    "typing in preview escapes new XML text",
    api.getContent().includes("Typed &lt;text&gt; &amp; more"),
  );
  api.setContent("<document>unfinished");
  check(
    "invalid existing draft remains intact",
    api.getContent() === "<document>unfinished",
  );
  check(
    "invalid existing XML displays an error",
    document.getElementById("problem").style.display === "block",
  );
  api.setContent(original);
  api.decorate(
    editor.querySelector('[data-ed-tag="math"]').id,
    "x < y",
    mathHtml,
  );
  return { passed: checks.length, checks };
};
