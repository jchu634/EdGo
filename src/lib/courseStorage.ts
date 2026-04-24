import * as SQLite from "expo-sqlite";
import { Schema } from "effect";
import { createMMKV } from "react-native-mmkv";
import { Thread } from "@/src/lib/Schemas";

const courseCache = createMMKV({ id: "courseCache" });

/** Cache the full course list as JSON for instant loading on the main page. */
export function cacheCourses(courses: unknown[]): void {
  courseCache.set("courses", JSON.stringify(courses));
}

/** Read cached courses. Returns parsed array or null if not cached. */
export function getCachedCourses<T>(): T[] | null {
  const raw = courseCache.getString("courses");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T[];
  } catch {
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
  if (!db) {
    db = await SQLite.openDatabaseAsync("edgo.db");
  }
  return db;
}

/**
 * Creates the threads table if it doesn't exist, with columns matching the Thread schema.
 * Enables WAL journal mode and foreign keys. Call this on app startup.
 */
export async function initDB(): Promise<void> {
  const database = await getDB();

  await database.execAsync("PRAGMA journal_mode = WAL");
  await database.execAsync("PRAGMA foreign_keys = ON");

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

  await database.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_threads_course_id ON threads(course_id);",
  );
  await database.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_threads_category ON threads(course_id, category);",
  );
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
  const database = await getDB();

  await database.withTransactionAsync(async () => {
    for (const thread of threads) {
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
    }
  });
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
  const database = await getDB();

  const conditions: string[] = ["course_id = ?"];
  const params: (string | number)[] = [courseId];

  if (options?.category) {
    conditions.push("category = ?");
    params.push(options.category);
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

  return rows.map(
    (row): ThreadType => ({
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
    }),
  );
}

/**
 * Deletes all threads for a course.
 */
export async function deleteThreadsByCourse(courseId: number): Promise<void> {
  const database = await getDB();
  await database.runAsync("DELETE FROM threads WHERE course_id = ?", [
    courseId,
  ]);
}

/**
 * Clears the entire threads table.
 */
export async function deleteAllThreads(): Promise<void> {
  const database = await getDB();
  await database.runAsync("DELETE FROM threads");
}
