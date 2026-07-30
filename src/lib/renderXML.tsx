import { View, Text, Image } from "react-native";
import React from "react";
import LinkText from "@/src/components/LinkText";
import SpoilerText from "@/src/components/SpoilerText";
import { RaTeXView } from "ratex-react-native";

interface XmlTextNode {
  type: "text";
  value: string;
}

interface XmlElementNode {
  type: "element" | "document";
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  selfClosing?: boolean;
}

export type XmlNode = XmlTextNode | XmlElementNode;

type TextBlockNode = XmlElementNode & { _blockTag?: string };

type InlineMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
  heading?: number;
};

type InlineRun =
  | {
      kind: "text";
      text: string;
      marks: InlineMarks;
    }
  | {
      kind: "newline";
    };

export function isXmlNode(val: unknown): val is XmlNode {
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.value === "string") return true;
  if (
    (obj.type === "element" || obj.type === "document") &&
    typeof obj.tag === "string" &&
    Array.isArray(obj.children)
  )
    return true;
  return false;
}

function sameMarks(a: InlineMarks, b: InlineMarks): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.code === b.code &&
    a.href === b.href &&
    a.heading === b.heading
  );
}

function mergeAdjacentRuns(runs: InlineRun[]): InlineRun[] {
  const merged: InlineRun[] = [];

  for (const run of runs) {
    const prev = merged[merged.length - 1];

    if (
      run.kind === "text" &&
      prev?.kind === "text" &&
      sameMarks(prev.marks, run.marks)
    ) {
      prev.text += run.text;
    } else {
      merged.push(
        run.kind === "text" ? { ...run, marks: { ...run.marks } } : run,
      );
    }
  }

  return merged;
}

const BLOCKED =
  /\\(?:def|gdef|edef|xdef|let|global|newcommand|renewcommand|newenvironment|renewenvironment)\*?(?![A-Za-z@])/;

function validateAndCleanLaTeX(input: any): string {
  if (typeof input !== "string") return "";

  const latex = input.slice(0, 5_000);

  return BLOCKED.test(latex) ? "\\text{Invalid formatting detected.}" : latex;
}

function extractRunsFromNode(node: XmlNode, marks: InlineMarks): InlineRun[] {
  if (node.type === "text") {
    return node.value.length > 0
      ? [{ kind: "text" as const, text: node.value, marks }]
      : [];
  }
  if (node.type !== "element" && node.type !== "document") return [];

  switch (node.tag) {
    case "bold":
    case "b":
      return collectInlineRuns(node.children, { ...marks, bold: true });
    case "italic":
    case "i":
      return collectInlineRuns(node.children, { ...marks, italic: true });
    case "underline":
    case "u":
      return collectInlineRuns(node.children, { ...marks, underline: true });
    case "link":
      if (node.children.length > 0 && node.children[0].type === "text") {
        return collectInlineRuns(node.children, {
          ...marks,
          href: node.attrs.href,
        });
      } else {
        return collectInlineRuns(node.children, {
          ...marks,
          href: node.attrs.href,
        });
      }
    case "heading": {
      const level = Number(node.attrs.number) || 1;
      return collectInlineRuns(node.children, {
        ...marks,
        bold: true,
        heading: Math.min(Math.max(level, 1), 4),
      });
    }
    case "br":
    case "break":
      return [{ kind: "newline" as const }];
    default:
      return [];
  }
}

function collectInlineRuns(
  nodes: XmlNode[],
  activeMarks: InlineMarks = {},
): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of nodes) {
    const contributed = extractRunsFromNode(node, activeMarks);

    if (runs.length > 0 && contributed.length > 0) {
      const last = runs[runs.length - 1];
      const first = contributed[0];
      if (
        last.kind === "text" &&
        first.kind === "text" &&
        !/\s$/.test(last.text) &&
        !/^\s/.test(first.text)
      ) {
        runs.push({ kind: "text", text: " ", marks: {} });
      }
    }

    runs.push(...contributed);
  }
  return mergeAdjacentRuns(runs);
}

