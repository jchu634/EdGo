import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Button, View, Text, Alert, Platform } from "react-native";
import { parseXml } from "react-native-turboxml";
import { Effect, Schema } from "effect";
import { useState, useEffect } from "react";
import "./global.css"
import React from "react";

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
      <View key={keyPrefix} className="border-l border-gray-300 pl-2.5 ml-1.5">
        {node.children.map((child, index) =>
          renderXmlNode(child, `${keyPrefix}-${node.tag}-${index}`)
        )}
      </View>
    );
  }

  return null;
};

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  course_role: Schema.Literal("admin", "student"),
});
const Thread = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  number: Schema.Number,
  user_id: Schema.Number, // User ID = 0 is anonymous
  type: Schema.Literal("post", "question", "announcement"),
  content: Schema.String,
  /*
    No Category/Subcategory is returned as empty string
  */
  category: Schema.String,
  subcategory: Schema.String,
  star_count: Schema.Number,
  vote_count: Schema.Number,
  is_pinned: Schema.Boolean,
  is_answered: Schema.Boolean,
  is_student_answered: Schema.Boolean,
  is_staff_answered: Schema.Boolean,
  is_anonymous: Schema.Boolean,
  user: Schema.NullOr(User),
  // TODO: Add more fields later
});

const ThreadResponse = Schema.Struct({
  threads: Schema.Array(Thread),
  users: Schema.Array(User),
});

export default function Index() {
  const [test, setTest] = useState<XmlNode | undefined>();
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
    Effect.runPromise(fetchCourseThreads(33572))
      .then((response) => {
        // console.log("response", response.threads[1]);
        parseXml(response.threads[1].content)
          .then((data) => {
            setTest(data);
          })
          .catch((err) => console.error("Parse error", err));
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, []);

  return (
    <View
      className="flex-1 justify-center items-center"
    >
      <View>{test && renderXmlNode(test, "root")}</View>
      <Text className="text-blue-400">test</Text>
      <Button
        onPress={() => {
          Effect.runPromise(fetchCourseThreads(33572))
            .then((response) => {
              console.log(response.threads[1].content);
              parseXml(response.threads[1].content)
                .then((data) => {
                  console.log(data); // "MyApp"
                })
                .catch((err) => console.error("Parse error", err));
            })
            .catch((error) => {
              console.error("error", error);
            });
        }}
        

        title="Refresh"
        color="#841584"
        accessibilityLabel="Learn more about this purple button"
      />
    </View>
  );
}
