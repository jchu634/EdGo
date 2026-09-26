import { useMemo, useRef, useState } from "react";
import { PanResponder, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";
import CourseThreadList from "@/src/components/CourseThreadList";

export default function CourseFrame({
  children,
  header,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
}) {
  const { courseId, isWide, isFullscreen } = useCourseLayout();
  const insets = useSafeAreaInsets();
  const showCourseLayout = isWide && courseId !== null;
  const [paneWidth, setPaneWidth] = useState(0);
  const [sidebarFraction, setSidebarFraction] = useState(0.4);
  const currentFraction = useRef(0.4);
  const dragStartFraction = useRef(0.4);

  function resizeSidebar(fraction: number) {
    const clamped = Math.min(0.5, Math.max(0.2, fraction));
    currentFraction.current = clamped;
    setSidebarFraction(clamped);
  }

  const dividerGesture = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- PanResponder stores these callbacks; refs are only read during gestures.
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartFraction.current = currentFraction.current;
        },
        onPanResponderMove: (_, gesture) => {
          if (paneWidth > 0) {
            resizeSidebar(dragStartFraction.current + gesture.dx / paneWidth);
          }
        },
      }),
    [paneWidth],
  );

  return (
    <View style={{ flex: 1 }}>
      {showCourseLayout && header}
      <View
        style={{ flex: 1, flexDirection: "row" }}
        onLayout={(event) => setPaneWidth(event.nativeEvent.layout.width)}
      >
        {showCourseLayout && (
          <View
            className="border-r border-gray-200 bg-white dark:border-neutral-700 dark:bg-black"
            style={{
              display: isFullscreen ? "none" : "flex",
              width: `${sidebarFraction * 100}%`,
              paddingLeft: insets.left,
              paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
            }}
          >
            <CourseThreadList key={courseId} courseId={courseId} sidebar />
          </View>
        )}
        {showCourseLayout && !isFullscreen && (
          <View
            {...dividerGesture.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Course pane width"
            accessibilityHint="Drag left or right to resize the course pane"
            accessibilityValue={{
              min: 20,
              max: 50,
              now: Math.round(sidebarFraction * 100),
              text: `${Math.round(sidebarFraction * 100)} percent`,
            }}
            accessibilityActions={[
              { name: "increment", label: "Widen course pane" },
              { name: "decrement", label: "Narrow course pane" },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "increment")
                resizeSidebar(currentFraction.current + 0.05);
              if (event.nativeEvent.actionName === "decrement")
                resizeSidebar(currentFraction.current - 0.05);
            }}
            hitSlop={{ left: 10, right: 10 }}
            className="items-center justify-center bg-black"
            style={{ width: 24 }}
          >
            <View
              className="rounded-full bg-gray-400 dark:bg-neutral-500"
              style={{ width: 4, height: 40 }}
            />
          </View>
        )}
        {/* Keep this container and navigator mounted through every layout change. */}
        <View
          key="navigator"
          className={showCourseLayout ? "bg-white dark:bg-black" : undefined}
          style={{ flex: 1, minWidth: 0 }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
