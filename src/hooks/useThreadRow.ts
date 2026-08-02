import { and, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { threadsTable, type ThreadUser } from "@/src/db/schema";
import { useDb } from "@/src/providers/dbProvider";

export function useThreadRow(courseId: number, threadNumber: number) {
  const db = useDb();

  const { data: rows, error } = useLiveQuery(
    db
      .select()
      .from(threadsTable)
      .where(
        and(
          eq(threadsTable.courseId, courseId),
          eq(threadsTable.number, threadNumber),
        ),
      )
      .limit(1),
    [courseId, threadNumber],
  );

  // useLiveQuery yields `undefined` until the first run completes, then an array.
  const loaded = rows !== undefined || error !== undefined;
  const row = (rows ?? [])[0] as ThreadUser | undefined;

  return { row, loaded };
}
