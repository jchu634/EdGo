import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import CourseThreadList from "@/src/components/CourseThreadList";
import ThreadComposerModal from "@/src/components/ThreadComposerModal";
import { CreateThreadButton } from "@/src/components/ThreadComposerActions";
import { EMPTY_THREAD_DRAFT } from "@/src/lib/thread-composer";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";

export default function CoursePage() {
  const { courseid, compose } = useLocalSearchParams();
  const router = useRouter();
  const courseId = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const { isWide, categories } = useCourseLayout();

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {isWide ? (
        <View className="flex-1 items-center justify-center gap-4 p-4">
          <Text className="font-display text-gray-500 dark:text-slate-100">
            Select a thread
          </Text>
          <CreateThreadButton courseId={courseId} />
        </View>
      ) : (
        <CourseThreadList key={courseId} courseId={courseId} />
      )}
      {compose === "new" && (
        <ThreadComposerModal
          key={`new-${courseId}`}
          target={{ kind: "create", courseId }}
          initialValue={{
            ...EMPTY_THREAD_DRAFT,
            category: categories[courseId] ?? "",
          }}
          onClose={() => router.setParams({ compose: undefined })}
        />
      )}
    </View>
  );
}
