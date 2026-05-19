import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Effect, Schema } from "effect";
import { parseXml } from "react-native-turboxml";
import { XmlNode, renderXmlNode, isXmlNode } from "@/src/lib/renderXML";
import * as Linking from "expo-linking";
import { settings } from "@/src/lib/storage";

import {
  EyeIcon,
  HeartIcon,
  StarIcon,
  PushPinIcon,
  CheckCircleIcon,
  ArrowSquareOutIcon,
} from "phosphor-react-native";

import { ThreadDetailResponse } from "@/src/lib/schema";
import {
  fetchThreadDetail,
  sendThreadViewed,
  starThread,
  unstarThread,
  upvoteThread,
  unvoteThread,
  upvoteComment,
  unvoteComment,
} from "@/src/lib/threads";
import {
  getCachedThreadDetail,
  cacheThreadDetail,
  getCachedParsedXml,
  cacheParsedXml,
} from "@/src/lib/storage";
import { threadsTable } from "@/src/db/schema";
import { useDb } from "@/src/providers/dbProvider";
import { eq } from "drizzle-orm";
import {
  AnimatedToggleIcon,
  renderComment,
  type CommentType,
} from "@/src/components/thread-comments";

import "@/app/global.css";

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
  const db = useDb();

  const [isStarred, setIsStarred] = useState(false);
  const [starCount, setStarCount] = useState(0);
  const [isVoted, setIsVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [commentVotes, setCommentVotes] = useState<Map<number, boolean>>(
    new Map(),
  );
  const [commentVoteCounts, setCommentVoteCounts] = useState<
    Map<number, number>
  >(new Map());

  const initVoteState = useCallback(
    (data: Schema.Schema.Type<typeof ThreadDetailResponse>) => {
      setIsStarred(data.thread.is_starred);
      setStarCount(data.thread.star_count);
      setIsVoted((data.thread.vote ?? 0) === 1);
      setVoteCount(data.thread.vote_count);

      const votes = new Map<number, boolean>();
      const counts = new Map<number, number>();
      const process = (comments: readonly CommentType[]) => {
        for (const c of comments) {
          votes.set(c.id, c.vote === 1);
          counts.set(c.id, c.vote_count);
          if (c.comments.length > 0) process(c.comments);
        }
      };
      process(data.thread.comments);
      process(data.thread.answers);
      setCommentVotes(votes);
      setCommentVoteCounts(counts);
    },
    [],
  );

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
      setLoading(true);
      setParsedXmlMap(new Map());
      const cached = getCachedThreadDetail(courseIdNum, threadNumber);
      if (!cached) {
        setThreadData(null);
      } else {
        setThreadData(cached);
        initVoteState(cached);

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
        initVoteState(response);

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
  }, [courseIdNum, threadNumber, parseAndCacheXml, initVoteState]);

  useEffect(() => {
    if (!threadData) return;

    Effect.runFork(
      sendThreadViewed(threadData.thread.id) as Effect.Effect<
        boolean,
        Error,
        never
      >,
    );
  }, [threadData]);

  const handleStar = useCallback(async () => {
    if (!threadData) return;
    const next = !isStarred;
    setIsStarred(next);
    setStarCount((c) => (next ? c + 1 : c - 1));
    try {
      const fn = next ? starThread : unstarThread;
      await Effect.runPromise(
        fn(threadData.thread.id) as Effect.Effect<boolean, unknown, never>,
      );
      await db
        .update(threadsTable)
        .set({
          isStarred: next,
          starCount: next ? starCount + 1 : starCount - 1,
        })
        .where(eq(threadsTable.id, threadData.thread.id));
    } catch (err) {
      console.error(
        `[Star] Failed to ${next ? "star" : "unstar"} thread ${threadData.thread.id}:`,
        err,
      );
      setIsStarred(!next);
      setStarCount((c) => (next ? c - 1 : c + 1));
    }
  }, [threadData, isStarred, db, starCount]);

  const handleVote = useCallback(async () => {
    if (!threadData) return;
    const next = !isVoted;
    setIsVoted(next);
    setVoteCount((c) => (next ? c + 1 : c - 1));
    try {
      const fn = next ? upvoteThread : unvoteThread;
      await Effect.runPromise(
        fn(threadData.thread.id) as Effect.Effect<boolean, unknown, never>,
      );
      await db
        .update(threadsTable)
        .set({ isVoted: next, voteCount: next ? voteCount + 1 : voteCount - 1 })
        .where(eq(threadsTable.id, threadData.thread.id));
    } catch (err) {
      console.error(
        `[Vote] Failed to ${next ? "upvote" : "unvote"} thread ${threadData.thread.id}:`,
        err,
      );
      setIsVoted(!next);
      setVoteCount((c) => (next ? c - 1 : c + 1));
    }
  }, [threadData, isVoted, db, voteCount]);

  const handleCommentVote = useCallback(
    async (commentId: number, currentVoted: boolean) => {
      const next = !currentVoted;
      setCommentVotes((prev) => new Map(prev).set(commentId, next));
      setCommentVoteCounts((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(commentId, (nextMap.get(commentId) ?? 0) + (next ? 1 : -1));
        return nextMap;
      });
      try {
        const fn = next ? upvoteComment : unvoteComment;
        await Effect.runPromise(
          fn(commentId) as Effect.Effect<boolean, unknown, never>,
        );
      } catch (err) {
        console.error(
          `[Vote] Failed to ${next ? "upvote" : "unvote"} comment ${commentId}:`,
          err,
        );
        setCommentVotes((prev) => new Map(prev).set(commentId, !next));
        setCommentVoteCounts((prev) => {
          const nextMap = new Map(prev);
          nextMap.set(
            commentId,
            (nextMap.get(commentId) ?? 0) + (next ? -1 : 1),
          );
          return nextMap;
        });
      }
    },
    [],
  );

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
        <Text className="font-display text-gray-500">
          Thread not found, You may be offline
        </Text>
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
    <ScrollView className="flex h-full bg-white dark:bg-black">
      <View className="p-4">
        <View className="mb-3 flex-row items-start justify-between">
          <Text className="font-display-bold mr-2 flex-1 text-xl dark:text-slate-100">
            {t.title}
          </Text>
          {t.is_pinned && <PushPinIcon size={18} color="#70069e" />}
        </View>

        <View className="mb-3 flex-row items-center gap-x-2">
          {!t.is_anonymous && author?.avatar ? (
            <Image
              source={{
                uri: `https://static.${settings!.getString("user.default_region")}.edusercontent.com/avatars/${author.avatar}?s=128&fallback=1`,
              }}
              className="size-8 rounded-full"
            />
          ) : (
            <View className="size-8 items-center justify-center rounded-full bg-gray-400">
              <Text className="text-sm font-semibold text-white">
                {author?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}

          <Text className="font-display-semibold dark:text-slate-100">
            {t.is_anonymous ? "Anonymous" : (author?.name ?? "Unknown")}
          </Text>
          <View className="flex flex-row items-center gap-x-4">
            <Text className="font-display dark:text-slate-100">
              {t.updated_at
                ? `Updated: ${new Date(t.updated_at).toLocaleDateString()}`
                : `Created: ${new Date(t.created_at).toLocaleDateString()}`}
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://edstem.org/${settings!.getString("user.default_region")}/courses/${courseIdNum}/discussion/${t.id}`,
                )
              }
            >
              <ArrowSquareOutIcon size={20} color="#1e40af" />
            </Pressable>
          </View>
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
          <AnimatedToggleIcon
            isOn={isVoted}
            onPress={handleVote}
            IconComponent={HeartIcon}
            onColor="#ef4444"
            offColor="#9ca3af"
            count={voteCount}
          />
          <AnimatedToggleIcon
            isOn={isStarred}
            onPress={handleStar}
            IconComponent={StarIcon}
            onColor="#f59e0b"
            offColor="#9ca3af"
            count={starCount}
          />
          {t.is_answered && (
            <View className="flex-row items-center gap-x-1">
              <CheckCircleIcon size={14} color="#22c55e" weight="fill" />
              <Text className="text-sm text-green-600">Answered</Text>
            </View>
          )}
        </View>

        <View className="mb-4 rounded-xl bg-gray-50 p-3 dark:bg-black">
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
                0,
                commentVotes,
                commentVoteCounts,
                handleCommentVote,
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
                0,
                commentVotes,
                commentVoteCounts,
                handleCommentVote,
              ),
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
