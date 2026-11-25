import type { Schema } from "effect";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { HeartIcon, MedalIcon } from "phosphor-react-native";
import type React from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { renderXmlNode, type XmlNode } from "@/src/lib/renderXML";
import type { EdComment as CommentSchema } from "@/src/lib/schema";
import { settings } from "@/src/lib/storage";

export type CommentType = Schema.Schema.Type<typeof CommentSchema>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MAX_DEPTH = 5;

export function AnimatedToggleIcon({
  isOn,
  onPress,
  IconComponent,
  onColor,
  offColor,
  count,
  size = 18,
}: {
  isOn: boolean;
  onPress: () => void;
  IconComponent: typeof HeartIcon;
  onColor: string;
  offColor: string;
  count: number;
  size?: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    scale.set(withSequence(withSpring(1.35), withSpring(1)));
    onPress();
  };

  return (
    <View className="flex-row items-center gap-x-1">
      <AnimatedPressable onPress={handlePress} style={animatedStyle}>
        <IconComponent
          size={size}
          color={isOn ? onColor : offColor}
          weight={isOn ? "fill" : "regular"}
        />
      </AnimatedPressable>
      <Text className="text-xs text-gray-500">{count}</Text>
    </View>
  );
}

export function findCommentById(
  comments: readonly CommentType[],
  id: number,
): CommentType | null {
  for (const c of comments) {
    if (c.id === id) return c;
    const found = findCommentById(c.comments, id);
    if (found) return found;
  }
  return null;
}

export function renderComment(
  comment: CommentType,
  usersMap: Map<number, { name: string; avatar: string | null }>,
  parsedXmlMap: Map<string, XmlNode>,
  courseId: number,
  threadNumber: number,
  depth: number,
  commentVotes: Map<number, boolean>,
  commentVoteCounts: Map<number, number>,
  onVoteToggle: (commentId: number, currentVoted: boolean) => void,
  maxThreadNumber?: number,
): React.ReactNode {
  const author = usersMap.get(comment.user_id);
  const xmlKey = `comment-${comment.id}`;
  const parsedXml = parsedXmlMap.get(xmlKey);
  const isVoted = commentVotes.get(comment.id) ?? false;
  const voteCount = commentVoteCounts.get(comment.id) ?? comment.vote_count;

  const hasReplies = comment.comments.length > 0;
  const shouldTruncate = hasReplies && depth >= MAX_DEPTH;

  return (
    <View
      key={`comment-${comment.id}`}
      className={depth === 0 ? "mb-3" : undefined}
    >
      <View
        className={`rounded-xl bg-gray-100 p-3 dark:bg-gray-800 ${
          depth > 0 ? "border-l-2 border-gray-300 dark:border-gray-600" : ""
        }`}
      >
        <View className="mb-2 flex-row items-center gap-x-2">
          {!comment.is_anonymous && author?.avatar ? (
            <Image
              source={{
                uri: `https://static.${settings!.getString("user.default_region")}.edusercontent.com/avatars/${author.avatar}?s=128&fallback=1`,
              }}
              className="size-6 rounded-full"
            />
          ) : (
            <View className="size-6 items-center justify-center rounded-full bg-gray-400">
              <Text className="text-xs font-semibold text-white">
                {comment.is_anonymous
                  ? "?"
                  : (author?.name?.charAt(0)?.toUpperCase() ?? "?")}
              </Text>
            </View>
          )}
          <Text className="font-display-semibold text-sm dark:text-slate-100">
            {comment.is_anonymous
              ? "Anonymous"
              : (author?.name ?? "Unknown")}{" "}
          </Text>
          {comment.is_endorsed && (
            <View className="flex-row items-center gap-x-1 rounded-full border border-blue-500 bg-blue-500/10 px-2 py-0.5">
              <MedalIcon size={14} color="#3b82f6" weight="fill" />
              <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Endorsed
              </Text>
            </View>
          )}
        </View>

        {parsedXml ? (
          <View className="mb-2">
            {renderXmlNode(parsedXml, `cxml-${comment.id}`, 1, {
              courseId,
              maxThreadNumber,
            })}
          </View>
        ) : (
          <Text className="font-display mb-2 text-sm text-gray-700 dark:text-gray-300">
            {comment.content}
          </Text>
        )}

        <View className="flex-row items-center gap-x-2">
          <AnimatedToggleIcon
            isOn={isVoted}
            onPress={() => onVoteToggle(comment.id, isVoted)}
            IconComponent={HeartIcon}
            onColor="#ef4444"
            offColor="#9ca3af"
            count={voteCount}
            size={16}
          />
          <Text className="text-xs text-gray-400">
            {new Date(comment.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {shouldTruncate ? (
        <View className="ml-3">
          <View className="relative flex-row items-center pt-2 pl-4">
            <View
              pointerEvents="none"
              className="absolute top-0 left-0 h-5 w-4 rounded-bl-xl border-b-2 border-l-2 border-gray-300 dark:border-gray-600"
            />
            <Link
              href={`/courses/${courseId}/${threadNumber}/${comment.id}`}
              asChild
            >
              <Pressable className="rounded-lg bg-gray-100 px-3 py-1.5 dark:bg-gray-800">
                <Text className="font-display-semibold text-sm text-blue-500 dark:text-blue-400">
                  Continue thread →
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      ) : (
        hasReplies && (
          <View className="ml-3">
            {comment.comments.map((reply, index) => {
              const isLast = index === comment.comments.length - 1;
              return (
                <View key={`reply-${reply.id}`} className="relative pt-2 pl-4">
                  {!isLast && (
                    <View
                      pointerEvents="none"
                      className="absolute top-0 bottom-0 left-0 w-0.5 bg-gray-300 dark:bg-gray-600"
                    />
                  )}
                  <View
                    pointerEvents="none"
                    className="absolute top-0 left-0 h-7 w-4 rounded-bl-xl border-b-2 border-l-2 border-gray-300 dark:border-gray-600"
                  />
                  {renderComment(
                    reply,
                    usersMap,
                    parsedXmlMap,
                    courseId,
                    threadNumber,
                    depth + 1,
                    commentVotes,
                    commentVoteCounts,
                    onVoteToggle,
                    maxThreadNumber,
                  )}
                </View>
              );
            })}
          </View>
        )
      )}
    </View>
  );
}
