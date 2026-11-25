import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import {
  findCommentById,
  renderComment,
} from "@/src/components/ThreadComments";
import ThreadFullscreenButton from "@/src/components/ThreadFullscreenButton";
import { useMaxThreadNumber } from "@/src/hooks/useMaxThreadNumber";
import { useThreadDetail } from "@/src/hooks/useThreadDetail";
import { useThreadVotes } from "@/src/hooks/useThreadVotes";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";
import { useDb } from "@/src/providers/dbProvider";

import "@/global.css";

export default function CommentThreadPage() {
  const { isWide } = useCourseLayout();
  const { courseid, thread, commentid } = useLocalSearchParams();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const threadNumber = Number(Array.isArray(thread) ? thread[0] : thread);
  const commentIdNum = Number(
    Array.isArray(commentid) ? commentid[0] : commentid,
  );
  const db = useDb();
  const maxThreadNumber = useMaxThreadNumber(courseIdNum, threadNumber);

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
      <View className="flex h-full items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#70069e" />
      </View>
    );
  }

  if (!t) {
    return (
      <View className="flex h-full items-center justify-center bg-white dark:bg-black">
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
      <View className="flex h-full items-center justify-center bg-white dark:bg-black">
        <Text className="font-display text-gray-500">Comment not found</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex h-full bg-white dark:bg-black">
      <View className="p-4">
        {isWide && (
          <View className="mb-3 flex-row items-start justify-between">
            <Text className="font-display-bold mr-2 flex-1 text-xl dark:text-slate-100">
              {t.title}
            </Text>
            <ThreadFullscreenButton />
          </View>
        )}
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
          maxThreadNumber,
        )}
      </View>
    </ScrollView>
  );
}
