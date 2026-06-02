import { Effect, Fiber, Schema, Schedule } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";

import { threadsTable, type NewThread } from "@/src/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useDb } from "@/src/providers/dbProvider";
import type { Db } from "@/src/providers/dbProvider";
import {
  ThreadResponse,
  ThreadDetailResponse,
  ThreadUser,
} from "@/src/lib/schema";
import { getApiKey } from "@/src/lib/storage";

// ---------------------------------------------------------------------------
// Constants

const PAGE_SIZE = 100;
const MAX_RETRIES = 5;
const USE_ASYNC_DRIZZLE = true;

// ---------------------------------------------------------------------------
// Utilities

function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const getApiKeyEffect = Effect.tryPromise({
  try: () => getApiKey(),
  catch: (error) => new Error(`Failed to read API key: ${String(error)}`),
}).pipe(
  Effect.flatMap((apiKey) =>
    apiKey ? Effect.succeed(apiKey) : Effect.fail(new Error("Missing API Key")),
  ),
);

function interruptFiber(
  fiberRef: React.MutableRefObject<Fiber.Fiber<any, any> | null>,
) {
  if (!fiberRef.current) return;
  Effect.runFork(Fiber.interrupt(fiberRef.current));
  fiberRef.current = null;
}

// ---------------------------------------------------------------------------
// API calls

export function fetchThreadDetail(courseId: number, threadNumber: number) {
  return Effect.gen(function* () {
    const apiKey = yield* getApiKeyEffect;
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
    const apiKey = yield* getApiKeyEffect;
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
    const apiKey = yield* getApiKeyEffect;
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

function searchThreads(
  courseId: number,
  query: string,
  options?: { sort?: string; limit?: number },
) {
  const { sort = "relevance", limit = 20 } = options ?? {};

  const params = new URLSearchParams({
    query,
    sort,
    limit: String(limit),
  });

  return Effect.gen(function* () {
    const apiKey = yield* getApiKeyEffect;
    const client = yield* HttpClient.HttpClient;

    const request = HttpClientRequest.get(
      `https://edstem.org/api/courses/${courseId}/threads/search?${params.toString()}`,
    ).pipe(HttpClientRequest.bearerToken(apiKey), HttpClientRequest.acceptJson);

    return yield* client
      .execute(request)
      .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(ThreadResponse)));
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
    const apiKey = yield* getApiKeyEffect;
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

// ---------------------------------------------------------------------------
// Thread actions (star, vote)

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

// ---------------------------------------------------------------------------
// Data transformation & DB sync

function toDbThread(
  courseId: number,
  t: Schema.Schema.Type<typeof ThreadUser>,
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
  apiThreads: Schema.Schema.Type<typeof ThreadUser>[],
) {
  const rows = apiThreads.map((t) => toDbThread(courseId, t));
  if (rows.length === 0) return;

  if (USE_ASYNC_DRIZZLE) {
    const BATCH_SIZE = 39;
    // SQLite limits variables per statement to ~999. With ~25 columns per row,
    // batch size of 39 stays safely under this limit (39 * 25 = 975).
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

// ---------------------------------------------------------------------------
// Composed sync functions (API + DB)

export const searchAndSyncThreads = (
  db: Db,
  courseId: number,
  query: string,
  options?: { sort?: string; limit?: number },
) =>
  searchThreads(courseId, query, options).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => syncThreadsToDb(db, courseId, Array.from(response.threads)),
        catch: (error) =>
          new Error("Failed to sync threads to DB", { cause: error }),
      }).pipe(Effect.as(response)),
    ),
  );

export const fetchAndSyncThreads = (
  db: Db,
  courseId: number,
  options?: {
    category?: string;
    offset?: number;
    sort?: string;
    limit?: number;
  },
) =>
  fetchThreadsFromApi(courseId, options).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => syncThreadsToDb(db, courseId, Array.from(response.threads)),
        catch: (error) =>
          new Error("Failed to sync threads to DB", { cause: error }),
      }).pipe(Effect.as(response)),
    ),
  );

interface SyncPageResult {
  threadCount: number;
  nextOffset: number;
  endOfPages: boolean;
}

