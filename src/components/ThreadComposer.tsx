import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import ThreadRichEditor, {
  type ThreadEditorFormat,
  type ThreadRichEditorHandle,
} from "./ThreadRichEditor";

import {
  EMPTY_THREAD_DRAFT,
  appendThreadBlock,
  escapeXml,
  threadAttachmentXml,
  validateThreadXml,
  validateThreadCategories,
  threadSubcategories,
  threadSubsubcategories,
  type ThreadCourseCategory,
  validateThreadDraft,
  wrapThreadSelection,
  type TextSelection,
  type ThreadDraft,
  type UploadedThreadAttachment,
} from "@/src/lib/thread-composer";

export interface ThreadComposerProps {
  mode: "create" | "edit";
  courseCategories: readonly ThreadCourseCategory[];
  initialValue?: ThreadDraft;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (draft: ThreadDraft) => Promise<void>;
  onCancel: () => void;
  onDraftChange?: (draft: ThreadDraft) => void;
  onUploadAttachment?: (
    file: DocumentPicker.DocumentPickerAsset,
    signal: AbortSignal,
  ) => Promise<UploadedThreadAttachment>;
}

type InsertKind =
  | "paragraph"
  | "heading"
  | "list"
  | "numbered-list"
  | "code"
  | "math"
  | "link"
  | "spoiler"
  | "callout";
const INPUT_CLASS =
  "font-display rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-slate-100";

