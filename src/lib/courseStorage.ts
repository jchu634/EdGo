import * as SQLite from "expo-sqlite";
import { Schema } from "effect";
import { createMMKV } from "react-native-mmkv";
import { Thread, Course, CourseCategory } from "@/src/lib/schemas";
/**
 * @file This file contains an orm for storing and retrieving course/thread data.
 * @description
 * - Uses MMKV as a fast key-value store (Settings + course details)
 * - Uses SQLite to store threads for sorting, filtering, and querying
 */

const courseCache = createMMKV({ id: "courseCache" });
const settingsStore = createMMKV({
  id: "settings",
});

/** Cache the full course list as JSON for instant loading on the main page. */
export function cacheCourses(
  courses: Schema.Schema.Type<typeof Course>[],
): void {
  console.debug(
    "[courseStorage] cacheCourses: called with",
    courses?.length,
    "courses",
  );
  try {
    courseCache.set("courses", JSON.stringify(courses));
    console.debug("[courseStorage] cacheCourses: successfully cached");
  } catch (error) {
    console.error("[courseStorage] cacheCourses: FAILED", error);
    throw error;
  }
}

/** Read cached courses. Returns parsed array or null if not cached. */
export function getCachedCourses<T>():
  | Schema.Schema.Type<typeof Course>[]
  | null {
  console.debug("[courseStorage] getCachedCourses: called");
  const raw = courseCache.getString("courses");
  console.debug(
    "[courseStorage] getCachedCourses: raw data",
    raw ? "exists" : "is null",
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Schema.Schema.Type<typeof Course>[];
    console.debug(
      "[courseStorage] getCachedCourses: returning",
      parsed?.length,
      "courses",
    );
    return parsed;
  } catch (error) {
    console.error("[courseStorage] getCachedCourses: JSON.parse FAILED", error);
    return null;
  }
}

export function getCachedCourseCategory(
  course_id: number,
): ReadonlyArray<Schema.Schema.Type<typeof CourseCategory>> | null {
  console.debug(
    "[courseStorage] getCachedCourseCategory: called with course_id=",
    course_id,
  );
  const raw = courseCache.getString("courses");
  console.debug(
    "[courseStorage] getCachedCourseCategory: raw data",
    raw ? "exists" : "is null",
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Schema.Schema.Type<typeof Course>[];
    const course = parsed.find((course) => course.id === course_id);

    if (!course) {
      console.debug(
        "[courseStorage] getCachedCourseCategory: no course found with id=",
        course_id,
      );
      return null;
    }

    const categories = course.settings.discussion.categories;
    console.debug(
      "[courseStorage] getCachedCourseCategory: returning",
      categories?.length ?? 0,
      "categories for course id=",
      course_id,
    );
    return categories ?? null;
  } catch (error) {
    console.error("[courseStorage] getCachedCourseCategory: FAILED", error);
    return null;
  }
}

export type ThreadType = Schema.Schema.Type<typeof Thread>;

type SQLiteDatabase = SQLite.SQLiteDatabase;

let db: SQLiteDatabase | null = null;

/**
 * Lazily opens (or returns cached) the async SQLiteDatabase for the app-wide DB named "edgo.db".
 */
export async function getDB(): Promise<SQLiteDatabase> {
  console.debug("[courseStorage] getDB: called, db is", db ? "cached" : "null");
  if (!db) {
    console.debug("[courseStorage] getDB: opening database 'edgo.db'");
    try {
      db = await SQLite.openDatabaseAsync("edgo.db");
      console.debug("[courseStorage] getDB: database opened successfully");
    } catch (error) {
      console.error("[courseStorage] getDB: FAILED to open database", error);
      throw error;
    }
  }
  return db;
}

/**
 * Creates the threads table if it doesn't exist, with columns matching the Thread schema.
 * Enables WAL journal mode and foreign keys. Call this on app startup.
 */
