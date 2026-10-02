const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { act, create } = require("react-test-renderer");
const ts = require("typescript");

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

async function fixture() {
  const viewport = { width: 380, height: 800 };
  const layout = {
    isWide: false,
    categories: { 7: "Homework" },
    scrollOffsets: { current: new Map() },
    setCategory() {},
    closeSidebarSearch() {},
  };
  const params = { courseid: "7" };
  const navigations = [];
  const stores = new Map();
  const router = {
    navigate: (route) => navigations.push(route),
    setParams: (next) => Object.assign(params, next),
  };
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "TextInput",
      "Modal",
      "Pressable",
      "ScrollView",
      "FlatList",
      "Switch",
      "ActivityIndicator",
      "Image",
      "KeyboardAvoidingView",
    ].map((name) => [name, name]),
  );
  native.Platform = { OS: "android" };
  native.useWindowDimensions = () => viewport;
  const model = load(path.resolve("src/lib/thread-composer.ts"));
  const storage = load(path.resolve("src/lib/storage.ts"), {
    "@/src/lib/thread-composer": model,
    "@/src/lib/schema": {},
    "react-native-mmkv": {
      createMMKV: ({ id }) => {
        const values = new Map();
        stores.set(id, values);
        return {
          set: (key, value) => values.set(key, value),
          getString: (key) => values.get(key),
          remove: (key) => values.delete(key),
          clearAll: () => values.clear(),
        };
      },
    },
    "expo-secure-store": { getItemAsync: async () => "encryption-key" },
    "expo-crypto": {},
  });
  await storage.initStorage();
  const base = {
    "react-native": native,
    "expo-router": {
      useRouter: () => router,
      useLocalSearchParams: () => params,
    },
    "@/src/lib/thread-composer": model,
    "@/src/lib/storage": storage,
    "@/src/providers/courseLayoutProvider": { useCourseLayout: () => layout },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
    },
  };
  const Composer = load(path.resolve("src/components/ThreadComposer.tsx"), {
    ...base,
    "expo-document-picker": {},
    "react-native-turboxml": {},
    "@/src/lib/renderXML": {},
  }).default;
  const Modal = load(path.resolve("src/components/ThreadComposerModal.tsx"), {
    ...base,
    "@/src/components/ThreadComposer": { __esModule: true, default: Composer },
  }).default;
  const actions = load(
    path.resolve("src/components/ThreadComposerActions.tsx"),
    {
      ...base,
      "@/src/components/ThreadComposerModal": {
        __esModule: true,
        default: Modal,
      },
    },
  );
  const List = load(path.resolve("src/components/CourseThreadList.tsx"), {
    ...base,
    "@/global.css": {},
    "phosphor-react-native": {},
    "@expo/vector-icons": {},
    uniwind: { useUniwind: () => ({ theme: "light" }) },
    "@/src/lib/schema": {},
    "@/src/hooks/useThreadsDbQuery": {
      useThreadsDbQuery: () => ({ pinnedThreads: [], regularThreads: [] }),
    },
    "@/src/hooks/useThreadsSync": {
      useThreadsSync: () => ({
        loading: false,
        refreshing: false,
        fetchMore() {},
        refresh() {},
      }),
    },
    "@/src/hooks/useSearchDbQuery": {
      useSearchDbQuery: () => ({ searchResults: [] }),
    },
    "@/src/hooks/useSearchSync": {
      useSearchSync: () => ({ isSearching: false }),
    },
    "@/src/providers/modalProvider": {
      useSearchQuery: () => ({
        searchQuery: null,
        searchCourseId: null,
        searchSort: "relevance",
      }),
    },
    "@/src/components/ThreadComposerActions": actions,
  }).default;
  const Page = load(path.resolve("app/courses/[courseid]/index.tsx"), {
    ...base,
    "@/src/components/CourseThreadList": { __esModule: true, default: List },
    "@/src/components/ThreadComposerActions": actions,
    "@/src/components/ThreadComposerModal": {
      __esModule: true,
      default: Modal,
    },
  }).default;
  const detail = {
    thread: {
      id: 41,
      title: "Original",
      type: "question",
      content: "<document><paragraph>Original</paragraph></document>",
      category: "General",
      subcategory: "",
      subsubcategory: "",
      is_anonymous: false,
      created_at: "2026-10-02",
      comments: [],
      answers: [],
    },
    usersMap: new Map(),
    parsedXmlMap: new Map(),
    loading: false,
    isHidden: false,
  };
  const ThreadPage = load(
    path.resolve("app/courses/[courseid]/[thread]/index.tsx"),
    {
      ...base,
      "@/global.css": {},
      "expo-linking": {},
      "phosphor-react-native": Object.fromEntries(
        [
          "EyeIcon",
          "HeartIcon",
          "StarIcon",
          "PushPinIcon",
          "CheckCircleIcon",
          "ArrowSquareOutIcon",
        ].map((name) => [name, name]),
      ),
      "@/src/lib/renderXML": { renderXmlNode: () => null },
      "@/src/providers/dbProvider": { useDb: () => ({}) },
      "@/src/hooks/useThreadDetail": { useThreadDetail: () => detail },
      "@/src/hooks/useThreadVotes": {
        useThreadVotes: () => ({
          commentVotes: new Map(),
          commentVoteCounts: new Map(),
        }),
      },
      "@/src/components/ThreadFullscreenButton": {
        __esModule: true,
        default: "FullscreenButton",
      },
      "@/src/components/ThreadComposerActions": actions,
      "@/src/components/ThreadComments": {
        AnimatedToggleIcon: "Vote",
        renderComment: () => null,
      },
    },
  ).default;
  let renderer;
  let component = Page;
  let props = {};
  const update = () =>
    act(() => {
      renderer.update(React.createElement(component, props));
    });
  const mount = (Component = Page, nextProps = {}) => {
    component = Component;
    props = nextProps;
    act(() => {
      renderer = create(React.createElement(component, props));
    });
  };
  const button = (label) =>
    renderer.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === label);
  const field = (label) =>
    renderer.root
      .findAllByType("TextInput")
      .find((node) => node.props.accessibilityLabel === label);
  const enter = (label, value) =>
    act(() => field(label).props.onChangeText(value));
  const press = async (label) =>
    act(async () => {
      await button(label).props.onPress();
    });
  const close = () => act(() => renderer.unmount());
  return {
    model,
    storage,
    stores,
    layout,
    viewport,
    params,
    navigations,
    actions,
    List,
    Modal,
    ThreadPage,
    detail,
    mount,
    update,
    enter,
    press,
    button,
    field,
    close,
    get renderer() {
      return renderer;
    },
  };
}