function Button({
  label,
  accessibilityLabel = label,
  onPress,
  disabled = false,
  selected = false,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 justify-center rounded-lg border px-3 py-2 ${selected ? "border-purple-700 bg-purple-100 dark:bg-purple-950" : "border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900"} ${disabled ? "opacity-40" : ""}`}
    >
      <Text className="font-display text-sm text-gray-900 dark:text-slate-100">
        {label}
      </Text>
    </Pressable>
  );
}

function CategoryChoices({
  label,
  options,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  options: readonly { readonly name: string }[];
  value: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="font-display text-gray-600 dark:text-slate-300">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {["", ...options.map((option) => option.name)].map((name) => (
          <Button
            key={name}
            label={name || "None"}
            accessibilityLabel={`${label}: ${name || "None"}`}
            selected={value === name}
            disabled={disabled}
            onPress={() => onSelect(name)}
          />
        ))}
      </View>
    </View>
  );
}

/** Mount with a new key when switching threads; initialValue is read once. */
export default function ThreadComposer({
  mode,
  courseCategories,
  initialValue = EMPTY_THREAD_DRAFT,
  submitLabel,
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  onDraftChange,
  onUploadAttachment,
}: ThreadComposerProps) {
  const [draft, setDraft] = useState(() => ({ ...initialValue }));
  const draftRef = useRef(draft);
  const past = useRef<ThreadDraft[]>([]);
  const future = useRef<ThreadDraft[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState({
    undo: false,
    redo: false,
  });
  const input = useRef<TextInput>(null);
  const initialCursor = Math.max(
    0,
    initialValue.content.indexOf("<paragraph>") + "<paragraph>".length,
  );
  const [selection, setSelection] = useState<TextSelection>({
    start: initialCursor,
    end: initialCursor,
  });
  const selectionRef = useRef(selection);
  const [editorView, setEditorView] = useState<"preview" | "source">("preview");
  const richEditor = useRef<ThreadRichEditorHandle>(null);
  const [operation, setOperation] = useState<"idle" | "saving" | "attaching">(
    "idle",
  );
  const operationRef = useRef(operation);
  const [error, setError] = useState<string | null>(null);
  const [insertKind, setInsertKind] = useState<InsertKind | null>(null);
  const [insertText, setInsertText] = useState("");
  const [language, setLanguage] = useState("py");
  const [linkUrl, setLinkUrl] = useState("");
  const mounted = useRef(true);
  const uploadController = useRef<AbortController | null>(null);
  const subcategories = threadSubcategories(courseCategories, draft.category);
  const subsubcategories = threadSubsubcategories(
    courseCategories,
    draft.category,
    draft.subcategory,
  );
  const busy = operation !== "idle";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      uploadController.current?.abort();
    };
  }, []);

  function change(next: ThreadDraft, recordHistory = true) {
    if (recordHistory) {
      past.current = [...past.current.slice(-99), draftRef.current];
      future.current = [];
    }
    draftRef.current = next;
    setDraft(next);
    setHistoryAvailable({
      undo: past.current.length > 0,
      redo: future.current.length > 0,
    });
    setError(null);
    onDraftChange?.(next);
  }

  function moveHistory(direction: "undo" | "redo") {
    const source = direction === "undo" ? past : future;
    const destination = direction === "undo" ? future : past;
    const next = source.current.pop();
    if (!next) return;
    destination.current.push(draftRef.current);
    change(next, false);
    setSelection({ start: 0, end: 0 });
    selectionRef.current = { start: 0, end: 0 };
  }

  function format(tag: ThreadEditorFormat, attributes = "") {
    if (editorView === "preview") {
      richEditor.current?.format(tag);
      return;
    }
    const result = wrapThreadSelection(
      draftRef.current.content,
      selectionRef.current,
      `<${tag}${attributes}>`,
      `</${tag}>`,
      "text",
    );
    change({ ...draftRef.current, content: result.content });
    selectionRef.current = result.selection;
    setSelection(result.selection);
    input.current?.focus();
  }

  function openInsert(kind: InsertKind) {
    setInsertKind(kind);
    setInsertText("");
    setLinkUrl("");
    setError(null);
  }

  async function insert() {
    if (!insertKind || !insertText.trim()) {
      setError("Enter content to insert.");
      return;
    }
    const text = escapeXml(insertText);
    let block: string;
    switch (insertKind) {
      case "paragraph":
        block = `<paragraph>${text}</paragraph>`;
        break;
      case "heading":
        block = `<heading number="2">${text}</heading>`;
        break;
      case "list":
      case "numbered-list":
        block = `<list style="${insertKind === "list" ? "bullet" : "number"}">${insertText
          .split("\n")
          .filter((line) => line.trim())
          .map(
            (line) =>
              `<list-item><paragraph>${escapeXml(line)}</paragraph></list-item>`,
          )
          .join("")}</list>`;
        break;
      case "code":
        block = `<snippet language="${escapeXml(language.trim() || "txt")}" line-numbers="true"><snippet-file>${text}</snippet-file></snippet>`;
        break;
      case "math":
        block = `<math>${text}</math>`;
        break;
      case "link":
        if (!/^https?:\/\/[^\s]+$/i.test(linkUrl.trim())) {
          setError("Enter an HTTP or HTTPS link.");
          return;
        }
        block = `<paragraph><link href="${escapeXml(linkUrl.trim())}">${text}</link></paragraph>`;
        break;
      case "spoiler":
        block = `<spoiler><paragraph>${text}</paragraph></spoiler>`;
        break;
      case "callout":
        block = `<callout type="info">${text}</callout>`;
        break;
    }
    try {
      await flushPreview();
      change({
        ...draftRef.current,
        content: appendThreadBlock(draftRef.current.content, block),
      });
      setInsertKind(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to insert content.",
      );
    }
  }

  function showPreview() {
    const invalid = validateThreadXml(draftRef.current.content);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setEditorView("preview");
  }

  async function flushPreview() {
    if (editorView !== "preview") return;
    if (!richEditor.current)
      throw new Error("The editor is still loading. Please try again.");
    const content = await richEditor.current.flush();
    if (content !== draftRef.current.content)
      change({ ...draftRef.current, content });
  }

  async function showSource() {
    try {
      await flushPreview();
      setEditorView("source");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to open source.",
      );
    }
  }

  async function attachFiles() {
    if (!onUploadAttachment || operationRef.current !== "idle") return;
    operationRef.current = "attaching";
    setOperation("attaching");
    setError(null);
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      // Open directly from a press so the browser permits the system picker.
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !mounted.current) return;
      for (const file of result.assets) {
        if (controller.signal.aborted) return;
        const attachment = await onUploadAttachment(file, controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        change({
          ...draftRef.current,
          content: appendThreadBlock(
            draftRef.current.content,
            threadAttachmentXml(attachment),
          ),
        });
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to attach the file. Try again.",
        );
    } finally {
      uploadController.current = null;
      operationRef.current = "idle";
      if (mounted.current) setOperation("idle");
    }
  }

  async function submit() {
    if (operationRef.current !== "idle") return;
    operationRef.current = "saving";
    setOperation("saving");
    setError(null);
    try {
      await flushPreview();
      const invalid =
        validateThreadDraft(draftRef.current) ??
        validateThreadCategories(draftRef.current, courseCategories);
      if (invalid) {
        setError(invalid);
        return;
      }
      await onSubmit({
        ...draftRef.current,
        title: draftRef.current.title.trim(),
      });
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save the thread. Your draft is still here.",
        );
    } finally {
      operationRef.current = "idle";
      if (mounted.current) setOperation("idle");
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-black"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <Text className="font-display-bold text-2xl text-gray-900 dark:text-slate-100">
          {mode === "create" ? "Create thread" : "Edit thread"}
        </Text>
        <TextInput
          accessibilityLabel="Thread title"
          placeholder="Thread title"
          placeholderTextColor="#9ca3af"
          className={INPUT_CLASS}
          value={draft.title}
          editable={!busy}
          onChangeText={(title) => change({ ...draftRef.current, title })}
        />
        <View className="flex-row flex-wrap gap-2">
          {(["question", "post"] as const).map((type) => (
            <Button
              key={type}
              label={type === "question" ? "Question" : "Post"}
              disabled={busy}
              selected={draft.type === type}
              onPress={() => change({ ...draftRef.current, type })}
            />
          ))}
        </View>
        <View className="gap-2">
          <CategoryChoices
            label="Category"
            options={courseCategories}
            value={draft.category}
            disabled={busy}
            onSelect={(category) =>
              change({
                ...draftRef.current,
                category,
                subcategory: "",
                subsubcategory: "",
              })
            }
          />
          {subcategories.length > 0 && (
            <CategoryChoices
              label="Subcategory"
              options={subcategories}
              value={draft.subcategory}
              disabled={busy}
              onSelect={(subcategory) =>
                change({ ...draftRef.current, subcategory, subsubcategory: "" })
              }
            />
          )}
          {subsubcategories.length > 0 && (
            <CategoryChoices
              label="Second subcategory"
              options={subsubcategories}
              value={draft.subsubcategory}
              disabled={busy}
              onSelect={(subsubcategory) =>
                change({ ...draftRef.current, subsubcategory })
              }
            />
          )}
          {courseCategories.length === 0 && (
            <Text className="font-display text-sm text-gray-500 dark:text-slate-400">
              No course categories are available.
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-gray-900 dark:text-slate-100">
            Post anonymously
          </Text>
          <Switch
            accessibilityLabel="Post anonymously"
            disabled={busy}
            value={draft.isAnonymous}
            onValueChange={(isAnonymous) =>
              change({ ...draftRef.current, isAnonymous })
            }
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {__DEV__ && (
            <Button
              label="Source"
              disabled={busy}
              selected={editorView === "source"}
              onPress={showSource}
            />
          )}
          <Button
            label="Preview"
            disabled={busy}
            selected={editorView === "preview"}
            onPress={showPreview}
          />
          <Button
            label="Undo"
            disabled={busy || !historyAvailable.undo}
            onPress={() => moveHistory("undo")}
          />
          <Button
            label="Redo"
            disabled={busy || !historyAvailable.redo}
            onPress={() => moveHistory("redo")}
          />
        </View>
        <>
          {editorView === "source" && (
            <Text className="font-display text-sm text-gray-500 dark:text-slate-400">
              Edit Ed XML, or switch to Preview to edit the formatted content.
            </Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            {(
              [
                { label: "Bold", tag: "bold" },
                { label: "Italic", tag: "italic" },
                { label: "Underline", tag: "underline" },
                { label: "Strike", tag: "strikethrough" },
                { label: "Inline code", tag: "code" },
                { label: "Highlight", tag: "mark" },
              ] satisfies { label: string; tag: ThreadEditorFormat }[]
            ).map(({ label, tag }) => (
              <Button
                key={tag}
                label={label}
                disabled={busy}
                onPress={() => format(tag)}
              />
            ))}
          </View>
          {editorView === "source" && __DEV__ ? (
            <TextInput
              ref={input}
              accessibilityLabel="Thread content XML"
              className="min-h-64 rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-slate-100"
              style={{ textAlignVertical: "top" }}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              editable={!busy}
              value={draft.content}
              selection={selection}
              onSelectionChange={(event) => {
                selectionRef.current = event.nativeEvent.selection;
                setSelection(event.nativeEvent.selection);
              }}
              onChangeText={(content) =>
                change({ ...draftRef.current, content })
              }
            />
          ) : (
            <ThreadRichEditor
              ref={richEditor}
              content={draft.content}
              editable={!busy}
              onChange={(content) => change({ ...draftRef.current, content })}
              onError={setError}
            />
          )}
          <View className="flex-row flex-wrap gap-2">
            {(
              [
                { kind: "paragraph", label: "Paragraph" },
                { kind: "heading", label: "Heading" },
                { kind: "list", label: "Bullet list" },
                { kind: "numbered-list", label: "Numbered list" },
                { kind: "code", label: "Code block" },
                { kind: "math", label: "LaTeX" },
                { kind: "link", label: "Link" },
                { kind: "spoiler", label: "Spoiler" },
                { kind: "callout", label: "Callout" },
              ] satisfies { kind: InsertKind; label: string }[]
            ).map(({ kind, label }) => (
              <Button
                key={kind}
                label={label}
                disabled={busy}
                onPress={() => openInsert(kind)}
              />
            ))}
            <Button
              label={
                operation === "attaching"
                  ? "Attaching files…"
                  : "Add files or images"
              }
              disabled={busy || !onUploadAttachment}
              onPress={attachFiles}
            />
          </View>
          {!onUploadAttachment && (
            <Text className="font-display text-sm text-gray-500 dark:text-slate-400">
              File attachments require an upload connection.
            </Text>
          )}
        </>
        {insertKind && (
          <View className="gap-3 rounded-xl border border-purple-300 p-3 dark:border-purple-800">
            <Text className="font-display-bold text-gray-900 dark:text-slate-100">
              Add {insertKind.replaceAll("-", " ")} at the end of the document
            </Text>
            {insertKind === "code" && (
              <TextInput
                accessibilityLabel="Code language"
                className={INPUT_CLASS}
                value={language}
                onChangeText={setLanguage}
                editable={!busy}
                autoCapitalize="none"
                placeholder="Language, e.g. py, js, ts, java"
              />
            )}
            {insertKind === "link" && (
              <TextInput
                accessibilityLabel="Link URL"
                className={INPUT_CLASS}
                value={linkUrl}
                onChangeText={setLinkUrl}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://…"
              />
            )}
            <TextInput
              accessibilityLabel="Block content"
              className={INPUT_CLASS}
              style={{ minHeight: 100, textAlignVertical: "top" }}
              multiline
              value={insertText}
              onChangeText={setInsertText}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={
                insertKind === "math"
                  ? "\\frac{a}{b}"
                  : insertKind.includes("list")
                    ? "One item per line"
                    : "Content"
              }
              placeholderTextColor="#9ca3af"
            />
            <View className="flex-row gap-2">
              <Button label="Insert block" disabled={busy} onPress={insert} />
              <Button
                label="Dismiss insertion"
                disabled={busy}
                onPress={() => setInsertKind(null)}
              />
            </View>
          </View>
        )}
        {error && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="font-display text-red-700 dark:text-red-400"
          >
            {error}
          </Text>
        )}
        {busy && (
          <ActivityIndicator
            accessibilityLabel={
              operation === "saving" ? "Saving thread" : "Uploading attachments"
            }
            color="#70069e"
          />
        )}
        <View className="flex-row flex-wrap gap-3">
          <Button
            label={
              operation === "saving"
                ? "Saving…"
                : (submitLabel ??
                  (mode === "create" ? "Create thread" : "Save changes"))
            }
            disabled={busy}
            onPress={submit}
          />
          <Button label={cancelLabel} disabled={busy} onPress={onCancel} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
