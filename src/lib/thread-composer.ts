import { XMLParser, XMLValidator } from "fast-xml-parser";

import type { ThreadDetail } from "@/src/lib/thread-detail";

export interface ThreadDraft {
  title: string;
  content: string;
  type: "question" | "post";
  category: string;
  subcategory: string;
  subsubcategory: string;
  isAnonymous: boolean;
}

export type ThreadDraftTarget =
  | { kind: "create"; courseId: number }
  | { kind: "edit"; courseId: number; threadId: number };

/** Unfinished drafts may contain invalid XML; validate their shape on read. */
export function isThreadDraft(value: unknown): value is ThreadDraft {
  return (
    !!value &&
    typeof value === "object" &&
    "title" in value &&
    typeof value.title === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "type" in value &&
    (value.type === "question" || value.type === "post") &&
    "category" in value &&
    typeof value.category === "string" &&
    "subcategory" in value &&
    typeof value.subcategory === "string" &&
    "subsubcategory" in value &&
    typeof value.subsubcategory === "string" &&
    "isAnonymous" in value &&
    typeof value.isAnonymous === "boolean"
  );
}

export interface UploadedThreadAttachment {
  kind: "file" | "image";
  url: string;
  filename: string;
}

export interface TextSelection {
  start: number;
  end: number;
}

export const EMPTY_THREAD_DRAFT: ThreadDraft = {
  title: "",
  content: "<document>\n<paragraph></paragraph>\n</document>",
  type: "question",
  category: "",
  subcategory: "",
  subsubcategory: "",
  isAnonymous: false,
};

export function draftFromThread(thread: ThreadDetail): ThreadDraft {
  if (thread.type !== "question" && thread.type !== "post") {
    throw new Error(`Editing thread type '${thread.type}' is not supported.`);
  }
  return {
    title: thread.title,
    content: thread.content,
    type: thread.type,
    category: thread.category,
    subcategory: thread.subcategory,
    subsubcategory: thread.subsubcategory,
    isAnonymous: thread.is_anonymous,
  };
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

const contentParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
});

function hasThreadContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasThreadContent);
  if (!value || typeof value !== "object") return false;
  for (const [tag, children] of Object.entries(value)) {
    if (tag === "#text" && typeof children === "string" && children.trim())
      return true;
    if (tag === "file" || tag === "image" || tag === "video") {
      const attributes = ":@" in value ? value[":@"] : null;
      if (attributes && typeof attributes === "object") {
        const url =
          "@_url" in attributes
            ? attributes["@_url"]
            : "@_src" in attributes
              ? attributes["@_src"]
              : null;
        if (typeof url === "string" && url.trim()) return true;
      }
    }
    if (tag !== ":@" && hasThreadContent(children)) return true;
  }
  return false;
}

export function validateThreadContent(content: string): string | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) {
    return "Document declarations and custom entities are not supported.";
  }
  const validation = XMLValidator.validate(content);
  if (validation !== true) {
    return `Line ${validation.err.line}: ${validation.err.msg}`;
  }
  if (!/^\s*<document(?:\s[^>]*)?>[\s\S]*<\/document>\s*$/.test(content)) {
    return "Content must have a single <document> root.";
  }
  const parsed: unknown = contentParser.parse(content);
  if (!hasThreadContent(parsed)) {
    return "Add some text, code, math, or an attachment.";
  }
  return null;
}

export function validateThreadDraft(draft: ThreadDraft): string | null {
  if (!draft.title.trim()) return "Add a thread title.";
  if (draft.subcategory && !draft.category)
    return "Choose a category before a subcategory.";
  if (draft.subsubcategory && !draft.subcategory)
    return "Choose a subcategory before a second subcategory.";
  return validateThreadContent(draft.content);
}

/** Selected source is already XML; only the fallback text needs escaping. */
export function wrapThreadSelection(
  content: string,
  selection: TextSelection,
  opening: string,
  closing: string,
  placeholder: string,
): { content: string; selection: TextSelection } {
  const start = Math.max(0, Math.min(selection.start, content.length));
  const end = Math.max(start, Math.min(selection.end, content.length));
  const text = content.slice(start, end) || escapeXml(placeholder);
  return {
    content:
      content.slice(0, start) + opening + text + closing + content.slice(end),
    selection: {
      start: start + opening.length,
      end: start + opening.length + text.length,
    },
  };
}

export function appendThreadBlock(content: string, block: string): string {
  const closing = content.lastIndexOf("</document>");
  if (closing < 0)
    throw new Error(
      "Restore the closing </document> tag before adding a block.",
    );
  return `${content.slice(0, closing).trimEnd()}\n${block}\n${content.slice(closing)}`;
}

export function threadAttachmentXml(
  attachment: UploadedThreadAttachment,
): string {
  if (!/^https:\/\/[^\s]+$/i.test(attachment.url)) {
    throw new Error("The upload must return a permanent HTTPS URL.");
  }
  if (!attachment.filename.trim())
    throw new Error("The upload must return a filename.");
  const url = escapeXml(attachment.url);
  const filename = escapeXml(attachment.filename);
  return attachment.kind === "image"
    ? `<image src="${url}" alt="${filename}" />`
    : `<file url="${url}" filename="${filename}" />`;
}