function collectMergedBlockRuns(blocks: TextBlockNode[]): InlineRun[] {
  const allRuns: InlineRun[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) {
      const prevIsHeading = blocks[i - 1]._blockTag === "heading";
      const curIsHeading = blocks[i]._blockTag === "heading";
      if (curIsHeading || !prevIsHeading) {
        allRuns.push({ kind: "newline" });
        allRuns.push({ kind: "newline" });
      } else {
        allRuns.push({ kind: "newline" });
      }
    }
    if (blocks[i]._blockTag === "heading") {
      const level = Number(blocks[i].attrs.number) || 1;
      const clamped = Math.min(Math.max(level, 1), 4);
      allRuns.push(
        ...collectInlineRuns(blocks[i].children, {
          bold: true,
          heading: clamped,
        }),
      );
    } else {
      allRuns.push(...collectInlineRuns(blocks[i].children));
    }
  }
  return mergeAdjacentRuns(allRuns);
}

function renderBlockChildren(
  node: XmlElementNode,
  keyPrefix: string,
): React.ReactNode[] {
  const fragments: React.ReactNode[] = [];
  let blockBuffer: TextBlockNode[] = [];
  let groupIdx = 0;

  const flushBuffer = () => {
    if (blockBuffer.length === 0) return;
    const runs = collectMergedBlockRuns(blockBuffer);
    fragments.push(
      <Text
        key={`${keyPrefix}-pg-${groupIdx}`}
        className="font-display mb-2 dark:text-slate-100"
        selectable
      >
        {renderInlineRuns(runs, `${keyPrefix}-pg-${groupIdx}`)}
      </Text>,
    );
    blockBuffer = [];
    groupIdx++;
  };

  node.children.forEach((child, i) => {
    if (
      child.type === "element" &&
      (child.tag === "paragraph" ||
        child.tag === "p" ||
        child.tag === "heading")
    ) {
      blockBuffer.push({
        ...child,
        _blockTag: child.tag,
      });
    } else {
      flushBuffer();
      fragments.push(renderXmlNode(child, `${keyPrefix}-blk-${i}`));
    }
  });
  flushBuffer();

  return fragments;
}

function headingSizeClass(level: number): string {
  switch (level) {
    case 1:
      return "text-2xl";
    case 2:
      return "text-xl";
    case 3:
      return "text-lg";
    case 4:
      return "text-base";
    default:
      return "text-lg";
  }
}

function renderInlineRuns(
  runs: InlineRun[],
  keyPrefix: string,
): React.ReactNode[] {
  return runs.map((run, i) => {
    const k = `${keyPrefix}-run-${i}`;

    if (run.kind === "newline") {
      return <React.Fragment key={k}>{"\n"}</React.Fragment>;
    }
    const classNames: string[] = [];

    if (run.marks.code) {
      classNames.push("rounded", "bg-gray-200", "px-1", "font-mono");
    } else if (run.marks.bold && run.marks.italic) {
      classNames.push("font-display-bold-italic");
    } else if (run.marks.bold) {
      classNames.push("font-display-bold");
    } else if (run.marks.italic) {
      classNames.push("font-display-italic");
    }

    if (run.marks.underline) classNames.push("underline");
    if (run.marks.heading) classNames.push(headingSizeClass(run.marks.heading));

    const className = classNames.join(" ");

    if (run.marks.href) {
      return (
        <LinkText key={k} href={run.marks.href}>
          {run.text}
        </LinkText>
      );
    }
    return (
      <Text key={k} className={className}>
        {run.text}
      </Text>
    );
  });
}

// Block-level tags that may appear inside a <list-item>. These are NOT merged
// into the item's inline text — they are rendered as separate blocks below the
// marker line (e.g. a nested <list> or an extra <paragraph>).
const LIST_BLOCK_TAGS = new Set([
  "list",
  "paragraph",
  "p",
  "heading",
  "pre",
  "codeblock",
  "image",
  "spoiler",
]);

/**
 * Workaround for an upstream API bug: A list can be wrapped in a degenerate
 * "wrapper" list with a single <list-item>, whose only content is another <list>.
 * For example:
 *
 *   <list style="number">
 *     <list-item>
 *       <list style="number">...</list>   <!-- the real list -->
 *     </list-item>
 *   </list>
 *
 * This renders as a spurious marker ("1.") followed by a sub-list.
 * When this is detected, we skip the wrapper and just render the inner list as if the wrapper never existed
 *
 * Returns the inner <list> node, or null if `node` is not such a wrapper.
 */