export async function initDB(): Promise<void> {
  if (settingsStore.getBoolean("dbInitialized")) {
    console.debug("[courseStorage] initDB: already initialized, skipping");
    return;
  }
  console.debug("[courseStorage] initDB: starting");
  const database = await getDB();
  console.debug("[courseStorage] initDB: got database instance");

  console.debug("[courseStorage] initDB: setting PRAGMA journal_mode = WAL");
  await database.execAsync("PRAGMA journal_mode = WAL");
  console.debug("[courseStorage] initDB: setting PRAGMA foreign_keys = ON");
  await database.execAsync("PRAGMA foreign_keys = ON");
  console.debug("[courseStorage] initDB: PRAGMA settings applied");

  console.debug("[courseStorage] initDB: creating threads table");
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY NOT NULL,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      number INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      document TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      subcategory TEXT NOT NULL DEFAULT '',
      subsubcategory TEXT NOT NULL DEFAULT '',
      star_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      vote_count INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_answered INTEGER NOT NULL DEFAULT 0,
      is_student_answered INTEGER NOT NULL DEFAULT 0,
      is_staff_answered INTEGER NOT NULL DEFAULT 0,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      user TEXT
    );
  `);
  console.debug("[courseStorage] initDB: threads table created");

  console.debug("[courseStorage] initDB: creating index idx_threads_course_id");
  await database.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_threads_course_id ON threads(course_id);",
  );
  console.debug("[courseStorage] initDB: creating index idx_threads_category");
  await database.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_threads_category ON threads(course_id, category);",
  );
  console.debug("[courseStorage] initDB: complete");
  settingsStore.set("dbInitialized", true);
}

/**
 * Merges threads for a course using INSERT OR REPLACE so that new threads are
 * inserted, existing threads are updated, and stale threads are preserved for
 * offline viewing.
 */
export async function syncThreads(
  courseId: number,
  threads: ThreadType[],
): Promise<void> {
  console.debug(
    "[courseStorage] syncThreads: called with courseId=",
    courseId,
    "threads count=",
    threads?.length,
  );
  const database = await getDB();
  console.debug(
    "[courseStorage] syncThreads: got database, starting transaction",
  );

  await database.withTransactionAsync(async () => {
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      console.debug(
        "[courseStorage] syncThreads: processing thread[",
        i,
        "] id=",
        thread?.id,
        "title=",
        thread?.title,
      );
      try {
        await database.runAsync(
          `INSERT OR REPLACE INTO threads (
            id, course_id, title, number, user_id, type, content, document,
            category, subcategory, subsubcategory, star_count, view_count, vote_count,
            is_pinned, is_answered, is_student_answered, is_staff_answered, is_anonymous, user
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            thread.id,
            courseId,
            thread.title,
            thread.number,
            thread.user_id,
            thread.type,
            thread.content,
            thread.document,
            thread.category,
            thread.subcategory,
            thread.subsubcategory,
            thread.star_count,
            thread.view_count,
            thread.vote_count,
            thread.is_pinned ? 1 : 0,
            thread.is_answered ? 1 : 0,
            thread.is_student_answered ? 1 : 0,
            thread.is_staff_answered ? 1 : 0,
            thread.is_anonymous ? 1 : 0,
            thread.user ? JSON.stringify(thread.user) : null,
          ],
        );
        console.debug(
          "[courseStorage] syncThreads: thread[",
          i,
          "] id=",
          thread.id,
          "inserted/replaced successfully",
        );
      } catch (error) {
        console.error(
          "[courseStorage] syncThreads: FAILED on thread[",
          i,
          "] id=",
          thread?.id,
          error,
        );
        throw error;
      }
    }
  });
  console.debug(
    "[courseStorage] syncThreads: transaction complete for courseId=",
    courseId,
  );
}

/**
 * Queries threads for a course. Supports optional category filter and sort.
 * Default sort is by number DESC. Returns ThreadType[] where user is parsed from JSON.
 */
