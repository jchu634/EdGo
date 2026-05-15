import { Effect, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { eq, and, desc, sql } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";

import { threadsTable, type ThreadUser, type NewThread } from "@/src/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useDb } from "@/src/providers/dbProvider";
import type { Db } from "@/src/providers/dbProvider";
import { ThreadResponse, ThreadDetailResponse } from "@/src/lib/schema";
import { getApiKey } from "@/src/lib/storage";

const PAGE_SIZE = 100;

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
  options?: { category?: string; offset?: number; sort?: string },
) {
  const { category, offset, sort = "new" } = options ?? {};
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE) });
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
  };
}

export async function syncThreadsToDb(
  db: Db,
  courseId: number,
  apiThreads: Schema.Schema.Type<
    typeof import("@/src/lib/schema").ThreadUser
  >[],
) {
  const rows = apiThreads.map((t) => toDbThread(courseId, t));
  if (rows.length === 0) return;

  await db
    .insert(threadsTable)
    .values(rows as NewThread[])
    .onConflictDoUpdate({
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
      },
    });
}

export function useCourseThreads(courseId: number, category?: string) {
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
      setLoading(true);
      setError(undefined);
      try {
        const response = await Effect.runPromise(
          fetchThreadsFromApi(courseId, { category, offset }),
        );
        if (!response) return;
        if (response.threads.length === 0) {
          setEndOfPages(true);
          return;
        }
        await syncThreadsToDb(db, courseId, [...response.threads]);
        offsetRef.current = (offset ?? 0) + PAGE_SIZE;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [db, courseId, category],
  );

  useEffect(() => {
    offsetRef.current = 0;
    setEndOfPages(false);
    fetchAndSync(0);
  }, [fetchAndSync]);

  const refresh = useCallback(async () => {
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
    console.log("Fetching more threads");
    console.log("Current Offset", offsetRef.current);
    if (endOfPages || loading || refreshing) return;
    fetchAndSync(offsetRef.current);
  }, [endOfPages, loading, refreshing, fetchAndSync]);

  const allThreads = threads ?? [];
  const pinnedThreads = allThreads.filter((t) => t.isPinned);
  const regularThreads = allThreads.filter((t) => !t.isPinned);

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

export function useSearchResults(courseId: number, query: string | null) {
  const db = useDb();
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTokenRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = (query ?? "").trim();
  const isActive = trimmed.length > 0;

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
      .orderBy(desc(threadsTable.isPinned), desc(threadsTable.id))
      .limit(50),
    [courseId, trimmed],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isActive) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const requestToken = debounceRef.current;
      searchTokenRef.current = requestToken;
      try {
        const response = await Effect.runPromise(
          searchThreadsFromApi(courseId, trimmed),
        );
        if (response?.threads?.length) {
          await syncThreadsToDb(db, courseId, response.threads as any[]);
        }
      } catch (err) {
        console.error("[search] API search failed:", err);
      } finally {
        if (searchTokenRef.current === requestToken) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [courseId, trimmed, db, isActive]);

  return {
    searchResults: isActive ? (searchResults ?? []) : [],
    isSearching: isActive && isSearching,
  };
}
