import { Effect, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { eq, and, desc, sql } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";

import { threadsTable, type Thread, type NewThread } from "@/src/db/schema";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useDb } from "@/src/providers/dbProvider";
import type { Db } from "@/src/providers/dbProvider";
import { ThreadResponse, ThreadDetailResponse } from "@/src/lib/schemas";

const PAGE_SIZE = 100;

export function fetchThreadDetail(courseId: number, threadNumber: number) {
  return Effect.gen(function* () {
    if (!process.env.EXPO_PUBLIC_EDSTEM_API_KEY) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(
      `https://edstem.org/api/courses/${courseId}/threads/${threadNumber}`,
    ).pipe(
      HttpClientRequest.bearerToken(process.env.EXPO_PUBLIC_EDSTEM_API_KEY),
      HttpClientRequest.acceptJson,
    );
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(ThreadDetailResponse)(
      response,
    );
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

export function fetchThreadsFromApi(
  courseId: number,
  options?: { category?: string; offset?: number; sort?: string },
) {
  const { category, offset, sort = "new" } = options ?? {};
  return Effect.gen(function* () {
    if (!process.env.EXPO_PUBLIC_EDSTEM_API_KEY) {
      return yield* Effect.fail(new Error("Missing API Key"));
    }
    const client = yield* HttpClient.HttpClient;
    const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE) });
    if (category) params.set("category", category);
    if (offset !== undefined) params.set("offset", String(offset));

    const request = HttpClientRequest.get(
      `https://edstem.org/api/courses/${courseId}/threads?${params.toString()}`,
    ).pipe(
      HttpClientRequest.bearerToken(process.env.EXPO_PUBLIC_EDSTEM_API_KEY),
      HttpClientRequest.acceptJson,
    );

    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(ThreadResponse)(response);
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

function toDbThread(
  courseId: number,
  t: Schema.Schema.Type<typeof import("@/src/lib/schemas").Thread>,
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
  apiThreads: Schema.Schema.Type<typeof import("@/src/lib/schemas").Thread>[],
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
        console.log("Offset", offset);
        console.log("Fetched thread 1", response?.threads[0].title);
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

  const fetchMore = useCallback(() => {
    console.log("Fetching more threads");
    console.log("Current Offset", offsetRef.current);
    if (endOfPages || loading) return;
    fetchAndSync(offsetRef.current);
  }, [endOfPages, loading, fetchAndSync]);

  const allThreads = threads ?? [];
  const pinnedThreads = allThreads.filter((t) => t.isPinned);
  const regularThreads = allThreads.filter((t) => !t.isPinned);

  return {
    threads: allThreads,
    pinnedThreads,
    regularThreads,
    loading,
    error: error ?? queryError,
    fetchMore,
    endOfPages,
    updatedAt,
  };
}
