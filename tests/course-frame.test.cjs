const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const { act, create } = require("react-test-renderer");
const ts = require("typescript");

global.IS_REACT_ACT_ENVIRONMENT = true;

// Native gesture/layout delivery requires a device. Run the real component and
// React reconciler here, substituting only the native modules and sidebar data.
function fixture() {
  const layout = { courseId: 1, isWide: true, isFullscreen: false };
  const counts = {
    sidebar: 0,
    sidebarMounts: 0,
    navigatorMounts: 0,
    commits: 0,
  };
  const gestures = [];
  const scheduled = [];
  const insets = { left: 12, bottom: 16 };

  function Sidebar() {
    counts.sidebar++;
    React.useEffect(() => {
      counts.sidebarMounts++;
    }, []);
    return React.createElement("Sidebar");
  }

  function Navigator() {
    React.useEffect(() => {
      counts.navigatorMounts++;
    }, []);
    return React.createElement("Navigator");
  }

  function useSharedValue(initial) {
    return React.useState(() => {
      let value = initial;
      return {
        get: () => value,
        set: (next) => {
          value = next;
        },
      };
    })[0];
  }

  const mocks = {
    "react-native": {
      View: "View",
      Platform: { OS: "android" },
      PanResponder: { create: (handlers) => ({ panHandlers: handlers }) },
    },
    "react-native-safe-area-context": { useSafeAreaInsets: () => insets },
    "@/src/providers/courseLayoutProvider": { useCourseLayout: () => layout },
    "@/src/components/CourseThreadList": { __esModule: true, default: Sidebar },
    "react-native-gesture-handler": {
      GestureDetector: ({ children }) => children,
      Gesture: {
        Pan: () => {
          const handlers = {};
          const gesture = {};
          for (const name of ["onBegin", "onUpdate", "onFinalize"]) {
            gesture[name] = (handler) => {
              handlers[name] = handler;
              return gesture;
            };
          }
          gesture.enabled = (enabled) => {
            handlers.enabled = enabled;
            return gesture;
          };
          for (const name of ["minDistance", "maxPointers"]) {
            gesture[name] = () => gesture;
          }
          gestures.push(handlers);
          return gesture;
        },
      },
    },
    "react-native-reanimated": {
      __esModule: true,
      default: { View: "AnimatedView" },
      useSharedValue,
      useAnimatedStyle: (read) => ({ read }),
    },
    "react-native-worklets": {
      scheduleOnRN: (callback, ...args) =>
        scheduled.push(() => callback(...args)),
    },
  };
  const filename = path.resolve("src/components/CourseFrame.tsx");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      exports: module.exports,
      require: (name) => mocks[name] ?? require(name),
    },
    { filename },
  );
  const Frame = module.exports.default;
  const children = React.createElement(Navigator);
  const header = React.createElement("Header");
  let renderer;
  const render = () =>
    React.createElement(
      React.Profiler,
      {
        id: "frame",
        onRender: () => counts.commits++,
      },
      React.createElement(Frame, { header }, children),
    );
  act(() => {
    renderer = create(render());
  });

  const divider = () =>
    renderer.root.findByProps({ accessibilityRole: "adjustable" });
  const measure = (width) =>
    act(() => {
      renderer.root
        .findAllByType("View")
        .find((node) => node.props.onLayout)
        .props.onLayout({ nativeEvent: { layout: { width } } });
    });
  const begin = () =>
    act(() => {
      if (gestures.length) gestures.at(-1).onBegin();
      else divider().props.onPanResponderGrant();
    });
  const move = (dx) =>
    act(() => {
      if (gestures.length) gestures.at(-1).onUpdate({ translationX: dx });
      else divider().props.onPanResponderMove(null, { dx });
    });
  const finish = (success = true) =>
    act(() => {
      gestures.at(-1)?.onFinalize({}, success);
      while (scheduled.length) scheduled.shift()();
    });
  const fraction = () => {
    const pane = renderer.root.findByProps({
      className:
        "border-r border-gray-200 bg-white dark:border-neutral-700 dark:bg-black",
    });
    const styles = [pane.props.style].flat();
    const width = styles
      .map((style) => (style.read ? style.read().width : style.width))
      .find((value) => value !== undefined);
    return Math.round(Number.parseFloat(width) * 1e10) / 1e12;
  };
  return {
    counts,
    layout,
    measure,
    begin,
    move,
    finish,
    fraction,
    divider,
    gestureEnabled: () => gestures.at(-1).enabled,
    update: () => act(() => renderer.update(render())),
    close: () => act(() => renderer.unmount()),
  };
}

