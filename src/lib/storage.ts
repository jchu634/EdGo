import { Schema } from "effect";
import { createMMKV, type MMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";
import { Course, CourseCategory, ThreadDetailResponse } from "@/src/lib/schema";
import * as Crypto from "expo-crypto";

let courseCache: MMKV | null = null;
let threadCache: MMKV | null = null;
export let settings: MMKV | null = null;

const API_KEY_KEY = "edstem_bearer_token";
const ENCRYPTION_KEY_STORE_KEY = "mmkv_encryption_key";

function requireStore(store: MMKV | null, name: string): MMKV {
  if (!store) {
    throw new Error(
      `Storage not initialized: ${name}. Call initStorage() first.`,
    );
  }
  return store;
}

async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);
  if (!key) {
    const bytes = Crypto.getRandomBytes(16);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, key, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }
  return key;
}

export async function initStorage(): Promise<void> {
  if (courseCache && threadCache && settings) return;

  const encryptionKey = await getOrCreateEncryptionKey();
  courseCache = createMMKV({ id: "courseCache", encryptionKey });
  threadCache = createMMKV({ id: "threadCache", encryptionKey });
  settings = createMMKV({ id: "settings", encryptionKey });
}

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
  requireStore(courseCache, "courseCache").clearAll();
}

export function clearThreadCache(): void {
  requireStore(threadCache, "threadCache").clearAll();
}

export function cacheCourses(
  courses: Schema.Schema.Type<typeof Course>[],
): void {
  requireStore(courseCache, "courseCache").set(
    "courses",
    JSON.stringify(courses),
  );
}

export function getCachedCourses(): Schema.Schema.Type<typeof Course>[] | null {
  const cache = requireStore(courseCache, "courseCache");
  const raw = cache.getString("courses");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = Schema.decodeUnknownSync(Schema.Array(Course) as any)(
      parsed,
    ) as readonly Schema.Schema.Type<typeof Course>[];
    return [...validated];
  } catch {
    cache.remove("courses");
    return null;
  }
}

export function getCachedCourseCategory(
  course_id: number,
): readonly Schema.Schema.Type<typeof CourseCategory>[] | null {
  const cache = requireStore(courseCache, "courseCache");
  const raw = cache.getString("courses");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = Schema.decodeUnknownSync(Schema.Array(Course) as any)(
      parsed,
    ) as readonly Schema.Schema.Type<typeof Course>[];
    const course = validated.find((c) => c.id === course_id);
    return course?.settings.discussion.categories ?? null;
  } catch {
    cache.remove("courses");
    return null;
  }
}

export function cacheThreadDetail(
  courseId: number,
  threadNumber: number,
  data: Schema.Schema.Type<typeof ThreadDetailResponse>,
): void {
  const key = `thread-detail-${courseId}-${threadNumber}`;
  requireStore(threadCache, "threadCache").set(key, JSON.stringify(data));
}

export function getCachedThreadDetail(
  courseId: number,
  threadNumber: number,
): Schema.Schema.Type<typeof ThreadDetailResponse> | null {
  const cache = requireStore(threadCache, "threadCache");
  const key = `thread-detail-${courseId}-${threadNumber}`;
  const raw = cache.getString(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = Schema.decodeUnknownSync(ThreadDetailResponse as any)(
      parsed,
    ) as Schema.Schema.Type<typeof ThreadDetailResponse>;
    return validated;
  } catch {
    cache.remove(key);
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
  requireStore(threadCache, "threadCache").set(key, JSON.stringify(ast));
}

export function getCachedParsedXml(
  courseId: number,
  threadNumber: number,
  xmlKey: string,
): unknown | null {
  const cache = requireStore(threadCache, "threadCache");
  const key = `parsed-xml-${courseId}-${threadNumber}-${xmlKey}`;
  const raw = cache.getString(key);
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
  const s = requireStore(settings, "settings");
  const rawFrequency = s.getString("notifications.frequency");
  const frequency: NotificationFrequency = NOTIFICATION_FREQUENCIES.includes(
    rawFrequency as NotificationFrequency,
  )
    ? (rawFrequency as NotificationFrequency)
    : NOTIFICATION_DEFAULTS.frequency;
  return {
    enabled:
      s.getBoolean("notifications.enabled") ?? NOTIFICATION_DEFAULTS.enabled,
    frequency,
    sleepHoursEnabled:
      s.getBoolean("notifications.sleep_hours_enabled") ??
      NOTIFICATION_DEFAULTS.sleepHoursEnabled,
    sleepHoursStart:
      s.getNumber("notifications.sleep_hours_start") ??
      NOTIFICATION_DEFAULTS.sleepHoursStart,
    sleepHoursEnd:
      s.getNumber("notifications.sleep_hours_end") ??
      NOTIFICATION_DEFAULTS.sleepHoursEnd,
  };
}

export function setNotificationSetting<K extends keyof NotificationSettings>(
  key: K,
  value: NotificationSettings[K],
): void {
  const s = requireStore(settings, "settings");
  const storageKey = `notifications.${key === "sleepHoursEnabled" ? "sleep_hours_enabled" : key === "sleepHoursStart" ? "sleep_hours_start" : key === "sleepHoursEnd" ? "sleep_hours_end" : key}`;
  if (typeof value === "boolean") {
    s.set(storageKey, value);
  } else if (typeof value === "number") {
    s.set(storageKey, value);
  } else {
    s.set(storageKey, value as string);
  }
}

export function getLastNotifiedTimestamp(): number {
  return (
    requireStore(settings, "settings").getNumber(
      "notifications.last_notified",
    ) ?? 0
  );
}

export function setLastNotifiedTimestamp(ts: number): void {
  requireStore(settings, "settings").set("notifications.last_notified", ts);
}