function syncPageProgram(
  db: Db,
  courseId: number,
  category: string | undefined,
  offset: number,
): Effect.Effect<SyncPageResult, Error> {
  return fetchAndSyncThreads(db, courseId, { category, offset }).pipe(
    Effect.map((response) => {
      if (response.threads.length === 0) {
        return { threadCount: 0, nextOffset: offset, endOfPages: true };
      }
      const nextOffset = offset + PAGE_SIZE;
      return {
        threadCount: response.threads.length,
        nextOffset,
        endOfPages: false,
      };
    }),
    Effect.mapError((err) =>
      err instanceof Error ? err : new Error(String(err)),
    ),
    Effect.tap((result) =>
      result.endOfPages
        ? Effect.log("[syncPageProgram] reached end of pages")
        : Effect.log(
            `[syncPageProgram] fetched ${result.threadCount} threads (offset: ${offset}, next: ${result.nextOffset})`,
          ),
    ),
    Effect.tapError((err) =>
      Effect.logError("[syncPageProgram] failed to sync threads", err),
    ),
  );
}

// ---------------------------------------------------------------------------
// React hooks

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

  const allThreads = threads ?? [];
  const pinnedThreads = allThreads.filter((t) => t.isPinned);
  const regularThreads = allThreads.filter((t) => !t.isPinned);

  console.debug("[useThreadsDbQuery] render", {
    courseId,
    totalThreads: allThreads.length,
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

type SyncMode = "initial" | "refresh" | "page";

export function useThreadsSync(courseId: number, category?: string) {
  console.debug("[useThreadsSync] called", { courseId, category });
  const db = useDb();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const offsetRef = useRef(0);
  const [endOfPages, setEndOfPages] = useState(false);
  const fiberRef = useRef<Fiber.Fiber<any, any> | null>(null);

  function fetchAndSync(mode: SyncMode, offset?: number) {
    console.debug("[useThreadsSync] fetchAndSync", { mode, offset });

    interruptFiber(fiberRef);

    if (mode === "refresh") {
      offsetRef.current = 0;
      setEndOfPages(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const actualOffset = offset ?? offsetRef.current;

    const program = syncPageProgram(db, courseId, category, actualOffset).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          if (result.endOfPages) {
            setEndOfPages(true);
          } else {
            offsetRef.current = result.nextOffset;
          }
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          setLoading(false);
          setRefreshing(false);
        }),
      ),
    );

    fiberRef.current = Effect.runFork(program);
  }

  useEffect(() => {
    console.debug("[useThreadsSync] initial fetch effect");
    offsetRef.current = 0;
    /* eslint-disable react-hooks/set-state-in-effect -- It is only run on initial mount */
    fetchAndSync("initial", 0);
    return () => interruptFiber(fiberRef);
    /* eslint-disable react-hooks/exhaustive-deps -- It is meant to only run on initial mount */
  }, []);

  function refresh() {
    console.debug("[useThreadsSync] refresh");
    fetchAndSync("refresh", 0);
  }

  function fetchMore() {
    console.debug("[useThreadsSync] fetchMore", {
      offset: offsetRef.current,
      endOfPages,
      loading,
      refreshing,
    });
    if (endOfPages || loading || refreshing) return;
    fetchAndSync("page");
  }

  console.debug("[useThreadsSync] render", {
    courseId,
    loading,
    refreshing,
    endOfPages,
  });

  return {
    loading,
    refreshing,
    fetchMore,
    refresh,
    endOfPages,
  };
}

export function useSearchResults(
  courseId: number,
  params: { query: string; sort: string } | null,
) {
  console.debug("[useSearchResults] called", { courseId, params });
  const db = useDb();
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fiberRef = useRef<Fiber.Fiber<any, any> | null>(null);

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
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    interruptFiber(fiberRef);

    if (!isActive) {
      setIsSearching(false);
      return;
    }

    console.debug("[useSearchResults] debouncing search", { trimmed, sort });
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      console.debug("[useSearchResults] executing search", { trimmed, sort });

      const program = searchAndSyncThreads(db, courseId, trimmed, {
        sort,
      }).pipe(
        Effect.tapError((err) =>
          Effect.logError("[useSearchResults] API search failed:", err),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setIsSearching(false);
          }),
        ),
      );
      fiberRef.current = Effect.runFork(program);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      interruptFiber(fiberRef);
    };
  }, [courseId, trimmed, sort, db, isActive]);

  const results = isActive ? (searchResults ?? []) : [];
  console.debug("[useSearchResults] render", {
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