function unwrapWrapperList(node: XmlElementNode): XmlElementNode | null {
  const items = node.children.filter(
    (c): c is XmlElementNode =>
      c.type === "element" && (c.tag === "li" || c.tag === "list-item"),
  );
  if (items.length !== 1) return null;
  const item = items[0];

  const innerLists = item.children.filter(
    (c): c is XmlElementNode => c.type === "element" && c.tag === "list",
  );
  if (innerLists.length !== 1) return null;

  // Only unwrap if there is no real content
  const hasOtherContent = item.children.some((c) => {
    if (c.type === "text") return c.value.trim().length > 0;
    if (c.type === "element") return c.tag !== "list";
    return false;
  });
  if (hasOtherContent) return null;

  return innerLists[0];
}

function renderListItem(
  item: XmlElementNode,
  keyPrefix: string,
  marker: string,
  childListDepth: number,
): React.ReactNode {
  const fragments: React.ReactNode[] = [];
  let markerPlaced = false;
  let i = 0;
  const kids = item.children;

  // Helper func to render the marker+content inside a single <Text>
  const placeMarkerOnInline = (inlineNodes: XmlNode[], k: string) => {
    const runs = collectInlineRuns(inlineNodes);
    fragments.push(
      <View key={k} className="flex-row">
        <Text className="font-display mr-1 dark:text-white">{marker}</Text>
        <Text className="font-display flex-1 dark:text-slate-100" selectable>
          {renderInlineRuns(runs, k)}
        </Text>
      </View>,
    );
    markerPlaced = true;
  };

  while (i < kids.length) {
    const child = kids[i];
    const isParagraph =
      child.type === "element" &&
      (child.tag === "paragraph" || child.tag === "p");
    const isBlock = child.type === "element" && LIST_BLOCK_TAGS.has(child.tag);

    // Leading <paragraph>: just attach the marker to its text
    // Most common
    if (!markerPlaced && isParagraph) {
      placeMarkerOnInline(child.children, `${keyPrefix}-m`);
      i++;
      continue;
    }

    // Leading inline content with no paragraph wrapper:
    // gather the inline siblings, then attach the marker to them.
    if (!markerPlaced && !isBlock) {
      const inlineNodes: XmlNode[] = [];
      while (i < kids.length) {
        const c = kids[i];
        if (c.type === "element" && LIST_BLOCK_TAGS.has(c.tag)) break;
        inlineNodes.push(c);
        i++;
      }
      placeMarkerOnInline(inlineNodes, `${keyPrefix}-m`);
      continue;
    }

    // Render any other (block) child below the marker line
    // e.g. a nested <list> or a subsequent
    fragments.push(
      renderXmlNode(child, `${keyPrefix}-blk-${i}`, childListDepth),
    );
    i++;
  }

  // Fallback: No inline content to attach the marker to (e.g. only a nested list).
  // Emit a bare marker so numbering stays consistent.
  if (!markerPlaced) {
    fragments.unshift(
      <Text
        key={`${keyPrefix}-marker`}
        className="font-display dark:text-white"
      >
        {marker}
      </Text>,
    );
  }

  return (
    <View key={keyPrefix} className="mb-1 ml-4">
      {fragments}
    </View>
  );
}

