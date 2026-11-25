import { Duration, Effect, Fiber, Schedule, type Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { useRouter } from "expo-router";
import { CaretDownIcon, CaretRightIcon } from "phosphor-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import { useUniwind } from "uniwind";
import RecentThreadCard from "@/src/components/RecentThreadCard";
import { useRecentThreads } from "@/src/hooks/useRecentThreads";
import { type Course, RegionResponse, UserResponse } from "@/src/lib/schema";
import {
  cacheCourses,
  getApiKey,
  getCachedCourses,
  settings,
} from "@/src/lib/storage";
import { getUnreadCounts, type UnreadCountEntry } from "@/src/lib/stream";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";
import { useNetwork } from "@/src/providers/networkProvider";

import "@/global.css";

const courseColours = ["#16DB93", "#F72585", "#014d3a", "#6A66A3", "#FF7F11"];

const colourForCourse = (id: number) =>
  courseColours[id % courseColours.length];

type CourseListItem =
  | { kind: "course"; course: Schema.Schema.Type<typeof Course> }
  | { kind: "archivedHeader"; count: number };

export default function Index() {
  const { theme } = useUniwind();
  const { isWide } = useCourseLayout();
  const [largerCards = false] = useMMKVBoolean(
    "ui.larger_cards",
    settings ?? undefined,
  );
  const [archivedCollapsed = false, setArchivedCollapsed] = useMMKVBoolean(
    "ui.archived_courses_collapsed",
    settings ?? undefined,
  );

  const { isOnline } = useNetwork();

  const router = useRouter();
  const [courses, setCourses] = useState<
    Schema.Schema.Type<typeof Course>[] | undefined
  >();

  const [unreadCounts, setUnreadCounts] = useState<
    Record<string, UnreadCountEntry> | undefined
  >();

  const { threads: recentThreads, loading: recentLoading } = useRecentThreads(
    courses,
    isWide ? 30 : 5,
  );

  const courseMap = useMemo(() => {
    const map = new Map<number, { code: string }>();
    if (!courses) return map;
    for (const c of courses) {
      map.set(c.id, { code: c.code });
    }
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
        settings!.set("user.default_region", region.default_region);
        settings!.set("user.country_code", region.country_code);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cached data for instant display
      setCourses(cached);
    }

    const coursesFiber = Effect.runFork(
      fetchCourses().pipe(
        Effect.flatMap((response) =>
          Effect.sync(() => {
            const mappedCourses = response.courses.map((c) => c.course);
            mappedCourses.sort((a, b) => a.id - b.id);
            setCourses(mappedCourses);
            cacheCourses(mappedCourses);
          }),
        ),
        Effect.tapError((error) =>
          Effect.sync(() => console.error("error", error)),
        ),
        Effect.catch(() => Effect.void),
      ),
    );
    const regionFiber = Effect.runFork(loadRegion());

    return () => {
      Effect.runFork(Fiber.interrupt(coursesFiber));
      Effect.runFork(Fiber.interrupt(regionFiber));
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    const unreadFiber = Effect.runFork(
      Effect.tryPromise({
        try: () => getUnreadCounts(),
        catch: (err) => new Error(String(err)),
      }).pipe(
        Effect.flatMap((counts) =>
          Effect.sync(() => setUnreadCounts(counts.data)),
        ),
        Effect.tapError((err) =>
          Effect.sync(() => console.error("[stream] Error:", err)),
        ),
        Effect.catch(() => Effect.void),
      ),
    );

    return () => {
      Effect.runFork(Fiber.interrupt(unreadFiber));
    };
  }, [isOnline]);

  const listData = useMemo<CourseListItem[]>(() => {
    if (!courses) return [];
    const byId = (
      a: Schema.Schema.Type<typeof Course>,
      b: Schema.Schema.Type<typeof Course>,
    ) => a.id - b.id;
    const active = courses.filter((c) => c.status !== "archived").sort(byId);
    const archived = courses.filter((c) => c.status === "archived").sort(byId);
    const items: CourseListItem[] = active.map(
      (course): CourseListItem => ({ kind: "course", course }),
    );
    if (archived.length > 0) {
      items.push({ kind: "archivedHeader", count: archived.length });
      if (!archivedCollapsed) {
        items.push(
          ...archived.map(
            (course): CourseListItem => ({ kind: "course", course }),
          ),
        );
      }
    }
    return items;
  }, [courses, archivedCollapsed]);

  const renderListItem = useCallback(
    ({ item }: { item: CourseListItem }) => {
      if (item.kind === "archivedHeader") {
        const iconColor = theme === "dark" ? "#f1f5f9" : "#4b5563";
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Archived courses (${item.count})`}
            accessibilityState={{ expanded: !archivedCollapsed }}
            onPress={() => setArchivedCollapsed(!archivedCollapsed)}
            className="flex-row items-center gap-x-1.5 px-3 pt-3 pb-1"
          >
            {archivedCollapsed ? (
              <CaretRightIcon size={14} weight="bold" color={iconColor} />
            ) : (
              <CaretDownIcon size={14} weight="bold" color={iconColor} />
            )}
            <Text className="font-display-bold text-sm text-gray-600 dark:text-slate-100">
              Archived ({item.count})
            </Text>
          </Pressable>
        );
      }

      const { course } = item;

      const loaded = unreadCounts !== undefined;
      const count = loaded
        ? (unreadCounts?.[String(course.id)]?.unread ?? 0)
        : 0;
      const showBadge = isOnline && (count > 0 || !loaded);

      return (
        <Pressable
          className="mx-1 flex h-24 flex-row items-center justify-between gap-x-2.5 rounded-2xl bg-gray-300 p-3 px-2.5 dark:bg-neutral-800"
          onPress={() => router.navigate(`/courses/${course.id}`)}
        >
          <View
            className="h-full w-3 shrink-0 rounded-4xl"
            style={{ backgroundColor: colourForCourse(course.id) }}
          />
          <View className="min-w-0 flex-1 justify-center">
            <Text
              className="font-display-bold text-lg dark:text-slate-100"
              numberOfLines={1}
            >
              {course.code}
            </Text>
            <Text
              numberOfLines={1}
              className="font-display text-sm dark:text-slate-100"
            >
              {course.name}
            </Text>
          </View>
          {showBadge && (
            <View className="size-10 shrink-0 items-center justify-center rounded-lg bg-blue-700">
              <Text className="font-display-semibold text-center text-xs text-white">
                {loaded ? wrapNumbers(count) : "…"}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [
      archivedCollapsed,
      setArchivedCollapsed,
      theme,
      unreadCounts,
      isOnline,
      router,
    ],
  );

  const renderRecentThreadItem = useCallback(
    ({ item: thread }: { item: (typeof recentThreads)[number] }) => {
      const courseInfo = courseMap.get(thread.courseId);
      const colour = courseInfo ? colourForCourse(thread.courseId) : "#d1d5db";
      return (
        <RecentThreadCard
          title={thread.title}
          courseCode={courseInfo?.code}
          colour={colour}
          replyCount={thread.replyCount}
          viewCount={thread.viewCount}
          voteCount={thread.voteCount}
          largerCards={largerCards}
          onPress={() =>
            router.navigate(`/courses/${thread.courseId}/${thread.number}`)
          }
        />
      );
    },
    [courseMap, router, largerCards],
  );

  if (!courses) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="p-4 text-center text-gray-500">No Courses Found</Text>
      </View>
    );
  }

  const coursesList = (
    <FlatList
      data={listData}
      keyExtractor={(item) =>
        item.kind === "course" ? item.course.id.toString() : "archived-header"
      }
      renderItem={renderListItem}
      contentContainerStyle={{
        paddingHorizontal: 8,
        paddingVertical: 8,
        gap: 6,
      }}
    />
  );

  const recentThreadsSection = (
    <>
      <Text
        className={
          isWide
            ? "font-display-bold px-4 pt-3 pb-2 text-sm text-gray-600 dark:text-slate-100"
            : "font-display-bold px-4 pb-1 text-sm text-gray-600 dark:text-slate-100"
        }
      >
        Recent Threads
      </Text>
      {recentLoading && recentThreads.length === 0 ? (
        <View className="flex gap-y-2 px-4">
          {Array.from({ length: isWide ? 6 : 3 }).map((_, i) => (
            <View
              key={i}
              className="h-20 rounded-2xl bg-gray-200 dark:bg-neutral-800"
              style={{ opacity: Math.max(0.2, 1 - i * 0.15) }}
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
    </>
  );

  if (isWide) {
    return (
      <View className="flex-1 flex-row dark:bg-black">
        <View className="flex-3">{coursesList}</View>
        <View className="w-px bg-gray-300 dark:bg-neutral-800" />
        <View className="flex-2">{recentThreadsSection}</View>
      </View>
    );
  }

  return (
    <View className="flex-1 dark:bg-black">
      <View className="flex-5">{coursesList}</View>
      <View className="flex-4">{recentThreadsSection}</View>
    </View>
  );
}
