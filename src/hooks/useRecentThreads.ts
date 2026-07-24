import { useEffect, useState } from "react";
import { desc, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Effect } from "effect";
import { threadsTable } from "@/src/db/schema";
import { useDb } from "@/src/providers/dbProvider";
import { fetchThreadsFromApi, syncThreadsToDb } from "@/src/lib/threads";

export function useRecentThreads(courses: { id: number }[] | undefined) {
  console.debug("[useRecentThreads] called", { courseCount: courses?.length });
  const db = useDb();
  const [loading, setLoading] = useState(false);

  const { data: threads } = useLiveQuery(
    db
      .select()
      .from(threadsTable)
      .orderBy(
        desc(
          sql`COALESCE(${threadsTable.updatedAt}, ${threadsTable.createdAt})`,
        ),
      )
      .limit(5),
    [],
  );

  useEffect(() => {
    if (!courses || courses.length === 0) {
      console.debug("[useRecentThreads] no courses, skipping fetch");
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading State will not trigger cascading render
    setLoading(true);
    console.debug("[useRecentThreads] fetching for courses", {
      courseIds: courses.map((c) => c.id),
    });

    Promise.all(
      courses.map((course) =>
        Effect.runPromise(
          fetchThreadsFromApi(course.id, { sort: "new", limit: 5 }),
        )
          .then((response) => {
            if (response?.threads?.length) {
              console.debug("[useRecentThreads] synced course", {
                courseId: course.id,
                threadCount: response.threads.length,
              });
              return syncThreadsToDb(db, course.id, response.threads as any[]);
            }
            console.debug("[useRecentThreads] no threads for course", {
              courseId: course.id,
            });
          })
          .catch((err) => {
            console.error(
              "[useRecentThreads] Failed to sync course:",
              course.id,
              err,
            );
          }),
      ),
    ).finally(() => {
      if (!cancelled) setLoading(false);
      console.debug("[useRecentThreads] all fetches complete", { cancelled });
    });

    return () => {
      cancelled = true;
    };
  }, [db, courses]);

  console.debug("[useRecentThreads] render", {
    courseCount: courses?.length,
    threadCount: (threads ?? []).length,
    loading,
  });

  return {
    threads: threads ?? [],
    loading,
  };
}