export async function getThreadsByCourse(
  courseId: number,
  options?: {
    category?: string;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
  },
): Promise<ThreadType[]> {
  console.debug(
    "[courseStorage] getThreadsByCourse: called with courseId=",
    courseId,
    "options=",
    options,
  );
  const database = await getDB();
  console.debug("[courseStorage] getThreadsByCourse: got database");

  const conditions: string[] = ["course_id = ?"];
  const params: (string | number)[] = [courseId];

  if (options?.category) {
    conditions.push("category = ?");
    params.push(options.category);
    console.debug(
      "[courseStorage] getThreadsByCourse: added category filter=",
      options.category,
    );
  }

  const allowedSortColumns = new Set([
    "id",
    "title",
    "number",
    "user_id",
    "type",
    "category",
    "subcategory",
    "subsubcategory",
    "star_count",
    "view_count",
    "vote_count",
    "is_pinned",
    "is_answered",
    "is_student_answered",
    "is_staff_answered",
    "is_anonymous",
  ]);

  const sortBy =
    options?.sortBy && allowedSortColumns.has(options.sortBy)
      ? options.sortBy
      : "number";
  const sortOrder = options?.sortOrder === "ASC" ? "ASC" : "DESC";

  const whereClause = conditions.join(" AND ");
  const sql = `SELECT * FROM threads WHERE ${whereClause} ORDER BY ${sortBy} ${sortOrder}`;
  console.debug(
    "[courseStorage] getThreadsByCourse: executing SQL=",
    sql,
    "params=",
    params,
  );

  interface RawThread {
    id: number;
    course_id: number;
    title: string;
    number: number;
    user_id: number;
    type: string;
    content: string;
    document: string;
    category: string;
    subcategory: string;
    subsubcategory: string;
    star_count: number;
    view_count: number;
    vote_count: number;
    is_pinned: number;
    is_answered: number;
    is_student_answered: number;
    is_staff_answered: number;
    is_anonymous: number;
    user: string | null;
  }

  const rows = await database.getAllAsync<RawThread>(sql, params);
  console.debug(
    "[courseStorage] getThreadsByCourse: got",
    rows?.length,
    "raw rows",
  );

  const result = rows.map((row, index): ThreadType => {
    console.debug(
      "[courseStorage] getThreadsByCourse: mapping row[",
      index,
      "] id=",
      row?.id,
    );
    return {
      id: row.id,
      title: row.title,
      number: row.number,
      user_id: row.user_id,
      type: row.type,
      content: row.content,
      document: row.document,
      category: row.category,
      subcategory: row.subcategory,
      subsubcategory: row.subsubcategory,
      star_count: row.star_count,
      view_count: row.view_count,
      vote_count: row.vote_count,
      is_pinned: row.is_pinned === 1,
      is_answered: row.is_answered === 1,
      is_student_answered: row.is_student_answered === 1,
      is_staff_answered: row.is_staff_answered === 1,
      is_anonymous: row.is_anonymous === 1,
      user: row.user ? JSON.parse(row.user) : null,
    };
  });
  console.debug(
    "[courseStorage] getThreadsByCourse: returning",
    result.length,
    "threads",
  );
  return result;
}

/**
 * Deletes all threads for a course.
 */
export async function deleteThreadsByCourse(courseId: number): Promise<void> {
  console.debug(
    "[courseStorage] deleteThreadsByCourse: called with courseId=",
    courseId,
  );
  const database = await getDB();
  console.debug(
    "[courseStorage] deleteThreadsByCourse: got database, executing delete",
  );
  await database.runAsync("DELETE FROM threads WHERE course_id = ?", [
    courseId,
  ]);
  console.debug(
    "[courseStorage] deleteThreadsByCourse: complete for courseId=",
    courseId,
  );
}

/**
 * Clears the entire threads table.
 */
export async function deleteAllThreads(): Promise<void> {
  console.debug("[courseStorage] deleteAllThreads: called");
  const database = await getDB();
  console.debug(
    "[courseStorage] deleteAllThreads: got database, executing delete",
  );
  await database.runAsync("DELETE FROM threads");
  console.debug("[courseStorage] deleteAllThreads: complete");
}
