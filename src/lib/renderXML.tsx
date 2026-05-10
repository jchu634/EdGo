import { View, Text, Image } from "react-native";
import React from "react";
import LinkText from "@/src/components/LinkText";

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

function isInlineTag(tag: string): boolean {
  return [
    "bold",
    "b",
    "italic",
    "i",
    "underline",
    "u",
    "link",
    "br",
    "break",
  ].includes(tag);
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
      return collectInlineRuns(node.children, {
        ...marks,
        href: node.attrs.href,
      });
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

type TextBlockNode = XmlElementNode & { _blockTag?: string };

function collectMergedBlockRuns(blocks: TextBlockNode[]): InlineRun[] {
  const allRuns: InlineRun[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) {
      const prevIsHeading = blocks[i - 1]._blockTag === "heading";
      const curIsHeading = blocks[i]._blockTag === "heading";
      if (curIsHeading) {
        allRuns.push({ kind: "newline" });
        allRuns.push({ kind: "newline" });
      } else if (!prevIsHeading) {
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
    if (run.marks.bold) classNames.push("font-display-bold");
    if (run.marks.italic) classNames.push("italic");
    if (run.marks.underline) classNames.push("underline");
    if (run.marks.code)
      classNames.push("rounded", "bg-gray-200", "px-1", "font-mono");
    if (run.marks.heading) classNames.push(headingSizeClass(run.marks.heading));

    const className = classNames.join(" ");

    if (run.marks.href) {
      return (
        <LinkText key={k} href={run.marks.href}>
          {run.text}
        </LinkText>
      );
    }

    if (className) {
      return (
        <Text key={k} className={className}>
          {run.text}
        </Text>
      );
    }

    return <React.Fragment key={k}>{run.text}</React.Fragment>;
  });
}

const USE_LEGACY_RENDER = false;

function renderXmlNodeLegacy(
  node: XmlNode,
  keyPrefix = "node",
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
      if (node.tag === "break" || node.tag === "br") {
        return <Text key={keyPrefix}>{"\n"}</Text>;
      }
      return null;
    }

    switch (node.tag) {
      case "document":
        return <React.Fragment key={keyPrefix}>{children()}</React.Fragment>;
      case "paragraph":
      case "p":
        return (
          <Text key={keyPrefix} className="font-display mb-2">
            {children()}{" "}
          </Text>
        );
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
          <Text
            key={keyPrefix}
            className="font-display rounded bg-gray-200 px-1 font-mono"
          >
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
      case "list":
        return (
          <View key={keyPrefix} className="mb-2 ml-2">
            {children()}
          </View>
        );
      case "li":
      case "listitem":
        return (
          <View key={keyPrefix} className="mb-1 ml-2 flex-row">
            <Text className="font-display">• </Text>
            <View className="flex-1">{children()}</View>
          </View>
        );
      case "heading":
        return (
          <Text key={keyPrefix} className="font-display-bold mb-1 text-lg">
            {children()}
          </Text>
        );
      case "image": {
        const src = node.attrs.src || node.attrs.url;
        if (src) {
          return (
            <Image
              key={keyPrefix}
              source={{ uri: src }}
              className="my-2 h-40 w-full rounded-lg"
              resizeMode="contain"
            />
          );
        }
        return null;
      }
      case "link": {
        return (
          <LinkText key={keyPrefix} href={node.attrs.href}>
            {children()}
          </LinkText>
        );
      }
      default:
        return <React.Fragment key={keyPrefix}>{children()}</React.Fragment>;
    }
  }

  return null;
}

export function renderXmlNode(
  node: XmlNode,
  keyPrefix = "node",
): React.ReactNode {
  if (USE_LEGACY_RENDER) return renderXmlNodeLegacy(node, keyPrefix);

  if (node.type === "text") {
    return <Text key={keyPrefix}>{node.value} </Text>;
  }

  if (node.type === "element" || node.type === "document") {
    const children = () =>
      node.children.map((child, i) =>
        renderXmlNode(child, `${keyPrefix}-${node.tag}-${i}`),
      );

    if (node.selfClosing && node.children.length === 0) {
      if (node.tag === "break" || node.tag === "br") {
        return <Text key={keyPrefix}>{"\n"}</Text>;
      }
      return null;
    }

    switch (node.tag) {
      case "document": {
        const fragments: React.ReactNode[] = [];
        let blockBuffer: TextBlockNode[] = [];
        let groupIdx = 0;

        const flushBuffer = () => {
          if (blockBuffer.length === 0) return;
          const runs = collectMergedBlockRuns(blockBuffer);
          fragments.push(
            <Text
              key={`${keyPrefix}-pg-${groupIdx}`}
              className="font-display mb-2"
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
            fragments.push(renderXmlNode(child, `${keyPrefix}-doc-${i}`));
          }
        });
        flushBuffer();

        return <React.Fragment key={keyPrefix}>{fragments}</React.Fragment>;
      }
      case "paragraph":
      case "p": {
        const runs = collectInlineRuns(node.children);
        return (
          <Text key={keyPrefix} className="font-display mb-2" selectable>
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
          <Text
            key={keyPrefix}
            className="font-display rounded bg-gray-200 px-1 font-mono"
          >
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
      case "list":
        return (
          <View key={keyPrefix} className="mb-2 ml-2">
            {children()}
          </View>
        );
      case "li":
      case "listitem":
        return (
          <View key={keyPrefix} className="mb-1 ml-2 flex-row">
            <Text className="font-display">• </Text>
            <View className="flex-1">
              {"TEST"}
              {children()}
            </View>
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
      case "image": {
        const src = node.attrs.src || node.attrs.url;
        if (src) {
          return (
            <Image
              key={keyPrefix}
              source={{ uri: src }}
              className="my-2 h-40 w-full rounded-lg"
              resizeMode="contain"
            />
          );
        }
        return null;
      }
      case "link": {
        return (
          <LinkText key={keyPrefix} href={node.attrs.href}>
            {children()}
          </LinkText>
        );
      }
      default:
        return <React.Fragment key={keyPrefix}>{children()}</React.Fragment>;
    }
  }

  return null;
}
