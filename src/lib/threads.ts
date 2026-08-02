import { Effect, Schema, Schedule } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { and, eq, inArray, not, sql } from "drizzle-orm";

import { threadsTable, type NewThread } from "@/src/db/schema";
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

const getApiKeyEffect = Effect.tryPromise({
  try: () => getApiKey(),
  catch: (error) => new Error(`Failed to read API key: ${String(error)}`),
}).pipe(
  Effect.flatMap((apiKey) =>
    apiKey ? Effect.succeed(apiKey) : Effect.fail(new Error("Missing API Key")),
  ),
);

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
    isHidden: false,
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
    isHidden: sql`excluded.is_hidden`,
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

// Mark threads as hidden when the "new" sort omits them from a covered range.
export async function markHiddenThreads(
  db: Db,
  courseId: number,
  apiThreads: Schema.Schema.Type<typeof ThreadUser>[],
  options: { category?: string; sort?: string },
) {
  // Detection relies on the "new" (number-descending) sort over the full course.
  // A category filter returns only that category's threads, so threads of other
  // categories in the number range would be wrongly hidden; other sorts break the
  // number-window inference.
  if (options.category) return;
  if ((options.sort ?? "new") !== "new") return;

  if (apiThreads.length === 0) return;
  // Exclude pinned threads from the window: they float to the top regardless of
  // number, so their numbers would skew the range inference. Pinned threads are
  // also only returned on the first page, so they must never be marked hidden
  // (a later page's response omits them even when they still exist).
  const nonPinned = apiThreads.filter((t) => !t.is_pinned);
  if (nonPinned.length === 0) return;

  let min = Infinity;
  let max = -Infinity;
  for (const t of nonPinned) {
    if (t.number < min) min = t.number;
    if (t.number > max) max = t.number;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;

  const returnedIds = apiThreads.map((t) => t.id);

  await db
    .update(threadsTable)
    .set({ isHidden: true })
    .where(
      and(
        eq(threadsTable.courseId, courseId),
        eq(threadsTable.isHidden, false),
        eq(threadsTable.isPinned, false),
        sql`${threadsTable.number} BETWEEN ${min} AND ${max}`,
        not(inArray(threadsTable.id, returnedIds)),
      ),
    );
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
        try: () =>
          syncThreadsToDb(db, courseId, Array.from(response.threads)).then(() =>
            markHiddenThreads(db, courseId, Array.from(response.threads), {
              category: options?.category,
              sort: options?.sort,
            }),
          ),
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

export function syncPageProgram(
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
