# Thread composer

## Usage and contract

```tsx
<ThreadComposer
  key={thread?.id ?? "new"}
  mode={thread ? "edit" : "create"}
  initialValue={thread ? draftFromThread(thread) : undefined}
  courseCategories={getCachedCourseCategory(courseId) ?? []}
  onDraftChange={persistLocalDraft}
  onUploadAttachment={uploadFile}
  onSubmit={saveThread}
  onCancel={closeComposer}
/>
```

`ThreadDraft` owns title, XML content, question/post type, the three category
levels, and anonymous posting. `onSubmit` receives a validated draft and resolves
only after a successful save. The parent owns API calls, permissions, routing,
draft persistence, and closing the composer. It must confirm discarding edits in
`onCancel` if needed. Use a different React key when switching threads; changing
`initialValue` does not overwrite an active draft.

`onUploadAttachment` receives a cached Expo document-picker asset and an abort
signal. It must upload the file and return a permanent HTTPS URL, filename, and
`file` or `image` kind. Local URIs never enter the saved content. Existing
attachments remain in the original XML. Removing their XML removes them from the
post; the composer does not delete remote files. Without an upload adapter, the
attachment button is disabled and explains why.

## Visual editing

Preview is the default and supports typing and inline formatting. Source is
available only in debug builds through `__DEV__`. Adding a block appends it to the
document. Equations and code blocks have edit controls in Preview. Math uses
native RaTeX views, and code uses the existing Shiki highlighter.

`ThreadRichEditor` embeds a local contenteditable document in WebView. It parses
Ed XML as data and maps supported text nodes to editable HTML. Unknown nodes and
existing attachments retain their XML as indivisible blocks. Untouched content
returns the original XML string; visual edits retain root attributes, comments,
and unsupported nodes. Incoming XML never becomes executable HTML.

Equation areas report their positions to React Native. `RaTeXView` draws over
these areas without intercepting touches, and its measured height updates the
space reserved in the document. Layout messages run once per animation frame
and skip unchanged positions. Native equations hide while an editor dialog is
open so they cannot draw over it. Parsing failures display the original LaTeX.

Saving and opening Source flush the WebView before reading the draft. Flushing
also applies changes in an open equation or code dialog. Undo and redo use the
composer's draft history in both views. Invalid XML keeps its original content
and displays an error. Debug Source can repair an unfinished XML draft.

`courseCategories` supplies the course's configured choices. Nested choices
appear for the selected parent, and changing a parent clears its descendants.
Save rejects categories outside this tree. The course schema retains the nested
category fields when courses are fetched and cached. Existing caches that stored
only top-level names need a course refresh to obtain nested choices.

## Page integration

The course page and its wide-layout sidebar have a `New thread` action. It opens
the course page with `compose=new`, which presents `ThreadComposerModal`. New
drafts start with the selected course category. The modal sits outside the
compact/wide content branch, so folding the device does not remount the editor.

Question and post pages have an `Edit thread` action. It loads the current
thread's XML and metadata, or resumes its stored draft. Hidden threads and
unsupported thread types do not show the edit action. The edit action is keyed by
course and thread ID so changing threads closes the previous editor.

These page actions save local drafts only. The modal states this and labels the
submit button `Save draft`. It persists changes in encrypted MMKV storage,
separately for new threads in each course and edits of each thread. Closing the
modal retains even unfinished XML. Clearing the thread cache also clears these
drafts. Neither action changes the cached original thread or publishes to Ed.
File uploads remain disabled until an upload adapter is provided.

`ThreadComposer` accepts optional `submitLabel` and `cancelLabel` props so a
parent can label local save and close actions accurately.

## Integration still needed

- Verify Ed's create/edit endpoints and the `document` payload contract.
- Implement file upload and course-specific posting permission checks.
- Device-test keyboard selection, picking files, LaTeX, and syntax highlighting.

The component itself does not publish posts until a parent supplies `onSubmit`.

## Validation

`pnpm test` checks category hierarchy validation, debug-only Source, editable
Preview defaults, save errors, XML validation, block insertion, undo/redo,
attachments, and page draft persistence through folding.

`tests/thread-editor-browser.cjs` exports a browser verification function. Run it
against the actual `THREAD_EDITOR_HTML` document.
It checks visual typing and formatting, XML preservation, code and equation
editing, native equation positioning and measurements, pending-dialog flush,
readonly state, and invalid XML recovery.

Android Metro bundling and lint pass. TypeScript still reports the repository's
existing missing declarations for `@/global.css`; the composer has no type
errors. Native keyboard, selection, and file-picker behavior still need device
verification. Adding `expo-document-picker` requires rebuilding the development
client.

The file-picker adapter follows the [Expo SDK 57 document-picker API](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/).
XML validation uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser).
