import { eq, max } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite/async";
import { threadsTable } from "@/src/db/schema";
import { useDb } from "@/src/providers/dbProvider";

const THREAD_NUMBER_BUFFER = 50;

export function useMaxThreadNumber(
  courseId: number,
  currentThreadNumber?: number,
): number | undefined {
  const db = useDb();

  const { data } = useLiveQuery(
    db
      .select({ maxNumber: max(threadsTable.number) })
      .from(threadsTable)
      .where(eq(threadsTable.courseId, courseId)),
    [courseId],
  );

  const dbMax = data?.[0]?.maxNumber ?? 0;
  const baseline = Math.max(dbMax, currentThreadNumber ?? 0);
  return baseline > 0 ? baseline + THREAD_NUMBER_BUFFER : undefined;
}
