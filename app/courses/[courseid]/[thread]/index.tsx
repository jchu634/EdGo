import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, Image } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Effect, Schema } from "effect";
import { parseXml } from "react-native-turboxml";
import LinkText from "@/src/components/LinkText";
import {
  EyeIcon,
  HeartIcon,
  StarIcon,
  PushPinIcon,
  CheckCircleIcon,
} from "phosphor-react-native";

import {
  EdComment as CommentSchema,
  ThreadDetailResponse,
} from "@/src/lib/schema";
import { fetchThreadDetail } from "@/src/lib/threads";
import {
  getCachedThreadDetail,
  cacheThreadDetail,
  getCachedParsedXml,
  cacheParsedXml,
} from "@/src/lib/storage";

import "@/app/global.css";

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

function isXmlNode(val: unknown): val is XmlNode {
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.value === "string") return true;
  if (
    (obj.type === "element" || obj.type === "document") &&
    typeof obj.tag === "string" &&
    Array.isArray(obj.children)
  )
    return true;
  return false;
}

const renderXmlNode = (node: XmlNode, keyPrefix = "node"): React.ReactNode => {
  if (node.type === "text") {
    return <Text key={keyPrefix}>{node.value} </Text>;
  }

  if (node.type === "element" || node.type === "document") {
    const children = () =>
      node.children.map((child, i) =>
        renderXmlNode(child, `${keyPrefix}-${node.tag}-${i}`),
      );

    if (node.selfClosing && node.children.length === 0) {
      if (node.tag === "break" || node.tag === "br") {
        return <Text key={keyPrefix}>{"\n"}</Text>;
      }
      return null;
    }

    switch (node.tag) {
      case "document":
        return <View key={keyPrefix}>{children()}</View>;
      case "paragraph":
      case "p":
        return (
          <Text key={keyPrefix} className="font-display mb-2">
            {children()}{" "}
          </Text>
        );
      case "bold":
      case "b":
        return (
          <Text key={keyPrefix} className="font-display-bold">
            {children()}
          </Text>
        );
      case "italic":
      case "i":
        return (
          <Text key={keyPrefix} className="font-display italic">
            {children()}
          </Text>
        );
      case "code":
        return (
          <Text
            key={keyPrefix}
            className="font-display rounded bg-gray-200 px-1 font-mono"
          >
            {children()}
          </Text>
        );
      case "pre":
      case "codeblock":
        return (
          <View key={keyPrefix} className="my-2 rounded-lg bg-gray-200 p-3">
            <Text className="font-mono text-sm">{children()}</Text>
          </View>
        );
      case "list":
        return (
          <View key={keyPrefix} className="mb-2 ml-2">
            {children()}
          </View>
        );
      case "li":
      case "listitem":
        return (
          <View key={keyPrefix} className="mb-1 ml-2 flex-row">
            <Text className="font-display">• </Text>
            <View className="flex-1">{children()}</View>
          </View>
        );
      case "heading":
        return (
          <Text key={keyPrefix} className="font-display-bold mb-1 text-lg">
            {children()}
          </Text>
        );
      case "image": {
        const src = node.attrs.src || node.attrs.url;
        if (src) {
          return (
            <Image
              key={keyPrefix}
              source={{ uri: src }}
              className="my-2 h-40 w-full rounded-lg"
              resizeMode="contain"
            />
          );
        }
        return null;
      }
      case "link": {
        return (
          <LinkText key={keyPrefix} href={node.attrs.href}>
            {children()}
          </LinkText>
        );
      }
      default:
        return <View key={keyPrefix}>{children()}</View>;
    }
  }

  return null;
};

type CommentType = Schema.Schema.Type<typeof CommentSchema>;

