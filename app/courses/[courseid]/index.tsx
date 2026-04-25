import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import {
  Button,
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
} from "react-native";
import { Effect, Schema } from "effect";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import "@/app/global.css";
import { useLocalSearchParams } from "expo-router";
import { EyeIcon, PushPinIcon, HeartIcon } from "phosphor-react-native";
import { Course, Thread, ThreadResponse } from "@/src/lib/schemas";

import {
  getThreadsByCourse,
  syncThreads,
  type ThreadType,
} from "@/src/lib/courseStorage";
import { getUnreadCounts, UnreadCountEntry } from "@/src/lib/stream";
import { getCachedCourseCategory } from "@/src/lib/courseStorage";

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
  categories: ReadonlyArray<{ name: string }> | null,
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
        className="border-l border-gray-300 pl-2.5 ml-1.5 max-h-40 truncate"
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
  const courseCategories = getCachedCourseCategory(courseIdNum);
  console.log(courseCategories);

  const categoryColourMap = useMemo(
    () => getCategoryColourMap(courseCategories),
    [courseCategories],
  );

  const [threads, setThreads] = useState<ThreadType[]>([]);

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

  const renderThreadItem = useCallback(
    ({ item }: { item: ThreadType }) => {
      const colour = categoryColourMap.get(item.category);
      return (
        <View
          className="border-l border-gray-300 pl-2.5 w-full ml-1.5 rounded-2xl bg-gray-300 p-4 px-8 mb-3"
          style={{ borderLeftColor: colour || "#d1d5db" }}
        >
          <View className="flex flex-row justify-between">
            <Text className="max-h-30 truncate font-bold">{item.title}</Text>
            <View>{item.is_pinned && <PushPinIcon />}</View>
          </View>
          <View className="flex flex-row justify-between">
            <View className="flex flex-row items-center">
              <View
                className="rounded-full size-6"
                style={{ backgroundColor: colour || "#6b7280" }}
              />
              <Text className="pl-2">{item.category}</Text>
            </View>
            <View className="flex flex-row">
              <View className="flex flex-row items-center min-w-20">
                <Text className="pl-2">{item.view_count}</Text>
                <EyeIcon />
              </View>
              <View className="flex flex-row items-center min-w-10">
                <Text className="pl-2">{item.vote_count}</Text>
                <HeartIcon />
              </View>
            </View>
          </View>
        </View>
      );
    },
    [categoryColourMap],
  );

  return (
    <View className="flex-1">
      {courseCategories && (
        <ScrollView
          horizontal={true}
          className="pt-4 px-2 mb-3 h-20"
          contentContainerClassName="flex-row gap-x-2"
          endFillColorClassName="accent-gray-100"
        >
          {courseCategories.map((category) => (
            <Pressable
              key={category.name}
              className="rounded-xl h-12 px-3 items-center justify-center"
              style={{
                backgroundColor:
                  categoryColourMap.get(category.name) || "#eab308",
              }}
            >
              <Text className="text-center text-white">{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={threads}
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
