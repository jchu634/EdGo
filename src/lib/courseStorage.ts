import { Schema } from "effect";
import { createMMKV } from "react-native-mmkv";
import { Course, CourseCategory } from "@/src/lib/schemas";

const courseCache = createMMKV({ id: "courseCache" });

/** Cache the full course list as JSON for instant loading on the main page. */
export function cacheCourses(
  courses: Schema.Schema.Type<typeof Course>[],
): void {
  courseCache.set("courses", JSON.stringify(courses));
}

/** Read cached courses. Returns parsed array or null if not cached. */
export function getCachedCourses(): Schema.Schema.Type<typeof Course>[] | null {
  const raw = courseCache.getString("courses");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Schema.Schema.Type<typeof Course>[];
  } catch {
    return null;
  }
}

export function getCachedCourseCategory(
  course_id: number,
): readonly Schema.Schema.Type<typeof CourseCategory>[] | null {
  const raw = courseCache.getString("courses");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Schema.Schema.Type<typeof Course>[];
    const course = parsed.find((c) => c.id === course_id);
    return course?.settings.discussion.categories ?? null;
  } catch {
    return null;
  }
}
