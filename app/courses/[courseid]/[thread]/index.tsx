import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";

import {
  EyeIcon,
  HeartIcon,
  StarIcon,
  PushPinIcon,
  CheckCircleIcon,
  ArrowSquareOutIcon,
} from "phosphor-react-native";

import { renderXmlNode } from "@/src/lib/renderXML";
import { settings } from "@/src/lib/storage";
import { useDb } from "@/src/providers/dbProvider";
import { useThreadDetail } from "@/src/hooks/useThreadDetail";
import { useThreadVotes } from "@/src/hooks/useThreadVotes";
import {
  AnimatedToggleIcon,
  renderComment,
} from "@/src/components/ThreadComments";

import "@/global.css";

export default function ThreadPage() {
  const { courseid, thread } = useLocalSearchParams();
  const courseIdNum = Number(Array.isArray(courseid) ? courseid[0] : courseid);
  const threadNumber = Number(Array.isArray(thread) ? thread[0] : thread);

  const db = useDb();
  const {
    thread: t,
    usersMap,
    parsedXmlMap,
    loading,
    isHidden,
  } = useThreadDetail(courseIdNum, threadNumber);
  const {
    isStarred,
    starCount,
    isVoted,
    voteCount,
    commentVotes,
    commentVoteCounts,
    toggleStar,
    toggleVote,
    toggleCommentVote,
  } = useThreadVotes(t, db, isHidden);

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
          {isHidden
            ? "This thread has been deleted or made private."
            : "Thread not found, You may be offline"}
        </Text>
      </View>
    );
  }

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
            onPress={toggleVote}
            IconComponent={HeartIcon}
            onColor="#ef4444"
            offColor="#9ca3af"
            count={voteCount}
          />
          <AnimatedToggleIcon
            isOn={isStarred}
            onPress={toggleStar}
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

        <View className="mb-2 rounded-xl bg-gray-50 p-1 dark:bg-black">
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
                toggleCommentVote,
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
                toggleCommentVote,
              ),
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
