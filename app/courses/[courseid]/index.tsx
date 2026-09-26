import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import CourseThreadList from "@/src/components/CourseThreadList";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";

export default function CoursePage() {
  const { courseid } = useLocalSearchParams();
  const courseId = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const { isWide } = useCourseLayout();

  if (isWide) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="font-display text-gray-500 dark:text-slate-100">
          Select a thread
        </Text>
      </View>
    );
  }

  return <CourseThreadList key={courseId} courseId={courseId} />;
}