test("new-thread action works in the compact course page and wide sidebar", async () => {
  const f = await fixture();
  f.mount();
  await f.press("New thread");
  assert.equal(f.navigations[0].pathname, "/courses/[courseid]");
  assert.equal(f.navigations[0].params.courseid, "7");
  assert.equal(f.navigations[0].params.compose, "new");
  f.close();
  f.layout.isWide = true;
  f.mount(f.List, { courseId: 7, sidebar: true });
  await f.press("New thread");
  assert.equal(f.navigations.length, 2);
  f.close();
});

test("course composer keeps typed content through folding and resumes after closing", async () => {
  const f = await fixture();
  f.params.compose = "new";
  f.mount();
  assert.equal(f.field("Category").props.value, "Homework");
  f.enter("Thread title", "My unfinished question");
  f.enter("Thread content XML", "<document>unfinished");
  const composerInstance = f.renderer.root.findAllByType("Modal")[0];
  for (const wide of [true, false, true]) {
    f.layout.isWide = wide;
    f.viewport.width = wide ? 1100 : 380;
    f.update();
    assert.equal(f.field("Thread title").props.value, "My unfinished question");
    assert.equal(
      f.field("Thread content XML").props.value,
      "<document>unfinished",
    );
    assert.equal(f.renderer.root.findAllByType("Modal")[0], composerInstance);
  }
  await act(async () => composerInstance.props.onRequestClose());
  f.update();
  assert.equal(f.params.compose, undefined);
  assert.equal(f.renderer.root.findAllByType("Modal").length, 0);
  f.params.compose = "new";
  f.update();
  assert.equal(
    f.field("Thread content XML").props.value,
    "<document>unfinished",
  );
  assert.equal(f.button("Save draft").props.disabled, false);
  f.close();
});

