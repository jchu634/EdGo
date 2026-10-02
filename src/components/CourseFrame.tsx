import { useMemo, useState } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";
import CourseThreadList from "@/src/components/CourseThreadList";

function clampSidebarFraction(fraction: number) {
  "worklet";
  return Math.min(0.5, Math.max(0.2, fraction));
}

function CoursePaneDivider({
  paneWidth,
  sidebarFraction,
  visible,
}: {
  paneWidth: SharedValue<number>;
  sidebarFraction: SharedValue<number>;
  visible: boolean;
}) {
  const dragStartFraction = useSharedValue(0.4);
  const [percent, setPercent] = useState(40);

  const dividerGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(visible)
        .minDistance(0)
        .maxPointers(1)
        .onBegin(() => {
          dragStartFraction.set(sidebarFraction.get());
        })
        .onUpdate((event) => {
          const width = paneWidth.get();
          if (width > 0) {
            sidebarFraction.set(
              clampSidebarFraction(
                dragStartFraction.get() + event.translationX / width,
              ),
            );
          }
        })
        .onFinalize(() => {
          // React only needs the settled accessibility value, not every frame.
          scheduleOnRN(setPercent, Math.round(sidebarFraction.get() * 100));
        }),
    [dragStartFraction, paneWidth, sidebarFraction, visible],
  );

  return (
    <GestureDetector gesture={dividerGesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Course pane width"
        accessibilityHint="Drag left or right to resize the course pane"
        accessibilityValue={{
          min: 20,
          max: 50,
          now: percent,
          text: `${percent} percent`,
        }}
        accessibilityActions={[
          { name: "increment", label: "Widen course pane" },
          { name: "decrement", label: "Narrow course pane" },
        ]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action !== "increment" && action !== "decrement") return;
          const fraction = clampSidebarFraction(
            sidebarFraction.get() + (action === "increment" ? 0.05 : -0.05),
          );
          sidebarFraction.set(fraction);
          setPercent(Math.round(fraction * 100));
        }}
        hitSlop={{ left: 10, right: 10 }}
        className="items-center justify-center bg-black"
        style={{ width: 24, display: visible ? "flex" : "none" }}
      >
        <View
          className="rounded-full bg-gray-400 dark:bg-neutral-500"
          style={{ width: 4, height: 40 }}
        />
      </Animated.View>
    </GestureDetector>
  );
}

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
  const paneWidth = useSharedValue(0);
  const sidebarFraction = useSharedValue(0.4);
  const sidebarStyle = useAnimatedStyle<ViewStyle>(() => ({
    width: `${sidebarFraction.get() * 100}%`,
  }));

  return (
    <View style={{ flex: 1 }}>
      {showCourseLayout && header}
      <View
        style={{ flex: 1, flexDirection: "row" }}
        onLayout={(event) => paneWidth.set(event.nativeEvent.layout.width)}
      >
        {showCourseLayout && (
          <Animated.View
            className="border-r border-gray-200 bg-white dark:border-neutral-700 dark:bg-black"
            style={[
              {
                display: isFullscreen ? "none" : "flex",
                paddingLeft: insets.left,
                paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
              },
              sidebarStyle,
            ]}
          >
            <CourseThreadList key={courseId} courseId={courseId} sidebar />
          </Animated.View>
        )}
        <CoursePaneDivider
          paneWidth={paneWidth}
          sidebarFraction={sidebarFraction}
          visible={showCourseLayout && !isFullscreen}
        />
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
