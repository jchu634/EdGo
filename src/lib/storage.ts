import { Schema } from "effect";
import { createMMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";
import { Course, CourseCategory, ThreadDetailResponse } from "@/src/lib/schema";

const courseCache = createMMKV({ id: "courseCache" });
const threadCache = createMMKV({ id: "threadCache" });
export const settings = createMMKV({ id: "settings" });

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

export type NotificationFrequency = "hourly" | "every_4_hours" | "daily_6pm";

interface NotificationSettings {
  enabled: boolean;
  frequency: NotificationFrequency;
  sleepHoursEnabled: boolean;
  sleepHoursStart: number;
  sleepHoursEnd: number;
}

const NOTIFICATION_DEFAULTS: NotificationSettings = {
  enabled: true,
  frequency: "hourly",
  sleepHoursEnabled: true,
  sleepHoursStart: 23,
  sleepHoursEnd: 6,
};

const NOTIFICATION_FREQUENCIES: NotificationFrequency[] = [
  "hourly",
  "every_4_hours",
  "daily_6pm",
];

export function getNotificationSettings(): NotificationSettings {
  const rawFrequency = settings.getString("notifications.frequency");
  const frequency: NotificationFrequency = NOTIFICATION_FREQUENCIES.includes(
    rawFrequency as NotificationFrequency,
  )
    ? (rawFrequency as NotificationFrequency)
    : NOTIFICATION_DEFAULTS.frequency;
  return {
    enabled:
      settings.getBoolean("notifications.enabled") ??
      NOTIFICATION_DEFAULTS.enabled,
    frequency,
    sleepHoursEnabled:
      settings.getBoolean("notifications.sleep_hours_enabled") ??
      NOTIFICATION_DEFAULTS.sleepHoursEnabled,
    sleepHoursStart:
      settings.getNumber("notifications.sleep_hours_start") ??
      NOTIFICATION_DEFAULTS.sleepHoursStart,
    sleepHoursEnd:
      settings.getNumber("notifications.sleep_hours_end") ??
      NOTIFICATION_DEFAULTS.sleepHoursEnd,
  };
}

export function setNotificationSetting<K extends keyof NotificationSettings>(
  key: K,
  value: NotificationSettings[K],
): void {
  const storageKey = `notifications.${key === "sleepHoursEnabled" ? "sleep_hours_enabled" : key === "sleepHoursStart" ? "sleep_hours_start" : key === "sleepHoursEnd" ? "sleep_hours_end" : key}`;
  if (typeof value === "boolean") {
    settings.set(storageKey, value);
  } else if (typeof value === "number") {
    settings.set(storageKey, value);
  } else {
    settings.set(storageKey, value as string);
  }
}

export function getLastNotifiedTimestamp(): number {
  return settings.getNumber("notifications.last_notified") ?? 0;
}

export function setLastNotifiedTimestamp(ts: number): void {
  settings.set("notifications.last_notified", ts);
}
