import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Button, View, Text, FlatList } from "react-native";
import { Effect, Schema } from "effect";
import React, { useState, useEffect, useCallback } from "react";
import "@/app/global.css";
import { useLocalSearchParams } from "expo-router";
import { EyeIcon, PushPinIcon, HeartIcon } from "phosphor-react-native";
import {
  User,
  Course,
  Thread,
  UserResponse,
  ThreadResponse,
} from "@/src/lib/Schemas";

import {
  getThreadsByCourse,
  syncThreads,
  type ThreadType,
} from "@/src/lib/courseStorage";
import { getUnreadCounts, UnreadCountEntry } from "@/src/lib/stream";

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
    if (courseid == null) return;
    try {
      const threads = await getThreadsByCourse(parseInt(courseid as string));
      setThreads(threads);
    } catch (e) {
      console.error("Failed to load cached threads", e);
    }
  }, [courseid]);

  useEffect(() => {
    loadThreadsFromStore();

    Effect.runPromise(fetchCourseThreads(parseInt(courseid as string)))
      .then((threadResponse) => {
        if (!threadResponse) return;
        setThreads([...threadResponse.threads]);
        if (courseid != null) {
          syncThreads(parseInt(courseid as string), [
            ...threadResponse.threads,
          ]);
        }
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, [courseid, loadThreadsFromStore]);

  const renderThreadItem = useCallback(
    ({ item }: { item: ThreadType }) => (
      <View className="border-l border-gray-300 pl-2.5 w-full ml-1.5 rounded-2xl bg-gray-300 p-4 px-8 mb-3">
        <View className="flex flex-row justify-between">
          <Text className="max-h-30 truncate font-bold">{item.title}</Text>
          <View>{item.is_pinned && <PushPinIcon />}</View>
        </View>
        <View className="flex flex-row justify-between">
          <View className="flex flex-row items-center">
            <View className="rounded-full bg-red-700 size-6" />
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
    ),
    [],
  );

  return (
    <View className="flex-1">
      <View className="pt-4 px-2">
        <Text className="text-lg font-bold text-center mb-2">{courseid}</Text>
      </View>

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

      <Button
        onPress={() => {
          Effect.runPromise(fetchCourseThreads(parseInt(courseid as string)))
            .then((response) => {
              setThreads([...response.threads]);
              if (courseid != null) {
                syncThreads(parseInt(courseid as string), [
                  ...response.threads,
                ]);
              }
            })
            .catch((error) => {
              console.error("error", error);
            });
        }}
        title="DEBUG Refresh"
        color="#841584"
        accessibilityLabel="Refresh threads"
      />
    </View>
  );
}