test("edit action opens original content, saves a separate draft, and closes", async () => {
  const f = await fixture();
  const thread = {
    id: 41,
    title: "Original title",
    type: "question",
    content: "<document><paragraph>Original</paragraph></document>",
    category: "General",
    subcategory: "",
    subsubcategory: "",
    is_anonymous: true,
  };
  f.mount(f.actions.EditThreadButton, { courseId: 7, thread });
  await f.press("Edit thread");
  assert.equal(f.field("Thread title").props.value, thread.title);
  assert.equal(f.field("Thread content XML").props.value, thread.content);
  f.enter("Thread title", "Edited draft");
  await f.press("Save draft");
  assert.equal(f.renderer.root.findAllByType("Modal").length, 0);
  const stored = f.storage.getThreadComposerDraft({
    kind: "edit",
    courseId: 7,
    threadId: 41,
  });
  assert.equal(stored.title, "Edited draft");
  assert.equal(thread.title, "Original title");
  assert.equal(
    f.storage.getThreadComposerDraft({ kind: "create", courseId: 7 }),
    null,
  );
  assert.equal(
    f.storage.getThreadComposerDraft({
      kind: "edit",
      courseId: 7,
      threadId: 42,
    }),
    null,
  );
  assert.equal(
    f.storage.getThreadComposerDraft({
      kind: "edit",
      courseId: 8,
      threadId: 41,
    }),
    null,
  );
  await f.press("Edit thread");
  assert.equal(f.field("Thread title").props.value, "Edited draft");
  f.close();
});

test("unsupported thread types do not offer editing", async () => {
  const f = await fixture();
  f.mount(f.actions.EditThreadButton, {
    courseId: 7,
    thread: { type: "announcement" },
  });
  assert.equal(f.button("Edit thread"), undefined);
  f.close();
});

test("thread-page navigation closes the old editor and hidden threads cannot be edited", async () => {
  const f = await fixture();
  f.params.thread = "1";
  f.mount(f.ThreadPage);
  await f.press("Edit thread");
  f.enter("Thread title", "First thread's draft");
  f.params.thread = "2";
  f.detail.thread = { ...f.detail.thread, id: 42, title: "Second thread" };
  f.update();
  assert.equal(f.renderer.root.findAllByType("Modal").length, 0);
  await f.press("Edit thread");
  assert.equal(f.field("Thread title").props.value, "Second thread");
  await f.press("Close");
  f.detail.isHidden = true;
  f.update();
  assert.equal(f.button("Edit thread"), undefined);
  f.close();
});

test("corrupt draft data is discarded and unfinished XML can still be restored", async () => {
  const f = await fixture();
  const target = { kind: "create", courseId: 7 };
  const values = f.stores.get("threadCache");
  for (const raw of [
    "not json",
    JSON.stringify({ ...f.model.EMPTY_THREAD_DRAFT, isAnonymous: "false" }),
    JSON.stringify({ ...f.model.EMPTY_THREAD_DRAFT, content: 1 }),
  ]) {
    values.set("thread-draft-7-new", raw);
    assert.equal(f.storage.getThreadComposerDraft(target), null);
    assert.equal(values.has("thread-draft-7-new"), false);
  }
  f.storage.saveThreadComposerDraft(target, {
    ...f.model.EMPTY_THREAD_DRAFT,
    content: "<document>unfinished",
  });
  assert.equal(
    f.storage.getThreadComposerDraft(target).content,
    "<document>unfinished",
  );
});
