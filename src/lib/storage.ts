import { Schema } from "effect";
import { createMMKV } from "react-native-mmkv";
import {
  Course,
  CourseCategory,
  ThreadDetailResponse,
} from "@/src/lib/schemas";

const courseCache = createMMKV({ id: "courseCache" });
const threadCache = createMMKV({ id: "threadCache" });

export function cacheCourses(
  courses: Schema.Schema.Type<typeof Course>[],
): void {
  courseCache.set("courses", JSON.stringify(courses));
}

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

export function cacheThreadDetail(
  courseId: number,
  threadNumber: number,
  data: Schema.Schema.Type<typeof ThreadDetailResponse>,
): void {
  const key = `thread-detail-${courseId}-${threadNumber}`;
  threadCache.set(key, JSON.stringify(data));
}

export function getCachedThreadDetail(
  courseId: number,
  threadNumber: number,
): Schema.Schema.Type<typeof ThreadDetailResponse> | null {
  const key = `thread-detail-${courseId}-${threadNumber}`;
  const raw = threadCache.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Schema.Schema.Type<typeof ThreadDetailResponse>;
  } catch {
    return null;
  }
}

export function cacheParsedXml(
  courseId: number,
  threadNumber: number,
  xmlKey: string,
  ast: unknown,
): void {
  const key = `parsed-xml-${courseId}-${threadNumber}-${xmlKey}`;
  threadCache.set(key, JSON.stringify(ast));
}

export function getCachedParsedXml(
  courseId: number,
  threadNumber: number,
  xmlKey: string,
): unknown | null {
  const key = `parsed-xml-${courseId}-${threadNumber}-${xmlKey}`;
  const raw = threadCache.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
