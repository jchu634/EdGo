import { Effect, Schema, Schedule } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";

import { threadsTable, type ThreadUser, type NewThread } from "@/src/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useDb } from "@/src/providers/dbProvider";
import type { Db } from "@/src/providers/dbProvider";
import { ThreadResponse, ThreadDetailResponse } from "@/src/lib/schema";
import { getApiKey } from "@/src/lib/storage";

const PAGE_SIZE = 100;
const MAX_RETRIES = 5;

function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function fetchThreadDetail(courseId: number, threadNumber: number) {
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(
      `https://edstem.org/api/courses/${courseId}/threads/${threadNumber}`,
    ).pipe(HttpClientRequest.bearerToken(apiKey), HttpClientRequest.acceptJson);
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(ThreadDetailResponse)(
      response,
    );
  }).pipe(Effect.provide(FetchHttpClient.layer));
}
export function sendThreadViewed(threadNumber: number) {
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(
      `https://edstem.org/api/threads/${threadNumber}?view=1`,
    ).pipe(HttpClientRequest.bearerToken(apiKey), HttpClientRequest.acceptJson);
    const response = yield* client.execute(request);
    console.log(`SEND VIEWED`, { threadNumber, status: response.status });
    return response.status >= 200 && response.status < 300;
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

function threadPostWithRetry(url: string) {
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) return yield* Effect.fail(new Error("Missing API Key"));
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.post(url).pipe(
      HttpClientRequest.bearerToken(apiKey),
    );
    const response = yield* client.execute(request);
    return response.status === 204;
  }).pipe(
    Effect.retry(Schedule.recurs(MAX_RETRIES)),
    Effect.provide(FetchHttpClient.layer),
  );
}

export function starThread(threadId: number) {
  return threadPostWithRetry(`https://edstem.org/api/threads/${threadId}/star`);
}

export function unstarThread(threadId: number) {
  return threadPostWithRetry(
    `https://edstem.org/api/threads/${threadId}/unstar`,
  );
}

export function upvoteThread(threadId: number) {
  return threadPostWithRetry(
    `https://edstem.org/api/threads/${threadId}/upvote`,
  );
}

export function unvoteThread(threadId: number) {
  return threadPostWithRetry(
    `https://edstem.org/api/threads/${threadId}/unvote`,
  );
}

export function upvoteComment(commentId: number) {
  return threadPostWithRetry(
    `https://edstem.org/api/comments/${commentId}/upvote`,
  );
}

export function unvoteComment(commentId: number) {
  return threadPostWithRetry(
    `https://edstem.org/api/comments/${commentId}/unvote`,
  );
}

