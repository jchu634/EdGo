import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Effect, Schema } from "effect";
import { parseXml } from "react-native-turboxml";
import { XmlNode, isXmlNode } from "@/src/lib/renderXML";
import { ThreadDetailResponse } from "@/src/lib/schema";
import {
  fetchThreadDetail,
  upvoteComment,
  unvoteComment,
} from "@/src/lib/threads";
import {
  getCachedThreadDetail,
  getCachedParsedXml,
  cacheParsedXml,
} from "@/src/lib/storage";
import {
  renderComment,
  findCommentById,
  type CommentType,
} from "@/src/components/thread-comments";

import "@/app/global.css";

export default function CommentThreadPage() {
  const { courseid, thread, commentid } = useLocalSearchParams();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const threadNumber = Number(Array.isArray(thread) ? thread[0] : thread);
  const commentIdNum = Number(
    Array.isArray(commentid) ? commentid[0] : commentid,
  );

  const [threadData, setThreadData] = useState<Schema.Schema.Type<
    typeof ThreadDetailResponse
  > | null>(null);
  const [parsedXmlMap, setParsedXmlMap] = useState<Map<string, XmlNode>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [commentVotes, setCommentVotes] = useState<Map<number, boolean>>(
    new Map(),
  );
  const [commentVoteCounts, setCommentVoteCounts] = useState<
    Map<number, number>
  >(new Map());

  const initVoteState = useCallback(
    (data: Schema.Schema.Type<typeof ThreadDetailResponse>) => {
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
      if (cached) {
        setThreadData(cached);
        initVoteState(cached);

        const xmlMap = new Map<string, XmlNode>();
        const loadCommentXml = (comments: readonly CommentType[]) => {
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
        initVoteState(response);

        const newXmlMap = new Map<string, XmlNode>();

        const parseComments = async (comments: readonly CommentType[]) => {
          for (const c of comments) {
            if (c.content) {
              const parsed = await parseAndCacheXml(
                c.content,
                `comment-${c.id}`,
              );
              if (parsed) {
                newXmlMap.set(`comment-${c.id}`, parsed);
              }
            }
            if (c.comments.length > 0) {
              await parseComments(c.comments);
            }
          }
        };
        await parseComments(response.thread.comments);
        await parseComments(response.thread.answers);

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

  const handleCommentVote = useCallback(
    async (id: number, currentVoted: boolean) => {
      const next = !currentVoted;
      setCommentVotes((prev) => new Map(prev).set(id, next));
      setCommentVoteCounts((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(id, (nextMap.get(id) ?? 0) + (next ? 1 : -1));
        return nextMap;
      });
      try {
        const fn = next ? upvoteComment : unvoteComment;
        await Effect.runPromise(
          fn(id) as Effect.Effect<boolean, unknown, never>,
        );
      } catch (err) {
        console.error(
          `[Vote] Failed to ${next ? "upvote" : "unvote"} comment ${id}:`,
          err,
        );
        setCommentVotes((prev) => new Map(prev).set(id, !next));
        setCommentVoteCounts((prev) => {
          const nextMap = new Map(prev);
          nextMap.set(id, (nextMap.get(id) ?? 0) + (next ? -1 : 1));
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
        <Text className="font-display text-gray-500">Thread not found</Text>
      </View>
    );
  }

  const allComments = [
    ...threadData.thread.comments,
    ...threadData.thread.answers,
  ];
  const targetComment = findCommentById(allComments, commentIdNum);

  if (!targetComment) {
    return (
      <View className="flex h-full items-center justify-center">
        <Text className="font-display text-gray-500">Comment not found</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex h-full bg-white">
      <View className="p-4">
        {renderComment(
          targetComment,
          usersMap,
          parsedXmlMap,
          courseIdNum,
          threadNumber,
          0,
          commentVotes,
          commentVoteCounts,
          handleCommentVote,
        )}
      </View>
    </ScrollView>
  );
}
