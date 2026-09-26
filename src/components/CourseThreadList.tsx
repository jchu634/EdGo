import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  EyeIcon,
  PushPinIcon,
  HeartIcon,
  ChatsIcon,
  CheckIcon,
  StarIcon,
} from "phosphor-react-native";
import { Ionicons } from "@expo/vector-icons";
import { Schema } from "effect";
import { useUniwind } from "uniwind";

import { CourseCategory } from "@/src/lib/schema";
import { getCachedCourseCategory } from "@/src/lib/storage";
import { useThreadsDbQuery } from "@/src/hooks/useThreadsDbQuery";
import { useThreadsSync } from "@/src/hooks/useThreadsSync";
import { useSearchDbQuery } from "@/src/hooks/useSearchDbQuery";
import { useSearchSync } from "@/src/hooks/useSearchSync";
import { type ThreadUser } from "@/src/db/schema";
import { useSearchQuery } from "@/src/providers/modalProvider";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";

import "@/global.css";

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

export default function CourseThreadList({
  courseId: courseIdNum,
  sidebar = false,
}: {
  courseId: number;
  sidebar?: boolean;
}) {
  const { theme } = useUniwind();
  const router = useRouter();
  const {
    categories,
    setCategory,
    selectedThread,
    searchRequest,
    isSearchOpen,
    closeSidebarSearch,
    scrollOffsets,
  } = useCourseLayout();
  const currentCategory = categories[courseIdNum];
  const [initialOffset] = useState(
    () => scrollOffsets.current.get(String(courseIdNum)) ?? 0,
  );
  const searchInput = useRef<TextInput>(null);
  const previousSearchRequest = useRef(searchRequest);
  useEffect(() => {
    if (sidebar && searchRequest !== previousSearchRequest.current) {
      searchInput.current?.focus();
    }
    previousSearchRequest.current = searchRequest;
  }, [sidebar, searchRequest]);
  const courseCategories = getCachedCourseCategory(courseIdNum);

  const categoryColourMap = useMemo(
    () => getCategoryColourMap(courseCategories),
    [courseCategories],
  );

  const { pinnedThreads, regularThreads } = useThreadsDbQuery(
    courseIdNum,
    currentCategory,
  );

  const { loading, refreshing, fetchMore, refresh } = useThreadsSync(
    courseIdNum,
    currentCategory,
  );

  const {
    searchQuery,
    searchCourseId,
    searchSort,
    clearSearch,
    setSearchQuery,
  } = useSearchQuery();
  const isSearchMode =
    searchQuery !== null &&
    searchQuery.trim().length > 0 &&
    searchCourseId === courseIdNum;
  const { searchResults } = useSearchDbQuery(
    courseIdNum,
    searchQuery ?? "",
    searchSort,
  );
  const { isSearching } = useSearchSync(
    courseIdNum,
    isSearchMode ? { query: searchQuery, sort: searchSort } : null,
  );

  const navigateToThread = useCallback(
    (threadNumber: number) => {
      if (sidebar && selectedThread !== undefined) {
        if (selectedThread !== threadNumber) {
          router.replace(`/courses/${courseIdNum}/${threadNumber}`);
        }
      } else {
        router.navigate(`/courses/${courseIdNum}/${threadNumber}`);
      }
    },
    [router, courseIdNum, sidebar, selectedThread],
  );

  const renderPinnedThreadItem = useCallback(
    ({ item }: { item: ThreadUser }) => {
      const colour = categoryColourMap.get(item.category);
      const cardClass = (
        item.isSeen
          ? "mx-2 w-56 rounded-2xl border-l bg-gray-200 p-3 pl-2.5 dark:bg-neutral-700"
          : "mx-2 w-56 rounded-2xl border-l bg-gray-300 p-3 pl-2.5 dark:bg-neutral-800"
      ).concat(item.isHidden ? " opacity-60" : "");
      return (
        <Pressable
          className={cardClass}
          style={{
            borderLeftColor: colour || "#d1d5db",
            ...(sidebar && item.number === selectedThread
              ? { borderWidth: 2, borderColor: "#a855f7" }
              : {}),
          }}
          accessibilityState={
            sidebar ? { selected: item.number === selectedThread } : undefined
          }
          onPress={() => navigateToThread(item.number)}
        >
          <View className="flex w-full flex-row items-start justify-between">
            <Text
              className="font-display-bold max-h-20 w-44 text-sm dark:text-slate-100"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <View className="flex flex-row items-center gap-x-1">
              {item.isHidden && (
                <Text className="font-display text-xs text-red-500 dark:text-red-400">
                  Deleted
                </Text>
              )}
              <PushPinIcon
                size={14}
                color={theme === "dark" ? "white" : "black"}
              />
            </View>
          </View>
          <View className="mt-1 flex flex-row items-center">
            <View
              className="size-4 rounded-full"
              style={{ backgroundColor: colour || "#6b7280" }}
            />
            <Text className="font-display pl-1.5 text-xs dark:text-slate-100">
              {item.category}
            </Text>
          </View>
        </Pressable>
      );
    },
    [categoryColourMap, navigateToThread, theme, sidebar, selectedThread],
  );

  const renderThreadItem = useCallback(
    ({ item }: { item: ThreadUser }) => {
      const colour = categoryColourMap.get(item.category);
      const cardClass = (
        item.isSeen
          ? "w-80% mx-1.5 mb-3 rounded-2xl border-l bg-gray-200 p-4 px-4 pl-2.5 dark:bg-neutral-700"
          : "w-80% mx-1.5 mb-3 rounded-2xl border-l bg-gray-300 p-4 px-4 pl-2.5 dark:bg-neutral-800"
      ).concat(item.isHidden ? " opacity-60" : "");
      return (
        <Pressable
          className={cardClass}
          style={{
            borderLeftColor: colour || "#d1d5db",
            ...(sidebar && item.number === selectedThread
              ? { borderWidth: 2, borderColor: "#a855f7" }
              : {}),
          }}
          accessibilityState={
            sidebar ? { selected: item.number === selectedThread } : undefined
          }
          onPress={() => navigateToThread(item.number)}
        >
          <View
            className={
              sidebar
                ? "flex-row justify-between gap-2"
                : "flex w-max flex-row justify-between"
            }
          >
            <Text
              className={
                sidebar
                  ? "font-display-bold flex-1 dark:text-slate-100"
                  : "font-display-bold max-h-30 w-100 truncate dark:text-slate-100"
              }
              numberOfLines={sidebar ? 3 : undefined}
            >
              {item.title}
            </Text>
            <View className="flex flex-row items-center gap-x-1">
              {item.isHidden && (
                <Text className="font-display text-xs text-red-500 dark:text-red-400">
                  Deleted
                </Text>
              )}
              {item.isStarred && (
                <View className="flex flex-row items-center">
                  <StarIcon color="#f59e0b" weight="fill" />
                </View>
              )}
              {item.isAnswered && <CheckIcon color="#3f6212" />}
              {item.isPinned && (
                <PushPinIcon color={theme === "dark" ? "white" : "black"} />
              )}
            </View>
          </View>
          <View
            className={sidebar ? "mt-2 gap-2" : "flex flex-row justify-between"}
          >
            <View className="flex flex-row items-center">
              <View
                className="size-6 rounded-full"
                style={{ backgroundColor: colour || "#6b7280" }}
              />
              <Text
                className={
                  sidebar
                    ? "font-display flex-1 pl-2 dark:text-slate-100"
                    : "font-display pl-2 dark:text-slate-100"
                }
              >
                {item.category}
              </Text>
            </View>
            <View
              className={
                sidebar ? "flex-row flex-wrap gap-y-1" : "flex flex-row"
              }
            >
              {item.replyCount !== 0 && (
                <View className="flex min-w-10 flex-row items-center">
                  <Text className="font-display pl-2 dark:text-slate-100">
                    {item.replyCount}
                  </Text>
                  <ChatsIcon color={theme === "dark" ? "white" : "black"} />
                </View>
              )}

              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2 dark:text-slate-100">
                  {item.viewCount}
                </Text>
                <EyeIcon color={theme === "dark" ? "white" : "black"} />
              </View>
              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2 dark:text-slate-100">
                  {item.voteCount}
                </Text>

                <HeartIcon
                  color={item.isVoted ? "#ef4444" : "#9ca3af"}
                  weight={item.isVoted ? "fill" : "regular"}
                />
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [categoryColourMap, navigateToThread, theme, sidebar, selectedThread],
  );

  return (
    <View
      className={
        sidebar ? "flex-1 bg-white dark:bg-black" : "flex h-full dark:bg-black"
      }
    >
      {sidebar && isSearchOpen && (
        <View className="gap-2 border-b border-gray-200 p-3 dark:border-neutral-700">
          <View className="flex-row items-center justify-between">
            <Text className="font-display-bold dark:text-slate-100">
              Search threads
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={8}
              onPress={() => {
                clearSearch();
                closeSidebarSearch();
              }}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme === "dark" ? "white" : "black"}
              />
            </Pressable>
          </View>
          <TextInput
            ref={searchInput}
            accessibilityLabel="Search course threads"
            placeholder="Search threads..."
            placeholderTextColor="#9ca3af"
            className="font-display rounded-lg border border-gray-200 px-3 py-2 text-gray-800 dark:border-neutral-700 dark:text-slate-100"
            value={searchCourseId === courseIdNum ? (searchQuery ?? "") : ""}
            onChangeText={(query) =>
              setSearchQuery(courseIdNum, query, searchSort)
            }
            returnKeyType="search"
          />
          {isSearchMode && (
            <View className="flex-row flex-wrap gap-2">
              {["relevance", "newest", "oldest"].map((sort) => (
                <Pressable
                  key={sort}
                  accessibilityRole="button"
                  accessibilityState={{ selected: searchSort === sort }}
                  onPress={() => setSearchQuery(courseIdNum, searchQuery, sort)}
                  className={
                    searchSort === sort
                      ? "rounded-lg bg-purple-200 px-2 py-2"
                      : "rounded-lg bg-gray-200 px-2 py-2 dark:bg-neutral-700"
                  }
                >
                  <Text
                    className={
                      searchSort === sort
                        ? "font-display text-purple-900"
                        : "font-display dark:text-slate-100"
                    }
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      {/* Search results banner */}
      {isSearchMode && (
        <View
          className="mx-4 mt-4 mb-3 flex-row items-center rounded-xl px-3 py-2.5"
          style={{ backgroundColor: "#f3e8ff" }}
        >
          <Ionicons name="search" size={16} color="#70069e" />
          <Text
            className="font-display flex-1 px-2 text-sm text-purple-900"
            numberOfLines={1}
          >
            Results for "{searchQuery}"
          </Text>
          {isSearching && (
            <ActivityIndicator
              size="small"
              color="#70069e"
              style={{ marginRight: 8 }}
            />
          )}
          <Pressable onPress={clearSearch}>
            <Ionicons name="close-circle" size={20} color="#70069e" />
          </Pressable>
        </View>
      )}

      {/* Category chips — hidden in search mode */}
      {!isSearchMode && courseCategories && (
        <ScrollView
          horizontal={true}
          className="mb-3 h-25 px-2 pt-4"
          style={
            sidebar ? { flexGrow: 0, flexShrink: 0, height: 84 } : undefined
          }
          contentContainerClassName="flex-row gap-x-2"
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
                  setCategory(
                    courseIdNum,
                    isActive ? undefined : category.name,
                  );
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
      {/* Pinned threads — hidden in search mode */}
      {!isSearchMode && pinnedThreads.length > 0 && (
        <View className="mt-2 mb-3">
          <Text className="font-display-bold mb-1.5 px-4 text-sm text-gray-600 dark:text-slate-100">
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
        data={isSearchMode ? searchResults : regularThreads}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderThreadItem}
        onEndReached={isSearchMode ? undefined : fetchMore}
        onRefresh={isSearchMode ? undefined : refresh}
        refreshing={isSearchMode ? false : refreshing}
        className={sidebar ? "flex-1" : "h-full"}
        contentOffset={{ x: 0, y: initialOffset }}
        onScroll={(event) =>
          scrollOffsets.current.set(
            String(courseIdNum),
            event.nativeEvent.contentOffset.y,
          )
        }
        scrollEventThrottle={100}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-10">
            <Text className="text-gray-500 dark:text-slate-100">
              {isSearchMode
                ? isSearching
                  ? "Searching..."
                  : "No threads match your search"
                : loading
                  ? "Loading threads..."
                  : "No threads found"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