export function searchThreadsFromApi(
  courseId: number,
  query: string,
  options?: { sort: string; limit?: number },
) {
  const { sort = "relevance", limit = 20 } = options ?? {};
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const params = new URLSearchParams({
      query,
      sort,
      limit: String(limit),
    });

    const request = HttpClientRequest.get(
      `https://edstem.org/api/courses/${courseId}/threads/search?${params.toString()}`,
    ).pipe(HttpClientRequest.bearerToken(apiKey), HttpClientRequest.acceptJson);
    const response = yield* client.execute(request);

    return yield* HttpClientResponse.schemaBodyJson(ThreadResponse)(response);
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

export function fetchThreadsFromApi(
  courseId: number,
  options?: {
    category?: string;
    offset?: number;
    sort?: string;
    limit?: number;
  },
) {
  const { category, offset, sort = "new", limit = PAGE_SIZE } = options ?? {};
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const params = new URLSearchParams({ sort, limit: String(limit) });
    if (category) params.set("category", category);
    if (offset !== undefined) params.set("offset", String(offset));

    const request = HttpClientRequest.get(
      `https://edstem.org/api/courses/${courseId}/threads?${params.toString()}`,
    ).pipe(HttpClientRequest.bearerToken(apiKey), HttpClientRequest.acceptJson);

    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(ThreadResponse)(response);
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

function toDbThread(
  courseId: number,
  t: Schema.Schema.Type<typeof import("@/src/lib/schema").ThreadUser>,
): NewThread {
  return {
    id: t.id,
    courseId,
    title: t.title,
    number: t.number,
    userId: t.user_id,
    type: t.type,
    content: t.content,
    document: t.document,
    category: t.category,
    subcategory: t.subcategory,
    subsubcategory: t.subsubcategory,
    starCount: t.star_count,
    viewCount: t.view_count,
    voteCount: t.vote_count,
    replyCount: t.reply_count,
    isPinned: t.is_pinned,
    isAnswered: t.is_answered,
    isStudentAnswered: t.is_student_answered,
    isStaffAnswered: t.is_staff_answered,
    isAnonymous: t.is_anonymous,
    user: t.user,
    createdAt: t.created_at,
    updatedAt: t.updated_at ?? null,
    isStarred: t.is_starred,
    isVoted: (t.vote ?? 0) === 1,
  };
}

const USE_ASYNC_DRIZZLE = true;

const upsertConflict = {
  target: threadsTable.id,
  set: {
    title: sql`excluded.title`,
    number: sql`excluded.number`,
    type: sql`excluded.type`,
    content: sql`excluded.content`,
    document: sql`excluded.document`,
    category: sql`excluded.category`,
    subcategory: sql`excluded.subcategory`,
    subsubcategory: sql`excluded.subsubcategory`,
    starCount: sql`excluded.star_count`,
    viewCount: sql`excluded.view_count`,
    voteCount: sql`excluded.vote_count`,
    replyCount: sql`excluded.reply_count`,
    isPinned: sql`excluded.is_pinned`,
    isAnswered: sql`excluded.is_answered`,
    isStudentAnswered: sql`excluded.is_student_answered`,
    isStaffAnswered: sql`excluded.is_staff_answered`,
    isAnonymous: sql`excluded.is_anonymous`,
    user: sql`excluded.user`,
    createdAt: sql`excluded.created_at`,
    updatedAt: sql`excluded.updated_at`,
    isStarred: sql`excluded.is_starred`,
    isVoted: sql`excluded.is_voted`,
  },
} as const;

export async function syncThreadsToDb(
  db: Db,
  courseId: number,
  apiThreads: Schema.Schema.Type<
    typeof import("@/src/lib/schema").ThreadUser
  >[],
) {
  const rows = apiThreads.map((t) => toDbThread(courseId, t));
  if (rows.length === 0) return;

  if (USE_ASYNC_DRIZZLE) {
    const BATCH_SIZE = 39;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await db
        .insert(threadsTable)
        .values(batch as NewThread[])
        .onConflictDoUpdate(upsertConflict);
    }
  } else {
    await db
      .insert(threadsTable)
      .values(rows as NewThread[])
      .onConflictDoUpdate(upsertConflict);
  }
}

export function useCourseThreads(courseId: number, category?: string) {
  console.log("[useCourseThreads] called", { courseId, category });
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

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const offsetRef = useRef(0);
  const [endOfPages, setEndOfPages] = useState(false);

  const fetchAndSync = useCallback(
    async (offset?: number) => {
      console.log("[useCourseThreads] fetchAndSync start", {
        courseId,
        category,
        offset,
      });
      setLoading(true);
      setError(undefined);
      try {
        const response = await Effect.runPromise(
          fetchThreadsFromApi(courseId, { category, offset }),
        );
        if (!response) {
          console.log("[useCourseThreads] fetchAndSync got no response");
          return;
        }
        if (response.threads.length === 0) {
          console.log("[useCourseThreads] fetchAndSync reached end of pages", {
            offset,
          });
          setEndOfPages(true);
          return;
        }
        console.log(
          `[useCourseThreads] Fetched ${response.threads.length} threads from API (offset: ${offset})`,
        );
        await syncThreadsToDb(db, courseId, [...response.threads]);
        offsetRef.current = (offset ?? 0) + PAGE_SIZE;
        console.log("[useCourseThreads] fetchAndSync done", {
          threadCount: response.threads.length,
          nextOffset: offsetRef.current,
        });
      } catch (err) {
        console.error("[useCourseThreads] Failed to sync threads:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [db, courseId, category],
  );

  useEffect(() => {
    console.log("[useCourseThreads] initial fetch effect");
    offsetRef.current = 0;
    setEndOfPages(false);
    fetchAndSync(0);
  }, [fetchAndSync]);

  const refresh = useCallback(async () => {
    console.log("[useCourseThreads] refresh");
    setRefreshing(true);
    try {
      offsetRef.current = 0;
      setEndOfPages(false);
      await fetchAndSync(0);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAndSync]);

  const fetchMore = useCallback(() => {
    console.log("[useCourseThreads] fetchMore", {
      offset: offsetRef.current,
      endOfPages,
      loading,
      refreshing,
    });
    if (endOfPages || loading || refreshing) return;
    fetchAndSync(offsetRef.current);
  }, [endOfPages, loading, refreshing, fetchAndSync]);

  const allThreads = threads ?? [];
  const pinnedThreads = allThreads.filter((t) => t.isPinned);
  const regularThreads = allThreads.filter((t) => !t.isPinned);

  console.log("[useCourseThreads] render", {
    courseId,
    totalThreads: allThreads.length,
    pinnedCount: pinnedThreads.length,
    regularCount: regularThreads.length,
    loading,
    refreshing,
    error: error?.message ?? queryError?.message ?? null,
  });

  return {
    threads: allThreads,
    pinnedThreads,
    regularThreads,
    loading,
    refreshing,
    error: error ?? queryError,
    fetchMore,
    refresh,
    endOfPages,
    updatedAt,
  };
}

export function useSearchResults(
  courseId: number,
  params: { query: string; sort: string } | null,
) {
  console.log("[useSearchResults] called", { courseId, params });
  const db = useDb();
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTokenRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = (params?.query ?? "").trim();
  const sort = params?.sort ?? "relevance";
  const isActive = trimmed.length > 0;

  const orderByClause =
    sort === "oldest"
      ? [desc(threadsTable.isPinned), asc(threadsTable.id)]
      : [desc(threadsTable.isPinned), desc(threadsTable.id)];

  const { data: searchResults } = useLiveQuery(
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isActive) {
      setIsSearching(false);
      return;
    }

    console.log("[useSearchResults] debouncing search", { trimmed, sort });
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const requestToken = debounceRef.current;
      searchTokenRef.current = requestToken;
      console.log("[useSearchResults] executing search", { trimmed, sort });
      try {
        const response = await Effect.runPromise(
          searchThreadsFromApi(courseId, trimmed, { sort }),
        );
        if (response?.threads?.length) {
          console.log("[useSearchResults] API returned results", {
            query: trimmed,
            count: response.threads.length,
          });
          await syncThreadsToDb(db, courseId, response.threads as any[]);
        } else {
          console.log("[useSearchResults] API returned no results", {
            query: trimmed,
          });
        }
      } catch (err) {
        console.error("[useSearchResults] API search failed:", err);
      } finally {
        if (searchTokenRef.current === requestToken) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [courseId, trimmed, sort, db, isActive]);

  const results = isActive ? (searchResults ?? []) : [];
  console.log("[useSearchResults] render", {
    courseId,
    query: trimmed,
    isActive,
    isSearching: isActive && isSearching,
    resultCount: results.length,
  });

  return {
    searchResults: results,
    isSearching: isActive && isSearching,
  };
}

export function useRecentThreads(courses: { id: number }[] | undefined) {
  console.log("[useRecentThreads] called", { courseCount: courses?.length });
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
      console.log("[useRecentThreads] no courses, skipping fetch");
      return;
    }
    let cancelled = false;
    setLoading(true);
    console.log("[useRecentThreads] fetching for courses", {
      courseIds: courses.map((c) => c.id),
    });

    Promise.all(
      courses.map((course) =>
        Effect.runPromise(
          fetchThreadsFromApi(course.id, { sort: "new", limit: 5 }),
        )
          .then((response) => {
            if (response?.threads?.length) {
              console.log("[useRecentThreads] synced course", {
                courseId: course.id,
                threadCount: response.threads.length,
              });
              return syncThreadsToDb(db, course.id, response.threads as any[]);
            }
            console.log("[useRecentThreads] no threads for course", {
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
      console.log("[useRecentThreads] all fetches complete", { cancelled });
    });

    return () => {
      cancelled = true;
    };
  }, [db, courses]);

  console.log("[useRecentThreads] render", {
    courseCount: courses?.length,
    threadCount: (threads ?? []).length,
    loading,
  });

  return {
    threads: threads ?? [],
    loading,
  };
}
