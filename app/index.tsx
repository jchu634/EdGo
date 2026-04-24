import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { View, Text, Pressable } from "react-native";
import { parseXml } from "react-native-turboxml";
import { Effect, Schema } from "effect";
import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import "@/app/global.css";
import { EyeIcon, PushPinIcon, HeartIcon } from "phosphor-react-native";
import {
  User,
  Course,
  Thread,
  UserResponse,
  ThreadResponse,
} from "@/src/lib/Schemas";

import { getUnreadCounts, UnreadCountEntry } from "@/src/lib/stream";
import { cacheCourses, getCachedCourses } from "../src/lib/courseStorage";

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
    <View className="flex-1 justify-center items-center">
      <View className="h-fit">
        {courses ? (
          <View className="w-screen p-4 flex flex-col gap-y-2 min-h-40 justify-center">
            {courses.map((course) => (
              <Pressable
                key={course.id}
                className="border-l border-gray-300 pl-2.5 w-max h-30 ml-1.5 rounded-2xl bg-gray-300 p-4 px-8  flex flex-row"
                onPress={() => router.navigate(`/courses/${course.id}`)}
              >
                <View className="w-90 justify-center">
                  <Text
                    className="font-bold text-lg text-ellipsis w-80"
                    numberOfLines={1}
                  >
                    {course.code}
                  </Text>
                  <Text numberOfLines={2}>{course.name}</Text>
                </View>
                <View className="bg-blue-700 size-12 justify-center items-center rounded-lg ">
                  <Text className=" text-center text-white text-sm">
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
          <Text className="w-screen p-4 flex flex-col space-y-4 text-center ">
            No Courses Found
          </Text>
        )}
      </View>
    </View>
  );
}
