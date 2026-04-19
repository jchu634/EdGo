import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Button, View, Text } from "react-native";
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

  useEffect(() => {
    Effect.runPromise(fetchCourses())
      .then((response) => {
        const mappedCourses = response.courses.map((c) => c.course);
        setCourses(mappedCourses);

        // Pre-warm MMKV stores for all fetched courses
        mappedCourses.forEach((course) => getCourseStore(course.id));


        const firstCourseId = mappedCourses[0]?.id;
        if (!firstCourseId) return;

        return Effect.runPromise(fetchCourseThreads(firstCourseId));
      })
      .then((threadResponse) => {
        if (!threadResponse) return;
        setThreadTest(threadResponse.threads[1]);

        return parseXml(threadResponse.threads[1].content).then(setTest);
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, []);

  return (
    <View className="flex-1 justify-center items-center">
      <View>{test && renderXmlNode(test, "root")}</View>
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
