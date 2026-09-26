import { createContext, useContext, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useGlobalSearchParams, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function useCourseLayoutState() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    courseid?: string;
    thread?: string;
  }>();
  const parsedCourseId = Number(params.courseid);
  const courseId =
    pathname.startsWith("/courses/") && Number.isFinite(parsedCourseId)
      ? parsedCourseId
      : null;
  const availableWidth = width - insets.left - insets.right;
  const isWide = availableWidth >= 720;
  const hasThread = courseId !== null && params.thread !== undefined;
  const [fullscreenCourseId, setFullscreenCourseId] = useState<number | null>(
    null,
  );
  const [searchRequest, setSearchRequest] = useState(0);
  const [searchOpenCourseId, setSearchOpenCourseId] = useState<number | null>(
    null,
  );
  const [categories, setCategories] = useState<
    Record<number, string | undefined>
  >({});
  const scrollOffsets = useRef(new Map<string, number>());
  const isFullscreen = isWide && hasThread && fullscreenCourseId === courseId;

  return {
    courseId,
    selectedThread: hasThread ? Number(params.thread) : undefined,
    isWide,
    isFullscreen,
    hasThread,
    isSearchOpen: searchOpenCourseId === courseId && courseId !== null,
    searchRequest,
    categories,
    scrollOffsets,
    setCategory(course: number, category: string | undefined) {
      setCategories((previous) => ({ ...previous, [course]: category }));
    },
    toggleFullscreen() {
      setFullscreenCourseId(isFullscreen ? null : courseId);
    },
    openSidebarSearch() {
      setFullscreenCourseId(null);
      setSearchOpenCourseId(courseId);
      setSearchRequest((previous) => previous + 1);
    },
    closeSidebarSearch() {
      setSearchOpenCourseId(null);
    },
  };
}

const CourseLayoutContext = createContext<ReturnType<
  typeof useCourseLayoutState
> | null>(null);

export function CourseLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useCourseLayoutState();
  return (
    <CourseLayoutContext.Provider value={value}>
      {children}
    </CourseLayoutContext.Provider>
  );
}

export function useCourseLayout() {
  const context = useContext(CourseLayoutContext);
  if (!context) throw new Error("CourseLayoutProvider is required");
  return context;
}
