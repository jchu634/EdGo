import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  Text,
} from "react-native";
import { Suspense } from "react";
import { Stack, useGlobalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUniwind } from "uniwind";

import { KeyProvider } from "@/src/providers/keyProvider";
import { DbProvider } from "@/src/providers/dbProvider";
import { getCachedCourses } from "@/src/lib/storage";
import { HighlighterProvider } from "@/src/providers/highlightProvider";
import { ModalProvider, useSearchModal } from "@/src/providers/modalProvider";
import { NotificationProvider } from "@/src/providers/notificationProvider";
import { NetworkProvider } from "@/src/providers/networkProvider";
import OfflineBanner from "@/src/components/OfflineBanner";
import CourseFrame from "@/src/components/CourseFrame";
import {
  CourseLayoutProvider,
  useCourseLayout,
} from "@/src/providers/courseLayoutProvider";
import "@/global.css";

function HeaderLeft() {
  const cached = getCachedCourses();

  const { courseid } = useGlobalSearchParams();

  const normalizedCourseId =
    courseid && (!Array.isArray(courseid) || courseid.length > 0)
      ? Number(Array.isArray(courseid) ? courseid[0] : courseid)
      : NaN;

  const course = cached?.find((c) => c.id === normalizedCourseId);
  return (
    <>
      {!isNaN(normalizedCourseId) && course && (
        <Text className="font-display-medium line-clamp-1 h-6 w-3/4 truncate text-white">
          {course.name}
        </Text>
      )}
    </>
  );
}
function HeaderRight() {
  const router = useRouter();
  const { courseid } = useGlobalSearchParams();
  const { openSearch } = useSearchModal();
  const { isWide, openSidebarSearch } = useCourseLayout();

  const normalizedCourseId =
    courseid && (!Array.isArray(courseid) || courseid.length > 0)
      ? Number(Array.isArray(courseid) ? courseid[0] : courseid)
      : NaN;
  const isInCourse = !isNaN(normalizedCourseId);

  return (
    <>
      {isInCourse && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search threads"
          onPress={() =>
            isWide ? openSidebarSearch() : openSearch(normalizedCourseId)
          }
          style={{ marginRight: 16 }}
        >
          <Ionicons name="search" size={24} color="white" />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.navigate("/settings")}
      >
        <Ionicons name="person" size={24} color="white" />
      </Pressable>
    </>
  );
}

function WideCourseHeader() {
  const { courseId, hasThread } = useCourseLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const course = getCachedCourses()?.find((item) => item.id === courseId);

  return (
    <View
      style={{
        backgroundColor: "#70069e",
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View
        style={{
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasThread ? "Back to course" : "Back"}
          hitSlop={8}
          style={{ padding: 8, marginRight: 16 }}
          onPress={() => {
            if (hasThread && courseId !== null)
              router.dismissTo(`/courses/${courseId}`);
            else if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Text
          className="font-display-medium flex-1 text-white"
          numberOfLines={1}
          style={{ marginRight: 16 }}
        >
          {course?.name ?? "Course threads"}
        </Text>
        <HeaderRight />
      </View>
    </View>
  );
}

function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { isWide } = useCourseLayout();
  const { theme } = useUniwind();

  return (
    <CourseFrame header={<WideCourseHeader />}>
      <Stack
        screenOptions={({ route }) => {
          const isWideCourse = isWide && route.name.startsWith("courses/");
          return {
            headerShown: !isWideCourse,
            animation: isWideCourse ? "none" : "default",
            headerStyle: { backgroundColor: "#70069e" },
            headerTintColor: "white",
            headerTitle: "",
            headerBackVisible: true,
            headerLeft: () => <HeaderLeft />,
            headerRight: () => <HeaderRight />,
            contentStyle: {
              ...(route.name.startsWith("courses/") && {
                backgroundColor: theme === "dark" ? "#000000" : "#ffffff",
              }),
              paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
            },
          };
        }}
      />
    </CourseFrame>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<ActivityIndicator size="large" />}>
        <KeyProvider>
          <DbProvider>
            <NotificationProvider>
              <NetworkProvider>
                <HighlighterProvider>
                  <CourseLayoutProvider>
                    <ModalProvider>
                      <View style={{ flex: 1 }}>
                        <OfflineBanner />
                        <AppNavigator />
                      </View>
                    </ModalProvider>
                  </CourseLayoutProvider>
                </HighlighterProvider>
              </NetworkProvider>
            </NotificationProvider>
          </DbProvider>
        </KeyProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}
