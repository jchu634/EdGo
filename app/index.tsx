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
import "./global.css";
import { EyeIcon, PushPinIcon, HeartIcon } from "phosphor-react-native";
import {
  User,
  Course,
  Thread,
  UserResponse,
  ThreadResponse,
} from "../src/lib/Schemas";

import { getCourseStore } from "../src/lib/courseStorage";
import { getUnreadCounts, UnreadCountEntry } from "../src/lib/stream";

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
  const [test, setTest] = useState<XmlNode | undefined>();
  const [courses, setCourses] = useState<
    Schema.Schema.Type<typeof Course>[] | undefined
  >();
  const [theadTest, setThreadTest] = useState<
    Schema.Schema.Type<typeof Thread> | undefined
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
    Effect.runPromise(fetchCourses())
      .then((response) => {
        const mappedCourses = response.courses.map((c) => c.course);
        mappedCourses.sort();
        setCourses(mappedCourses);

        // Pre-warm MMKV stores for all fetched courses
        mappedCourses.forEach((course) => getCourseStore(course.id));

        // Fetch unread counts via WebSocket (non-blocking)
        getUnreadCounts()
          .then((counts) => {
            console.log("[stream] Unread counts:", counts);
            setUnreadCounts(counts.data);
          })
          .catch((err) => console.error("[stream] Error:", err));

        const firstCourseId = mappedCourses[0]?.id;
        if (!firstCourseId) return;

        return Effect.runPromise(fetchCourseThreads(firstCourseId));
      })
      .then((threadResponse) => {
        if (!threadResponse) return;
        setThreadTest(threadResponse.threads[1]);

        // Cache threads for the first course in its own MMKV store
        const firstCourseId = courses?.[0]?.id;
        if (firstCourseId != null) {
          const store = getCourseStore(firstCourseId);
          store.set("threads", JSON.stringify(threadResponse.threads));
        }

        return parseXml(threadResponse.threads[1].content).then(setTest);
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, []);

  return (
    <View className="flex-1 justify-center items-center">
      <View>{test && renderXmlNode(test, "root")}</View>
      <View className="h-fit">
        {courses ? (
          <View className="w-screen p-4 flex flex-col gap-y-2 min-h-40 justify-center">
            {courses.map((course) => (
              <View
                key={course.id}
                className="border-l border-gray-300 pl-2.5 w-max h-30 ml-1.5 rounded-2xl bg-gray-300 p-4 px-8  flex flex-row"
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
              </View>
            ))}
          </View>
        ) : (
          <Text className="w-screen p-4 flex flex-col space-y-4 text-center ">
            No Courses Found
          </Text>
        )}
      </View>
      {/*<View>{test && renderXmlNode(test, "root")}</View>*/}
      <View className="border-l border-gray-300 pl-2.5 w-full ml-1.5 rounded-2xl bg-gray-300 p-4 px-8">
        <View className="flex flex-row justify-between">
          <Text className="max-h-30 truncate font-bold">
            {theadTest?.title}
          </Text>
          <View>{theadTest?.is_pinned && <PushPinIcon />}</View>
        </View>
        <View className="flex flex-row justify-between">
          <View className="flex flex-row items-center">
            <View className="rounded-full bg-red-700 size-6" />
            <Text className="pl-2">{theadTest?.category}</Text>
          </View>
          <View className="flex flex-row">
            <View className="flex flex-row items-center min-w-20">
              <Text className="pl-2">{theadTest?.view_count}</Text>
              <EyeIcon />
            </View>
            <View className="flex flex-row items-center min-w-10">
              <Text className="pl-2">{theadTest?.vote_count}</Text>
              <HeartIcon />
            </View>
          </View>
        </View>
      </View>

      <Button
        onPress={() => {
          Effect.runPromise(fetchCourseThreads(33572))
            .then((response) => {
              console.log(response.threads[1].content);
              parseXml(response.threads[1].content)
                .then((data) => {
                  console.log(data);
                })
                .catch((err) => console.error("Parse error", err));
            })
            .catch((error) => {
              console.error("error", error);
            });
        }}
        title="DEBUG Refresh"
        color="#841584"
        accessibilityLabel="Learn more about this purple button"
      />
    </View>
  );
}
