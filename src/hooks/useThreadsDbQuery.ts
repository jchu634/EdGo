import { eq, and, desc } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { threadsTable } from "@/src/db/schema";
import { useDb } from "@/src/providers/dbProvider";
import { getCachedThreadDetail } from "@/src/lib/storage";

export function useThreadsDbQuery(courseId: number, category?: string) {
  console.debug("[useThreadsDbQuery] called", { courseId, category });
  const db = useDb();

  const conditions = [eq(threadsTable.courseId, courseId)];
  if (category) conditions.push(eq(threadsTable.category, category));

  const {
    data: threads,
    error: queryError,
    updatedAt,
  } = useLiveQuery(
    db
      .select()
      .from(threadsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(threadsTable.isPinned), desc(threadsTable.id)),
    [courseId, category],
  );

  const rawThreads = threads ?? [];
  // Drop ghost threads but keep hidden threads as readonly
  const allThreads = rawThreads.filter(
    (t) => !t.isHidden || getCachedThreadDetail(courseId, t.number) !== null,
  );
  const pinnedThreads = allThreads.filter((t) => t.isPinned);
  const regularThreads = allThreads.filter((t) => !t.isPinned);

  console.debug("[useThreadsDbQuery] render", {
    courseId,
    totalThreads: allThreads.length,
    hiddenCount: allThreads.filter((t) => t.isHidden).length,
    pinnedCount: pinnedThreads.length,
    regularCount: regularThreads.length,
    queryError: queryError?.message ?? null,
  });

  return {
    threads: allThreads,
    pinnedThreads,
    regularThreads,
    queryError,
    updatedAt,
  };
}
