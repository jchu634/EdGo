import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { inArray, sql } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { getApiKey, getCachedCourses, cacheCourses } from "@/src/lib/storage";
import { fetchThreadsFromApi, syncThreadsToDb } from "@/src/lib/threads";
import { UserResponse } from "@/src/lib/schema";
import {
  requestNotificationPermissions,
  shouldSendNotification,
  isInSleepHours,
  sendNewThreadNotification,
} from "@/src/lib/notifications";

export const TASK_NAME = "background-thread-sync";

let isTaskDefined = false;

function getBackgroundDb() {
  const expoDb = openDatabaseSync("edgo.db", { enableChangeListener: true });
  return drizzle(expoDb, { schema });
}

function fetchCoursesFromApi() {
  return Effect.gen(function* () {
    const apiKey = yield* Effect.promise(() => getApiKey());
    if (!apiKey) return yield* Effect.fail(new Error("Missing API Key"));
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get("https://edstem.org/api/user").pipe(
      HttpClientRequest.bearerToken(apiKey),
      HttpClientRequest.acceptJson,
    );
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(UserResponse)(response);
  }).pipe(Effect.provide(FetchHttpClient.layer));
}

function defineBackgroundTask() {
  if (isTaskDefined) return;
  isTaskDefined = true;

  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const apiKey = await getApiKey();
      if (!apiKey) return BackgroundTask.BackgroundTaskResult.Failed;

      const db = getBackgroundDb();

      let courses = getCachedCourses();
      try {
        const response = await Effect.runPromise(fetchCoursesFromApi());
        const mapped = response.courses.map((c) => c.course);
        cacheCourses(mapped);
        courses = mapped;
      } catch {
        // Fall back to cached courses
      }

      if (!courses || courses.length === 0)
        return BackgroundTask.BackgroundTaskResult.Success;

      let canNotify = shouldSendNotification() && !isInSleepHours();

      for (const course of courses) {
        try {
          const response = await Effect.runPromise(
            fetchThreadsFromApi(course.id, { sort: "new" }),
          );
          if (!response || response.threads.length === 0) continue;

          const apiIds = response.threads.map((t) => t.id);

          const existing = await db
            .select({ id: schema.threadsTable.id })
            .from(schema.threadsTable)
            .where(
              apiIds.length > 0
                ? inArray(schema.threadsTable.id, apiIds)
                : sql`1 = 0`,
            )
            .execute();

          const existingIds = new Set(existing.map((t) => t.id));
          const newThreads = response.threads.filter(
            (t) => !existingIds.has(t.id),
          );

          await syncThreadsToDb(db, course.id, response.threads as any);

          if (canNotify && newThreads.length > 0) {
            await sendNewThreadNotification(
              course.code,
              newThreads.length,
              course.id,
            );
            canNotify = false;
          }
        } catch (err) {
          console.error(
            `[backgroundSync] Error syncing course ${course.id}:`,
            err,
          );
        }
      }

      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (err) {
      console.error("[backgroundSync] Task failed:", err);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

defineBackgroundTask();
export async function registerBackgroundSyncTask(): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  await requestNotificationPermissions();

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    }
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60,
    });
  } catch (err) {
    console.error("[backgroundSync] Failed to register task:", err);
  }
}

export async function unregisterBackgroundSyncTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    }
  } catch (err) {
    console.error("[backgroundSync] Failed to unregister task:", err);
  }
}

export async function isBackgroundSyncRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  } catch {
    return false;
  }
}
