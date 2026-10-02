# Thread composer

## Work plan

- [x] Ground: trace thread content, preview rendering, and submission boundaries.
- [x] Sketch: compare a native XML source composer with a WebView rich-text editor.
- [x] Agree: proceed with a source composer, without a user checkpoint.
- [x] Implement: formatting, preview, metadata, attachments, and save states.
- [x] Review: source editing preserves content without HTML conversion.

## Usage and contract

```tsx
<ThreadComposer
  key={thread?.id ?? "new"}
  mode={thread ? "edit" : "create"}
  initialValue={thread ? draftFromThread(thread) : undefined}
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

## Design decision

Thread detail loading reads `thread.content` as Ed XML, parses it with TurboXML,
and renders it with `renderXmlNode`. Code snippets already use Shiki and math uses
RaTeX. `thread.document` is a separate server value whose editing format is not
established in this repository. The composer must not guess its structure.

Candidate A uses React Native inputs for XML source and the existing native
renderer for preview. It preserves unknown tags and attributes when an existing
thread is opened and saved. Formatting commands own XML escaping and insertion.

Candidate B embeds a contenteditable document in WebView. It would provide visual
editing but needs HTML/Ed-XML conversion, selection messaging, and representations
for every server node. Without the server document contract, conversion could
silently lose content. Choose A for this first component. A future visual editor
can use the same draft and submission contracts once round-trip fixtures exist.

This is a source editor, not WYSIWYG. Block insertion adds a block at the end of
the document; inline formatting wraps the current selection. Preview renders
only on request, so parsing, math, and highlighting do not run on each keystroke.
Save validates XML before calling the adapter. Errors keep the draft intact.

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

- Composer tests run through the React reconciler with device modules substituted.
  They cover source preservation, malformed/empty XML, escaped code and math,
  undo/redo, attachment URLs, duplicate saves, stale preview responses, picker
  cancellation, partial upload failures, and aborting uploads on unmount.
- The real XML renderer is checked for inline code, highlights, and strike marks.
- Page tests cover new-thread navigation, fold/unfold transitions without editor
  remounts, draft resumption, draft isolation, and unsupported thread types.
- Lint and Android Metro bundling pass, including bundling the composer directly
  as an entry point so its new dependencies are included.
- TypeScript reports the repository's existing missing declarations for
  `@/global.css` imports. It reports no errors in the composer.
- Native rendering and file-picker interaction still need device verification.
  Adding `expo-document-picker` requires rebuilding the development client.

The file-picker adapter follows the [Expo SDK 57 document-picker API](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/).
XML validation uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser).
