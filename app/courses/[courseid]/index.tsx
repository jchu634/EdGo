import React, { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EyeIcon, PushPinIcon, HeartIcon } from "phosphor-react-native";
import { Schema } from "effect";

import { CourseCategory } from "@/src/lib/schemas";
import { getCachedCourseCategory } from "@/src/lib/storage";
import { useCourseThreads } from "@/src/lib/threads";
import type { Thread } from "@/src/db/schema";

import "@/app/global.css";

const categoryColours = [
  "0d74da",
  "249a14",
  "e19e22",
  "b82a2a",
  "6732d0",
  "86c2ff",
  "991471",
  "609a53",
];

const getCategoryColourMap = (
  categories: readonly Schema.Schema.Type<typeof CourseCategory>[] | null,
): Map<string, string> => {
  const map = new Map<string, string>();
  if (!categories) return map;
  categories.forEach((cat, index) => {
    map.set(cat.name, `#${categoryColours[index % categoryColours.length]}`);
  });
  return map;
};

export default function Index() {
  const { courseid } = useLocalSearchParams();
  const router = useRouter();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const [currentCategory, setCurrentCategory] = useState<string | undefined>();
  const courseCategories = getCachedCourseCategory(courseIdNum);

  const categoryColourMap = useMemo(
    () => getCategoryColourMap(courseCategories),
    [courseCategories],
  );

  const {
    pinnedThreads,
    regularThreads,
    loading,
    error,
    fetchMore,
    endOfPages,
  } = useCourseThreads(courseIdNum, currentCategory);

  const navigateToThread = useCallback(
    (threadNumber: number) => {
      router.navigate(`/courses/${courseIdNum}/${threadNumber}`);
    },
    [router, courseIdNum],
  );

  const renderPinnedThreadItem = useCallback(
    ({ item }: { item: Thread }) => {
      const colour = categoryColourMap.get(item.category);
      return (
        <Pressable
          className="mx-2 w-56 rounded-2xl border-l p-3 pl-2.5"
          style={{
            borderLeftColor: colour || "#d1d5db",
            backgroundColor: "#e5e5e5",
          }}
          onPress={() => navigateToThread(item.number)}
        >
          <View className="flex w-full flex-row items-start justify-between">
            <Text
              className="font-display-bold max-h-20 w-44 text-sm"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <PushPinIcon size={14} />
          </View>
          <View className="mt-1 flex flex-row items-center">
            <View
              className="size-4 rounded-full"
              style={{ backgroundColor: colour || "#6b7280" }}
            />
            <Text className="font-display pl-1.5 text-xs">{item.category}</Text>
          </View>
        </Pressable>
      );
    },
    [categoryColourMap, navigateToThread],
  );

  const renderThreadItem = useCallback(
    ({ item }: { item: Thread }) => {
      const colour = categoryColourMap.get(item.category);
      return (
        <Pressable
          className="w-80% mx-1.5 mb-3 rounded-2xl border-l p-4 px-4 pl-2.5"
          style={{
            borderLeftColor: colour || "#d1d5db",
            backgroundColor: "#e5e5e5",
          }}
          onPress={() => navigateToThread(item.number)}
        >
          <View className="flex w-max flex-row justify-between">
            <Text className="font-display-bold max-h-30 w-100 truncate">
              {item.title}
            </Text>
            {item.isPinned && <PushPinIcon />}
          </View>
          <View className="flex flex-row justify-between">
            <View className="flex flex-row items-center">
              <View
                className="size-6 rounded-full"
                style={{ backgroundColor: colour || "#6b7280" }}
              />
              <Text className="font-display pl-2">{item.category}</Text>
            </View>
            <View className="flex flex-row">
              <View className="flex min-w-20 flex-row items-center">
                <Text className="font-display pl-2">{item.viewCount}</Text>
                <EyeIcon />
              </View>
              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2">{item.voteCount}</Text>
                <HeartIcon />
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [categoryColourMap, navigateToThread],
  );

  return (
    <View className="flex h-full">
      {courseCategories && (
        <ScrollView
          horizontal={true}
          className="mb-3 h-25 px-2 pt-4"
          contentContainerClassName="flex-row gap-x-2"
          endFillColorClassName="accent-gray-100"
        >
          {courseCategories.map((category) => {
            const isActive = currentCategory === category.name;
            const colour = categoryColourMap.get(category.name) || "#eab308";
            return (
              <Pressable
                key={category.name}
                className="h-12 items-center justify-center rounded-xl px-3"
                style={
                  isActive
                    ? { borderWidth: 2, borderColor: colour }
                    : { backgroundColor: colour }
                }
                onPress={() => {
                  if (isActive) setCurrentCategory(undefined);
                  else setCurrentCategory(category.name);
                }}
              >
                <Text
                  className="font-display text-center"
                  style={isActive ? { color: colour } : { color: "white" }}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {pinnedThreads.length > 0 && (
        <View className="mt-2 mb-3">
          <Text className="font-display-bold mb-1.5 px-4 text-sm text-gray-600">
            Pinned
          </Text>
          <FlatList
            data={pinnedThreads}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPinnedThreadItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 6,
              paddingVertical: 4,
            }}
          />
        </View>
      )}

      <FlatList
        data={regularThreads}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderThreadItem}
        onEndReached={fetchMore}
        className="h-full"
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-10">
            <Text className="text-gray-500">
              {loading ? "Loading threads..." : "No threads found"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