const renderComment = (
  comment: CommentType,
  usersMap: Map<number, { name: string; avatar: string | null }>,
  parsedXmlMap: Map<string, XmlNode>,
  courseId: number,
  threadNumber: number,
  depth = 0,
): React.ReactNode => {
  const author = usersMap.get(comment.user_id);
  const xmlKey = `comment-${comment.id}`;
  const parsedXml = parsedXmlMap.get(xmlKey);

  return (
    <View
      key={`comment-${comment.id}`}
      className={`mb-3 rounded-xl bg-gray-100 p-3 ${depth > 0 ? "ml-4 border-l-2 border-gray-300" : ""}`}
    >
      <View className="mb-2 flex-row items-center gap-x-2">
        {author?.avatar ? (
          <Image
            source={{ uri: author.avatar }}
            className="size-6 rounded-full"
          />
        ) : (
          <View className="size-6 items-center justify-center rounded-full bg-gray-400">
            <Text className="text-xs font-semibold text-white">
              {author?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <Text className="font-display-semibold text-sm">
          {author?.name ?? "Anonymous"}
        </Text>
        {comment.type === "answer" && (
          <View className="rounded bg-blue-100 px-1.5 py-0.5">
            <Text className="text-xs text-blue-700">Answer</Text>
          </View>
        )}
        {comment.is_endorsed && (
          <CheckCircleIcon size={14} color="#22c55e" weight="fill" />
        )}
      </View>

      {parsedXml ? (
        <View className="mb-2">
          {renderXmlNode(parsedXml, `cxml-${comment.id}`)}
        </View>
      ) : (
        <Text className="font-display mb-2 text-sm text-gray-700">
          {comment.content}
        </Text>
      )}

      <View className="flex-row items-center gap-x-3">
        <View className="flex-row items-center gap-x-1">
          <HeartIcon size={12} color="#9ca3af" />
          <Text className="text-xs text-gray-500">{comment.vote_count}</Text>
        </View>
        <Text className="text-xs text-gray-400">
          {new Date(comment.created_at).toLocaleDateString()}
        </Text>
      </View>

      {comment.comments.length > 0 &&
        comment.comments.map((reply) =>
          renderComment(
            reply,
            usersMap,
            parsedXmlMap,
            courseId,
            threadNumber,
            depth + 1,
          ),
        )}
    </View>
  );
};

export default function ThreadPage() {
  const { courseid, thread } = useLocalSearchParams();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const threadNumber = Number(Array.isArray(thread) ? thread[0] : thread);

  const [threadData, setThreadData] = useState<Schema.Schema.Type<
    typeof ThreadDetailResponse
  > | null>(null);
  const [parsedXmlMap, setParsedXmlMap] = useState<Map<string, XmlNode>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  const usersMap = useMemo(() => {
    const map = new Map<number, { name: string; avatar: string | null }>();
    if (threadData?.users) {
      for (const user of threadData.users) {
        map.set(user.id, {
          name: user.name,
          avatar: user.avatar,
        });
      }
    }
    return map;
  }, [threadData]);

  const parseAndCacheXml = useCallback(
    async (xmlString: string, xmlKey: string) => {
      try {
        const result = await parseXml(xmlString);
        if (isXmlNode(result)) {
          cacheParsedXml(courseIdNum, threadNumber, xmlKey, result);
          return result as XmlNode;
        }
        const doc = (result as Record<string, unknown>)?.document;
        if (doc && isXmlNode(doc)) {
          cacheParsedXml(courseIdNum, threadNumber, xmlKey, doc);
          return doc as XmlNode;
        }
      } catch (e) {
        console.warn(`[XML] Failed to parse ${xmlKey}:`, e);
      }
      return null;
    },
    [courseIdNum, threadNumber],
  );

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const cached = getCachedThreadDetail(courseIdNum, threadNumber);
      if (cached) {
        setThreadData(cached);

        const xmlMap = new Map<string, XmlNode>();
        const mainCached = getCachedParsedXml(
          courseIdNum,
          threadNumber,
          "main",
        );
        if (mainCached && isXmlNode(mainCached)) {
          xmlMap.set("main", mainCached as XmlNode);
        }
        const loadCommentXml = (comments: typeof cached.thread.comments) => {
          for (const c of comments) {
            const cCached = getCachedParsedXml(
              courseIdNum,
              threadNumber,
              `comment-${c.id}`,
            );
            if (cCached && isXmlNode(cCached)) {
              xmlMap.set(`comment-${c.id}`, cCached as XmlNode);
            }
            if (c.comments.length > 0) loadCommentXml(c.comments);
          }
        };
        loadCommentXml(cached.thread.comments);
        loadCommentXml(cached.thread.answers);
        setParsedXmlMap(xmlMap);
        setLoading(false);
      }

      try {
        const response = (await Effect.runPromise(
          fetchThreadDetail(courseIdNum, threadNumber) as Effect.Effect<
            Schema.Schema.Type<typeof ThreadDetailResponse>,
            Error,
            never
          >,
        )) as Schema.Schema.Type<typeof ThreadDetailResponse>;
        if (!response || cancelled) return;

        setThreadData(response);
        cacheThreadDetail(courseIdNum, threadNumber, response);

        const newXmlMap = new Map<string, XmlNode>();

        const xmlContent = response.thread.content;
        if (xmlContent) {
          const parsed = await parseAndCacheXml(xmlContent, "main");
          if (parsed) {
            newXmlMap.set("main", parsed);
          } else {
            console.warn(
              `[XML] Thread body failed to parse (${xmlContent.length} chars)`,
            );
          }
        }

        const parseComments = async (
          comments:
            | typeof response.thread.comments
            | typeof response.thread.answers,
        ) => {
          for (const c of comments) {
            const commentContent = c.content;
            if (commentContent) {
              const parsed = await parseAndCacheXml(
                commentContent,
                `comment-${c.id}`,
              );
              if (parsed) {
                newXmlMap.set(`comment-${c.id}`, parsed);
              } else {
                console.warn(
                  `[XML] Comment ${c.id} failed to parse (${commentContent.length} chars)`,
                );
              }
            }
            if (c.comments.length > 0) {
              await parseComments(c.comments);
            }
          }
        };
        await parseComments(response.thread.comments);
        await parseComments(response.thread.answers);

        console.log(
          `[XML] Parsed ${newXmlMap.size}/${1 + response.thread.comments.length + response.thread.answers.length} XML entries`,
        );

        if (!cancelled) {
          setParsedXmlMap(newXmlMap);
          setLoading(false);
        }
      } catch (err) {
        console.error("[XML] Failed to load thread detail:", err);
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [courseIdNum, threadNumber, parseAndCacheXml]);

  if (loading && !threadData) {
    return (
      <View className="flex h-full items-center justify-center">
        <ActivityIndicator size="large" color="#70069e" />
      </View>
    );
  }

  if (!threadData) {
    return (
      <View className="flex h-full items-center justify-center">
        <Text className="font-display text-gray-500">Thread not found</Text>
      </View>
    );
  }

  const { thread: t } = threadData;
  const author = usersMap.get(t.user_id);
  const mainXml = parsedXmlMap.get("main");
  const answers = [
    ...t.answers,
    ...t.comments.filter((c) => c.type === "answer"),
  ];
  const comments = t.comments.filter((c) => c.type === "comment");

  return (
    <ScrollView className="flex h-full bg-white">
      <View className="p-4">
        <View className="mb-3 flex-row items-start justify-between">
          <Text className="font-display-bold mr-2 flex-1 text-xl">
            {t.title}
          </Text>
          {t.is_pinned && <PushPinIcon size={18} color="#70069e" />}
        </View>

        <View className="mb-3 flex-row items-center gap-x-2">
          {author?.avatar ? (
            <Image
              source={{ uri: author.avatar }}
              className="size-8 rounded-full"
            />
          ) : (
            <View className="size-8 items-center justify-center rounded-full bg-gray-400">
              <Text className="text-sm font-semibold text-white">
                {author?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <Text className="font-display-semibold">
            {t.is_anonymous ? "Anonymous" : (author?.name ?? "Unknown")}
          </Text>
        </View>

        {t.category && (
          <View className="mb-3 flex-row items-center gap-x-2">
            {t.category && (
              <View className="rounded-full bg-blue-100 px-2.5 py-0.5">
                <Text className="text-xs text-blue-700">{t.category}</Text>
              </View>
            )}
            {t.subcategory && (
              <View className="rounded-full bg-purple-100 px-2.5 py-0.5">
                <Text className="text-xs text-purple-700">{t.subcategory}</Text>
              </View>
            )}
          </View>
        )}

        <View className="mb-4 flex-row items-center gap-x-4">
          <View className="flex-row items-center gap-x-1">
            <EyeIcon size={14} color="#9ca3af" />
            <Text className="text-sm text-gray-500">{t.view_count}</Text>
          </View>
          <View className="flex-row items-center gap-x-1">
            <HeartIcon size={14} color="#9ca3af" />
            <Text className="text-sm text-gray-500">{t.vote_count}</Text>
          </View>
          <View className="flex-row items-center gap-x-1">
            <StarIcon size={14} color="#9ca3af" />
            <Text className="text-sm text-gray-500">{t.star_count}</Text>
          </View>
          {t.is_answered && (
            <View className="flex-row items-center gap-x-1">
              <CheckCircleIcon size={14} color="#22c55e" weight="fill" />
              <Text className="text-sm text-green-600">Answered</Text>
            </View>
          )}
        </View>

        <View className="mb-4 rounded-xl bg-gray-50 p-3">
          {mainXml ? (
            renderXmlNode(mainXml, "thread-body")
          ) : (
            <Text className="font-display text-gray-700">{t.content}</Text>
          )}
        </View>

        {answers.length > 0 && (
          <View className="mb-4">
            <Text className="font-display-bold mb-2 text-base text-green-700">
              Answers
            </Text>
            {answers.map((answer) =>
              renderComment(
                answer,
                usersMap,
                parsedXmlMap,
                courseIdNum,
                threadNumber,
              ),
            )}
          </View>
        )}

        {comments.length > 0 && (
          <View className="mb-8">
            <Text className="font-display-bold mb-2 text-base text-gray-700">
              Comments ({comments.length})
            </Text>
            {comments.map((comment) =>
              renderComment(
                comment,
                usersMap,
                parsedXmlMap,
                courseIdNum,
                threadNumber,
              ),
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
