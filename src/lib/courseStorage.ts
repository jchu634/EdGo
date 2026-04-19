import { createMMKV } from "react-native-mmkv";

type MMKVStore = ReturnType<typeof createMMKV>;

const courseStores = new Map<string, MMKVStore>();

/**
 * Get or create an MMKV store for a specific course.
 * Stores are lazily created and cached in memory.
 * Each store is persisted on disk with ID `course-{courseId}`.
 */
export function getCourseStore(courseId: number): MMKVStore {
  let store = courseStores.get(courseId.toString());
  if (!store) {
    store = createMMKV({ id: courseId.toString() });
    courseStores.set(courseId.toString(), store);
  }
  return store;
}

/**
 * Delete a course store and remove it from the cache.
 * This clears all data for that course.
 */
export function deleteCourseStore(courseId: number): void {
  const store = courseStores.get(courseId.toString());
  if (store) {
    store.clearAll();
    courseStores.delete(courseId.toString());
  }
}

/**
 * Clear all course stores from memory cache.
 * Does NOT delete the persisted data on disk.
 */
export function clearAllCourseStoresFromMemory(): void {
  courseStores.clear();
}

/**
 * Get all currently initialized store IDs.
 * Useful for debugging.
 */
export function getActiveStoreIds(): string[] {
  return Array.from(courseStores.keys());
}
