import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { Effect, Schema } from "effect";
import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";

import { useRouter } from "expo-router";
import { Course, UserResponse } from "@/src/lib/schema";
import { getUnreadCounts, UnreadCountEntry } from "@/src/lib/stream";
import {
  cacheCourses,
  getCachedCourses,
  getApiKey,
  clearCourseCache,
  clearThreadCache,
} from "@/src/lib/storage";

import "@/app/global.css";

const courseColours = ["#16DB93", "#F72585", "#00241B", "#6A66A3", "#FF7F11"];
const windowDimensions = Dimensions.get("window");
const screenDimensions = Dimensions.get("screen");

export default function Index() {
  const router = useRouter();
  const [courses, setCourses] = useState<
    Schema.Schema.Type<typeof Course>[] | undefined
  >();

  const [unreadCounts, setUnreadCounts] = useState<
    Record<string, UnreadCountEntry> | undefined
  >();

  const [dimensions, setDimensions] = useState({
    window: windowDimensions,
    screen: screenDimensions,
  });

  const fetchCourses = () =>
    Effect.gen(function* () {
      const apiKey = getApiKey();
      if (!apiKey) {
        return yield* Effect.fail(new Error("Missing API Key"));
      }
      const client = yield* HttpClient.HttpClient;
      const request = HttpClientRequest.get(`https://edstem.org/api/user`).pipe(
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.acceptJson,
      );

      const response = yield* client.execute(request);
      return yield* HttpClientResponse.schemaBodyJson(UserResponse)(response);
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

        return;
      })
      .catch((error) => {
        console.error("error", error);
      });
    const subscription = Dimensions.addEventListener(
      "change",
      ({ window, screen }) => {
        setDimensions({ window, screen });
      },
    );
    return () => subscription?.remove();
  }, []);

  return (
    <View className="flex-1 items-center justify-center">
      <View className="h-fit">
        {courses ? (
          <View className="flex min-h-40 w-screen flex-col justify-center gap-y-2 p-4">
            {[...courses]
              .sort((a, b) => a.id - b.id)
              .map((course, index) => (
                <Pressable
                  key={course.id}
                  className="ml-1.5 flex h-30 w-max flex-row gap-x-2 rounded-2xl bg-gray-300 p-4 px-2.5"
                  onPress={() => router.navigate(`/courses/${course.id}`)}
                >
                  <View
                    className="h-full w-4 rounded-4xl"
                    style={{
                      backgroundColor:
                        courseColours[index % courseColours.length],
                    }}
                  />

                  <View className="w-max flex-1 flex-row">
                    <View
                      className="justify-center"
                      style={{ width: dimensions.window.width * 0.8 - 40 }}
                    >
                      <Text
                        className="font-display-bold text-xl text-ellipsis"
                        numberOfLines={1}
                      >
                        {course.code}
                      </Text>
                      <Text numberOfLines={2} className="font-display">
                        {course.name}
                      </Text>
                    </View>
                    <View className="size-12 items-center justify-center rounded-lg bg-blue-700">
                      <Text className="font-display-semibold text-center text-sm text-white">
                        {unreadCounts
                          ? unreadCounts[String(course.id)]
                            ? wrapNumbers(
                                unreadCounts[String(course.id)].unread,
                              )
                            : "…"
                          : "…"}
                      </Text>
                    </View>
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
      <Pressable className="h-10 w-10"></Pressable>
      <View className="absolute bottom-4 left-4 gap-y-2">
        <Pressable
          className="rounded-lg bg-red-100 px-3 py-1.5"
          onPress={() => {
            clearCourseCache();
            setCourses(undefined);
          }}
        >
          <Text className="font-display text-xs text-red-700">
            Purge Course Cache
          </Text>
        </Pressable>
        <Pressable
          className="rounded-lg bg-red-100 px-3 py-1.5"
          onPress={() => clearThreadCache()}
        >
          <Text className="font-display text-xs text-red-700">
            Purge Thread Cache
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
