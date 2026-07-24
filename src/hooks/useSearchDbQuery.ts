import { and, eq, desc, asc, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { threadsTable } from "@/src/db/schema";
import { useDb } from "@/src/providers/dbProvider";
import { escapeLike } from "@/src/lib/utils";

export function useSearchDbQuery(
  courseId: number,
  query: string,
  sort: string,
) {
  console.debug("[useSearchDbQuery] called", { courseId, query, sort });
  const db = useDb();

  const trimmed = query.trim();

  const orderByClause =
    sort === "oldest"
      ? [desc(threadsTable.isPinned), asc(threadsTable.id)]
      : [desc(threadsTable.isPinned), desc(threadsTable.id)];

  const {
    data: searchResults,
    error: queryError,
    updatedAt,
  } = useLiveQuery(
    db
      .select()
      .from(threadsTable)
      .where(
        and(
          eq(threadsTable.courseId, courseId),
          sql`${threadsTable.title} LIKE ${"%" + escapeLike(trimmed) + "%"} ESCAPE '\\'`,
        ),
      )
      .orderBy(...orderByClause)
      .limit(50),
    [courseId, trimmed, sort],
  );

  console.debug("[useSearchDbQuery] render", {
    courseId,
    query: trimmed,
    resultCount: (searchResults ?? []).length,
    queryError: queryError?.message ?? null,
  });

  return {
    searchResults: searchResults ?? [],
    queryError,
    updatedAt,
  };
}
