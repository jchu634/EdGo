import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Effect, Schema } from "effect";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { View, Text, FlatList, Pressable, ScrollView } from "react-native";

import { useLocalSearchParams } from "expo-router";
import { EyeIcon, PushPinIcon, HeartIcon } from "phosphor-react-native";

import { cn } from "@/src/lib/utils";
import { CourseCategory, ThreadResponse } from "@/src/lib/schemas";
import {
  getThreadsByCourse,
  syncThreads,
  type ThreadType,
} from "@/src/lib/courseStorage";
import { getCachedCourseCategory } from "@/src/lib/courseStorage";

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

// Type for the parsed XML AST structure
interface XmlTextNode {
  type: "text";
  value: string;
}

interface XmlElementNode {
  type: "element" | "document";
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  selfClosing?: boolean;
}

type XmlNode = XmlTextNode | XmlElementNode;

// Recursive function to render XML nodes
const renderXmlNode = (node: XmlNode, keyPrefix = "node"): React.ReactNode => {
  // Handle text nodes
  if (node.type === "text") {
    return <Text key={keyPrefix}>{node.value}</Text>;
  }

  // Handle element/document nodes
  if (node.type === "element" || node.type === "document") {
    // For self-closing elements with no children, render nothing visible
    if (node.selfClosing && node.children.length === 0) {
      // Could render a line break for <break /> tags, etc.
      if (node.tag === "break" || node.tag === "br") {
        return <Text key={keyPrefix}>{"\n"}</Text>;
      }
      return null;
    }

    return (
      <View
        key={keyPrefix}
        className="ml-1.5 max-h-40 truncate border-l border-gray-300 pl-2.5"
      >
        {node.children.map((child, index) =>
          renderXmlNode(child, `${keyPrefix}-${node.tag}-${index}`),
        )}
      </View>
    );
  }

  return null;
};

export default function Index() {
  const { courseid } = useLocalSearchParams();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const [currentCategory, setCurrentCategory] = useState<string | undefined>();
  const courseCategories = getCachedCourseCategory(courseIdNum);

  console.log(courseCategories);

  const categoryColourMap = useMemo(
    () => getCategoryColourMap(courseCategories),
    [courseCategories],
  );

  const [threads, setThreads] = useState<ThreadType[]>([]);

  const fetchCourseThreads = (
    course_id: number,
    category?: string,
    offset?: number,
  ) =>
    Effect.gen(function* () {
      if (!process.env.EXPO_PUBLIC_EDSTEM_API_KEY) {
        return yield* Effect.fail(new Error("Missing API Key"));
      }
      const client = yield* HttpClient.HttpClient;
      let requestURL = `https://edstem.org/api/courses/${course_id}/threads?sort=new`;
      if (category) {
        requestURL = `${requestURL}&category=${category}`;
      }
      const request = HttpClientRequest.get(requestURL).pipe(
        HttpClientRequest.setHeader("limit", "100"),
        HttpClientRequest.bearerToken(process.env.EXPO_PUBLIC_EDSTEM_API_KEY),
        HttpClientRequest.acceptJson,
      );

      const response = yield* client.execute(request);
      return yield* HttpClientResponse.schemaBodyJson(ThreadResponse)(response);
    }).pipe(Effect.provide(FetchHttpClient.layer));

  const loadThreadsFromStore = useCallback(async () => {
    if (courseIdNum == null) return;
    try {
      const threads = await getThreadsByCourse(courseIdNum);
      setThreads(threads);
    } catch (e) {
      console.error("Failed to load cached threads", e);
    }
  }, [courseIdNum]);

  useEffect(() => {
    loadThreadsFromStore();

    Effect.runPromise(fetchCourseThreads(courseIdNum))
      .then((threadResponse) => {
        if (!threadResponse) return;
        setThreads([...threadResponse.threads]);
        if (courseIdNum != null) {
          syncThreads(courseIdNum, [...threadResponse.threads]);
        }
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, [courseIdNum, loadThreadsFromStore]);

  // Split threads into pinned and regular
  const pinnedThreads = useMemo(
    () => threads.filter((t) => t.is_pinned),
    [threads],
  );
  const regularThreads = useMemo(
    () => threads.filter((t) => !t.is_pinned),
    [threads],
  );

  const renderPinnedThreadItem = useCallback(
    ({ item }: { item: ThreadType }) => {
      const colour = categoryColourMap.get(item.category);
      return (
        <Pressable
          className="mx-2 w-56 rounded-2xl border-l p-3 pl-2.5"
          style={{
            borderLeftColor: colour || "#d1d5db",
            backgroundColor: "#e5e5e5",
          }}
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
    [categoryColourMap],
  );

  const renderThreadItem = useCallback(
    ({ item }: { item: ThreadType }) => {
      const colour = categoryColourMap.get(item.category);
      return (
        <Pressable
          className="w-80% mx-1.5 mb-3 rounded-2xl border-l p-4 px-4 pl-2.5"
          style={{
            borderLeftColor: colour || "#d1d5db",
            backgroundColor: "#e5e5e5",
          }}
        >
          <View className="flex w-max flex-row justify-between">
            <Text className="font-display-bold max-h-30 w-100 truncate">
              {item.title}
            </Text>
            {item.is_pinned && <PushPinIcon />}
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
                <Text className="font-display pl-2">{item.view_count}</Text>
                <EyeIcon />
              </View>
              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2">{item.vote_count}</Text>
                <HeartIcon />
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [categoryColourMap],
  );

  return (
    <View className="flex">
      {courseCategories && (
        <ScrollView
          horizontal={true}
          className="mb-3 h-20 px-2 pt-4"
          contentContainerClassName="flex-row gap-x-2"
          endFillColorClassName="accent-gray-100"
        >
          {courseCategories.map((category) => (
            <Pressable
              key={category.name}
              className="h-12 items-center justify-center rounded-xl px-3"
              style={{
                backgroundColor:
                  categoryColourMap.get(category.name) || "#eab308",
              }}
              onPress={() => {
                if (currentCategory === category.name)
                  setCurrentCategory(undefined);
                else setCurrentCategory(category.name);
              }}
            >
              <Text className="font-display text-center text-white">
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {pinnedThreads.length > 0 && (
        <View className="mt-2 mb-3">
          <Text className="font-display-bold mb-1.5 px-4 text-sm text-gray-600">
            📌 Pinned
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
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-10">
            <Text className="text-gray-500">No threads found</Text>
          </View>
        }
      />
    </View>
  );
}