test("120 resize updates do not reconcile the frame or sidebar", (t) => {
  const f = fixture();
  t.after(f.close);
  f.measure(1000);
  const before = { ...f.counts };
  f.measure(900);
  f.measure(1000);
  assert.equal(f.counts.commits, before.commits);
  f.begin();
  for (let i = 1; i <= 120; i++) f.move(-i);
  const dragCommits = f.counts.commits - before.commits;
  const sidebarRenders = f.counts.sidebar - before.sidebar;
  t.diagnostic(JSON.stringify({ dragCommits, sidebarRenders }));
  assert.equal(dragCommits, 0);
  assert.equal(sidebarRenders, 0);
  assert.equal(f.fraction(), 0.28);
  f.finish();
  assert.equal(f.counts.commits - before.commits, 1);
  assert.equal(f.counts.sidebar - before.sidebar, 0);
  assert.equal(f.divider().props.accessibilityValue.now, 28);
});

test("resize bounds, repeated drags, cancellation and accessibility share the live size", (t) => {
  const f = fixture();
  t.after(f.close);
  f.begin();
  f.move(100);
  assert.equal(f.fraction(), 0.4, "ignore moves before layout is measured");
  f.finish();
  f.measure(1000);
  f.begin();
  f.move(-1000);
  assert.equal(f.fraction(), 0.2);
  f.finish(false);
  assert.equal(f.divider().props.accessibilityValue.now, 20);
  act(() =>
    f.divider().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    }),
  );
  assert.equal(f.fraction(), 0.25);
  f.measure(800);
  f.begin();
  f.move(80);
  assert.equal(f.fraction(), 0.35);
  f.move(1000);
  assert.equal(f.fraction(), 0.5);
  f.finish();
  act(() =>
    f.divider().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    }),
  );
  assert.equal(f.fraction(), 0.5);
  act(() =>
    f.divider().props.onAccessibilityAction({
      nativeEvent: { actionName: "decrement" },
    }),
  );
  assert.equal(f.fraction(), 0.45);
  assert.equal(f.divider().props.accessibilityValue.now, 45);
});

test("fullscreen and compact layouts preserve the navigator and resized pane", (t) => {
  const f = fixture();
  t.after(f.close);
  f.measure(1000);
  f.begin();
  f.move(-100);
  f.finish();
  f.layout.isFullscreen = true;
  f.update();
  assert.equal(f.divider().props.style.display, "none");
  assert.equal(f.gestureEnabled(), false);
  assert.equal(f.counts.sidebarMounts, 1);
  f.layout.isFullscreen = false;
  f.update();
  assert.equal(f.gestureEnabled(), true);
  assert.equal(f.divider().props.accessibilityValue.now, 30);
  assert.equal(f.fraction(), 0.3);
  f.layout.isWide = false;
  f.update();
  assert.equal(f.divider().props.style.display, "none");
  assert.equal(f.gestureEnabled(), false);
  f.layout.isWide = true;
  f.update();
  assert.equal(f.counts.navigatorMounts, 1);
  assert.equal(f.fraction(), 0.3);
  f.layout.courseId = 2;
  f.update();
  assert.equal(f.counts.sidebarMounts, 3);
  assert.equal(f.counts.navigatorMounts, 1);
});
