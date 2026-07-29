import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDb } from "@/src/providers/dbProvider";
import { useThreadDetail } from "@/src/hooks/useThreadDetail";
import { useThreadVotes } from "@/src/hooks/useThreadVotes";
import {
  renderComment,
  findCommentById,
} from "@/src/components/thread-comments";

import "@/global.css";

export default function CommentThreadPage() {
  const { courseid, thread, commentid } = useLocalSearchParams();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const threadNumber = Number(Array.isArray(thread) ? thread[0] : thread);
  const commentIdNum = Number(
    Array.isArray(commentid) ? commentid[0] : commentid,
  );
  const db = useDb();

  const {
    thread: t,
    usersMap,
    parsedXmlMap,
    loading,
  } = useThreadDetail(courseIdNum, threadNumber, { sendViewed: false });
  const { commentVotes, commentVoteCounts, toggleCommentVote } = useThreadVotes(
    t,
    db,
  );

  if (loading && !t) {
    return (
      <View className="flex h-full items-center justify-center">
        <ActivityIndicator size="large" color="#70069e" />
      </View>
    );
  }

  if (!t) {
    return (
      <View className="flex h-full items-center justify-center">
        <Text className="font-display text-gray-500">
          Thread not found, You may be offline
        </Text>
      </View>
    );
  }

  const allComments = [...t.comments, ...t.answers];
  const targetComment = findCommentById(allComments, commentIdNum);

  if (!targetComment) {
    return (
      <View className="flex h-full items-center justify-center">
        <Text className="font-display text-gray-500">Comment not found</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex h-full bg-white dark:bg-black">
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
          toggleCommentVote,
        )}
      </View>
    </ScrollView>
  );
}
