import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

import { Effect, Schedule, Schema, Duration, Fiber } from "effect";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, Pressable, Dimensions, FlatList } from "react-native";
import { EyeIcon, HeartIcon, ChatsIcon } from "phosphor-react-native";

import { useRouter } from "expo-router";
import { Course, UserResponse, RegionResponse } from "@/src/lib/schema";
import { getUnreadCounts, UnreadCountEntry } from "@/src/lib/stream";
import {
  cacheCourses,
  getCachedCourses,
  getApiKey,
  settings,
} from "@/src/lib/storage";
import { useRecentThreads } from "@/src/lib/threads";

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

  const { threads: recentThreads, loading: recentLoading } =
    useRecentThreads(courses);

  const courseMap = useMemo(() => {
    const map = new Map<number, { code: string; index: number }>();
    if (!courses) return map;
    [...courses]
      .sort((a, b) => a.id - b.id)
      .forEach((c, i) => map.set(c.id, { code: c.code, index: i }));
    return map;
  }, [courses]);

  const fetchCourses = () =>
    Effect.gen(function* () {
      const apiKey = yield* Effect.promise(() => getApiKey());
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

  const loadRegion = () =>
    Effect.gen(function* () {
      const apiKey = yield* Effect.promise(() => getApiKey());

      if (!apiKey) {
        return yield* Effect.fail(new Error("Missing API Key"));
      }

      const client = yield* HttpClient.HttpClient;

      const request = HttpClientRequest.get(
        "https://edstem.org/api/region",
      ).pipe(
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.acceptJson,
      );

      const region = yield* Effect.gen(function* () {
        const response = yield* client.execute(request);
        return yield* HttpClientResponse.schemaBodyJson(RegionResponse)(
          response,
        );
      }).pipe(
        Effect.retry({
          schedule: Schedule.exponential(Duration.seconds(1)),
          times: 5,
        }),
      );

      yield* Effect.sync(() => {
        settings.set("user.default_region", region.default_region);
        settings.set("user.country_code", region.country_code);
      });
    }).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.matchEffect({
        onSuccess: () => Effect.void,
        onFailure: (error) =>
          Effect.sync(() => {
            console.error("error", error);
          }),
      }),
    );

  const wrapNumbers = (num: number) => {
    if (num > 99) return "99+";
    else return num;
  };

  useEffect(() => {
    // Load cached courses from MMKV for instant display
    const cached = getCachedCourses();
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
    const regionFiber = Effect.runFork(loadRegion());

    const subscription = Dimensions.addEventListener(
      "change",
      ({ window, screen }) => {
        setDimensions({ window, screen });
      },
    );
    return () => {
      Effect.runFork(Fiber.interrupt(regionFiber));
      subscription?.remove();
    };
  }, []);

  const sortedCourses = useMemo(
    () => (courses ? [...courses].sort((a, b) => a.id - b.id) : []),
    [courses],
  );

  const renderCourseItem = useCallback(
    ({
      item: course,
      index,
    }: {
      item: Schema.Schema.Type<typeof Course>;
      index: number;
    }) => (
      <Pressable
        className="ml-1.5 flex h-24 w-max flex-row justify-between gap-x-2 rounded-2xl bg-gray-300 p-3 px-2.5"
        onPress={() => router.navigate(`/courses/${course.id}`)}
      >
        <View
          className="h-full w-3 rounded-4xl"
          style={{
            backgroundColor: courseColours[index % courseColours.length],
          }}
        />
        <View className="w-max flex-1 flex-row">
          <View
            className="justify-center"
            style={{ width: dimensions.window.width * 0.8 - 32 }}
          >
            <Text
              className="font-display-bold text-lg text-ellipsis"
              numberOfLines={1}
            >
              {course.code}
            </Text>
            <Text numberOfLines={1} className="font-display text-sm">
              {course.name}
            </Text>
          </View>
        </View>
        <View className="size-10 items-center justify-center rounded-lg bg-blue-700">
          <Text className="font-display-semibold text-center text-xs text-white">
            {unreadCounts
              ? unreadCounts[String(course.id)]
                ? wrapNumbers(unreadCounts[String(course.id)].unread)
                : "…"
              : "…"}
          </Text>
        </View>
      </Pressable>
    ),
    [dimensions.window.width, unreadCounts, router],
  );

  const renderRecentThreadItem = useCallback(
    ({ item: thread }: { item: (typeof recentThreads)[number] }) => {
      const courseInfo = courseMap.get(thread.courseId);
      const colour = courseInfo
        ? courseColours[courseInfo.index % courseColours.length]
        : "#d1d5db";
      return (
        <Pressable
          className="mx-1.5 mb-2 rounded-2xl border-l p-3 pl-2.5"
          style={{
            borderLeftColor: colour,
            backgroundColor: "#e5e5e5",
          }}
          onPress={() =>
            router.navigate(`/courses/${thread.courseId}/${thread.number}`)
          }
        >
          <View className="flex w-max flex-row justify-between">
            <Text
              className="font-display-bold max-h-30 w-100 truncate"
              numberOfLines={1}
            >
              {thread.title}
            </Text>
          </View>
          <View className="flex flex-row items-center justify-between">
            <Text className="font-display text-xs" style={{ color: colour }}>
              {courseInfo?.code}
            </Text>
            <View className="flex flex-row">
              {thread.replyCount !== 0 && (
                <View className="flex min-w-10 flex-row items-center">
                  <Text className="font-display pl-2">{thread.replyCount}</Text>
                  <ChatsIcon size={14} />
                </View>
              )}
              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2">{thread.viewCount}</Text>
                <EyeIcon size={14} />
              </View>
              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2">{thread.voteCount}</Text>
                <HeartIcon size={14} />
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [courseMap, router],
  );

  if (!courses) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="p-4 text-center text-gray-500">No Courses Found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-[5]">
        <FlatList
          data={sortedCourses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCourseItem}
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingVertical: 8,
            gap: 6,
          }}
        />
      </View>

      <View className="flex-[4]">
        <Text className="font-display-bold px-4 pb-1 text-sm text-gray-600">
          Recent Messages
        </Text>
        {recentLoading && recentThreads.length === 0 ? (
          <View className="flex gap-y-2 px-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <View
                key={i}
                className="h-20 rounded-2xl bg-gray-200"
                style={{ opacity: 1 - i * 0.2 }}
              />
            ))}
          </View>
        ) : (
          <FlatList
            data={recentThreads}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderRecentThreadItem}
            contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}
          />
        )}
      </View>
    </View>
  );
}
