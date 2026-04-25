import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { View, Text, Pressable } from "react-native";
import { Effect, Schema } from "effect";
import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import "@/app/global.css";
import {
  User,
  Course,
  Thread,
  UserResponse,
  ThreadResponse,
} from "@/src/lib/schemas";
import { getUnreadCounts, UnreadCountEntry } from "@/src/lib/stream";
import { cacheCourses, getCachedCourses } from "@/src/lib/courseStorage";

export default function Index() {
  const router = useRouter();
  const [courses, setCourses] = useState<
    Schema.Schema.Type<typeof Course>[] | undefined
  >();

  const [unreadCounts, setUnreadCounts] = useState<
    Record<string, UnreadCountEntry> | undefined
  >();
  const fetchCourses = () =>
    Effect.gen(function* () {
      if (!process.env.EXPO_PUBLIC_EDSTEM_API_KEY) {
        return yield* Effect.fail(new Error("Missing API Key"));
      }
      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.get(`https://edstem.org/api/user`).pipe(
        HttpClientRequest.bearerToken(process.env.EXPO_PUBLIC_EDSTEM_API_KEY),
        HttpClientRequest.acceptJson,
      );

      const response = yield* client.execute(request);
      return yield* HttpClientResponse.schemaBodyJson(UserResponse)(response);
      // return yield* response.json;
    }).pipe(Effect.provide(FetchHttpClient.layer));

  const fetchCourseThreads = (course_id: number) =>
    Effect.gen(function* () {
      if (!process.env.EXPO_PUBLIC_EDSTEM_API_KEY) {
        return yield* Effect.fail(new Error("Missing API Key"));
      }
      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.get(
        `https://edstem.org/api/courses/${course_id}/threads?sort=new`,
      ).pipe(
        HttpClientRequest.bearerToken(process.env.EXPO_PUBLIC_EDSTEM_API_KEY),
        HttpClientRequest.acceptJson,
      );

      const response = yield* client.execute(request);
      return yield* HttpClientResponse.schemaBodyJson(ThreadResponse)(response);
      // return yield* response.json;
    }).pipe(Effect.provide(FetchHttpClient.layer));

  const wrapNumbers = (num: number) => {
    if (num > 99) return "99+";
    else return num;
  };

  useEffect(() => {
    // Load cached courses from MMKV for instant display
    const cached = getCachedCourses<Schema.Schema.Type<typeof Course>>();
    if (cached) {
      setCourses(cached);
    }

    Effect.runPromise(fetchCourses())
      .then((response) => {
        const mappedCourses = response.courses.map((c) => c.course);
        mappedCourses.sort();
        setCourses(mappedCourses);
        cacheCourses(mappedCourses);

        // Fetch unread counts via WebSocket (non-blocking)
        getUnreadCounts()
          .then((counts) => {
            // console.log("[stream] Unread counts:", counts);
            setUnreadCounts(counts.data);
          })
          .catch((err) => console.error("[stream] Error:", err));

        const firstCourseId = mappedCourses[0]?.id;
        if (!firstCourseId) return;

        return Effect.runPromise(fetchCourseThreads(firstCourseId));
      })
      .then((threadResponse) => {
        if (!threadResponse) return;
        // setThreadTest(threadResponse.threads[1]);
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, []);

  return (
    <View className="flex-1 items-center justify-center">
      <View className="h-fit">
        {courses ? (
          <View className="flex min-h-40 w-screen flex-col justify-center gap-y-2 p-4">
            {[...courses]
              .sort((a, b) => a.id - b.id)
              .map((course) => (
                <Pressable
                  key={course.id}
                  className="ml-1.5 flex h-30 w-max flex-row rounded-2xl border-l border-gray-300 bg-gray-300 p-4 px-8 pl-2.5"
                  onPress={() => router.navigate(`/courses/${course.id}`)}
                >
                  <View className="w-90 justify-center">
                    <Text
                      className="w-80 text-lg font-bold text-ellipsis"
                      numberOfLines={1}
                    >
                      {course.code}
                    </Text>
                    <Text numberOfLines={2}>{course.name}</Text>
                  </View>
                  <View className="size-12 items-center justify-center rounded-lg bg-blue-700">
                    <Text className="font-display-semibold text-center text-sm text-white">
                      {unreadCounts
                        ? unreadCounts[String(course.id)]
                          ? wrapNumbers(unreadCounts[String(course.id)].unread)
                          : "…"
                        : "…"}
                    </Text>
                  </View>
                </Pressable>
              ))}
          </View>
        ) : (
          <Text className="flex w-screen flex-col space-y-4 p-4 text-center">
            No Courses Found
          </Text>
        )}
      </View>
    </View>
  );
}