export function renderXmlNode(
  node: XmlNode,
  keyPrefix = "node",
  listDepth = 1,
): React.ReactNode {
  if (node.type === "text") {
    return <Text key={keyPrefix}>{node.value} </Text>;
  }

  if (node.type === "element" || node.type === "document") {
    const children = () =>
      node.children.map((child, i) =>
        renderXmlNode(child, `${keyPrefix}-${node.tag}-${i}`),
      );

    if (node.selfClosing && node.children.length === 0) {
      switch (node.tag) {
        case "break":
        case "br":
          return <Text key={keyPrefix}>{"\n"}</Text>;
        case "image": {
          const src = node.attrs.src;
          const imageWidth = node.attrs.width;
          const imageHeight = node.attrs.height;
          const calculatedAspectRatio =
            Number(imageWidth) / Number(imageHeight);

          if (src) {
            return (
              <Image
                key={keyPrefix}
                source={{ uri: src }}
                style={{
                  aspectRatio:
                    Number.isFinite(calculatedAspectRatio) &&
                    calculatedAspectRatio > 0
                      ? calculatedAspectRatio
                      : 1,
                }}
                className="my-2 w-full rounded-lg"
                resizeMethod="auto"
                resizeMode="contain"
              />
            );
          }
        }
      }

      return null;
    }

    switch (node.tag) {
      case "document":
        return (
          <View key={keyPrefix}>{renderBlockChildren(node, keyPrefix)}</View>
        );
      case "paragraph":
      case "p": {
        const runs = collectInlineRuns(node.children);
        return (
          <Text
            key={keyPrefix}
            className="font-display mb-2 dark:text-slate-100"
            selectable
          >
            {renderInlineRuns(runs, keyPrefix)}
          </Text>
        );
      }
      case "bold":
      case "b":
        return (
          <Text key={keyPrefix} className="font-display-bold">
            {children()}
          </Text>
        );
      case "italic":
      case "i":
        return (
          <Text key={keyPrefix} className="font-display italic">
            {children()}
          </Text>
        );
      case "code":
        return (
          <Text key={keyPrefix} className="rounded bg-gray-200 px-1 font-mono">
            {children()}
          </Text>
        );
      case "pre":
      case "codeblock":
        return (
          <View key={keyPrefix} className="my-2 rounded-lg bg-gray-200 p-3">
            <Text className="font-mono text-sm">{children()}</Text>
          </View>
        );
      case "list": {
        // API workaround: if this is a degenerate single-item wrapper list,
        // skip it and render the list it wraps at the same depth.
        const wrapper = unwrapWrapperList(node);
        if (wrapper) {
          return renderXmlNode(wrapper, keyPrefix, listDepth);
        }

        // Depth guard: Have not implemented horizontal scroll, and there is
        // not enough width, so past level 2 we punt to the site.
        if (listDepth > 2) {
          return (
            <Text
              key={keyPrefix}
              className="my-1 text-slate-500 italic dark:text-slate-400"
            >
              Nested lists beyond 2 levels aren't supported — please view this
              post on the website.
            </Text>
          );
        }
        // style="number" -> ordered ("1." marker), otherwise bullet ("•").
        const ordered = node.attrs.style === "number";
        let itemIndex = 0;
        return (
          <View key={keyPrefix} className="mb-2">
            {node.children.map((child, i) => {
              if (
                child.type === "element" &&
                (child.tag === "li" || child.tag === "list-item")
              ) {
                itemIndex += 1;
                const marker = ordered ? `${itemIndex}.` : "•";
                return renderListItem(
                  child,
                  `${keyPrefix}-li-${i}`,
                  marker,
                  listDepth + 1,
                );
              }
              // Non-item children (unexpected inside a list) render inline.
              return renderXmlNode(
                child,
                `${keyPrefix}-blk-${i}`,
                listDepth + 1,
              );
            })}
          </View>
        );
      }
      // Fallback for an <li>/<list-item> encountered outside a <list> (the
      // list case normally renders items itself via renderListItem).
      case "li":
      case "list-item":
        return (
          <View key={keyPrefix} className="mb-1 ml-2 flex-row">
            <Text className="font-display dark:text-white">• </Text>
            {children()}
          </View>
        );
      case "heading": {
        const level = Number(node.attrs.number) || 1;
        const clamped = Math.min(Math.max(level, 1), 4);
        const sizeClass = headingSizeClass(clamped);
        const runs = collectInlineRuns(node.children, {
          bold: true,
          heading: clamped,
        });
        return (
          <Text
            key={keyPrefix}
            className={`font-display-bold mb-1 ${sizeClass}`}
            selectable
          >
            {renderInlineRuns(runs, keyPrefix)}
          </Text>
        );
      }
      case "figure": {
        return <View key={keyPrefix}>{children()}</View>;
      }
      case "link": {
        return (
          <LinkText key={keyPrefix} href={node.attrs.href}>
            {children()}
          </LinkText>
        );
      }
      // <spoiler> is a block-level container (never nested inside a <paragraph>)
      // Currently, it only holds text + lists, this may change to support images, codeblocks etc.
      case "spoiler":
        return (
          <SpoilerText key={keyPrefix}>
            {renderBlockChildren(node, keyPrefix)}
          </SpoilerText>
        );
      case "math":
        return (
          <RaTeXView
            key={keyPrefix}
            latex={validateAndCleanLaTeX(
              (node.children[0] as XmlTextNode).value,
            )}
            fontSize={24}
            color="#1E88E5"
            onError={(e) => console.warn("LaTeX error:", e.nativeEvent.error)}
          />
        );
      default: {
        console.log("Unhandled Node Tag:", node.tag);
        return <React.Fragment key={keyPrefix}>{children()}</React.Fragment>;
      }
    }
  }

  return null;
}
