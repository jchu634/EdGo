import { Schema } from "effect";
import { createMMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";
import { Course, CourseCategory, ThreadDetailResponse } from "@/src/lib/schema";

const courseCache = createMMKV({ id: "courseCache" });
const threadCache = createMMKV({ id: "threadCache" });

const API_KEY_KEY = "edstem_bearer_token";

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_KEY, key, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_KEY);
}

export function clearCourseCache(): void {
  courseCache.clearAll();
}

export function clearThreadCache(): void {
  threadCache.clearAll();
}

export function cacheCourses(
  courses: Schema.Schema.Type<typeof Course>[],
): void {
  courseCache.set("courses", JSON.stringify(courses));
}

export function getCachedCourses(): Schema.Schema.Type<typeof Course>[] | null {
  const raw = courseCache.getString("courses");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = Schema.decodeUnknownSync(Schema.Array(Course) as any)(
      parsed,
    ) as readonly Schema.Schema.Type<typeof Course>[];
    return [...validated];
  } catch {
    courseCache.remove("courses");
    return null;
  }
}

export function getCachedCourseCategory(
  course_id: number,
): readonly Schema.Schema.Type<typeof CourseCategory>[] | null {
  const raw = courseCache.getString("courses");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = Schema.decodeUnknownSync(Schema.Array(Course) as any)(
      parsed,
    ) as readonly Schema.Schema.Type<typeof Course>[];
    const course = validated.find((c) => c.id === course_id);
    return course?.settings.discussion.categories ?? null;
  } catch {
    courseCache.remove("courses");
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
    const parsed = JSON.parse(raw);
    const validated = Schema.decodeUnknownSync(ThreadDetailResponse as any)(
      parsed,
    ) as Schema.Schema.Type<typeof ThreadDetailResponse>;
    return validated;
  } catch {
    threadCache.remove(key);
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
