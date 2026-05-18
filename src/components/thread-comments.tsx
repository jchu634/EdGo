import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Link } from "expo-router";
import { Schema } from "effect";
import { XmlNode, renderXmlNode, isXmlNode } from "@/src/lib/renderXML";
import { settings } from "@/src/lib/storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { HeartIcon, CheckCircleIcon } from "phosphor-react-native";
import { EdComment as CommentSchema } from "@/src/lib/schema";
import { getCachedParsedXml } from "@/src/lib/storage";

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
    scale.value = withSequence(withSpring(1.35), withSpring(1));
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
): React.ReactNode {
  const author = usersMap.get(comment.user_id);
  const xmlKey = `comment-${comment.id}`;
  const parsedXml = parsedXmlMap.get(xmlKey);
  const isVoted = commentVotes.get(comment.id) ?? false;
  const voteCount = commentVoteCounts.get(comment.id) ?? comment.vote_count;

  return (
    <View
      key={`comment-${comment.id}`}
      className={`mb-3 rounded-xl bg-gray-100 p-3 ${depth > 0 ? "ml-4 border-2 border-l border-gray-300" : ""}`}
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
        <Text className="font-display-semibold text-sm">
          {author?.name ?? "Anonymous"}
        </Text>
        {comment.type === "answer" && (
          <View className="rounded-lg bg-blue-100 px-4 py-0.5">
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

      {comment.comments.length > 0 && depth >= MAX_DEPTH ? (
        <Link
          href={`/courses/${courseId}/${threadNumber}/${comment.comments[0].id}`}
          asChild
        >
          <Pressable className="mt-2">
            <View className="ml-4 items-start">
              <Text className="font-display-semibold text-sm text-blue-600">
                Continue thread →
              </Text>
            </View>
          </Pressable>
        </Link>
      ) : (
        comment.comments.length > 0 &&
        comment.comments.map((reply) =>
          renderComment(
            reply,
            usersMap,
            parsedXmlMap,
            courseId,
            threadNumber,
            depth + 1,
            commentVotes,
            commentVoteCounts,
            onVoteToggle,
          ),
        )
      )}
    </View>
  );
}

export async function parseCommentsXml(
  comments: readonly CommentType[],
  parseAndCacheXml: (xml: string, key: string) => Promise<XmlNode | null>,
  xmlMap: Map<string, XmlNode>,
) {
  for (const c of comments) {
    if (c.content) {
      const parsed = await parseAndCacheXml(c.content, `comment-${c.id}`);
      if (parsed) {
        xmlMap.set(`comment-${c.id}`, parsed);
      }
    }
    if (c.comments.length > 0) {
      await parseCommentsXml(c.comments, parseAndCacheXml, xmlMap);
    }
  }
}

export function loadCachedCommentXml(
  comments: readonly CommentType[],
  courseId: number,
  threadNumber: number,
  xmlMap: Map<string, XmlNode>,
) {
  for (const c of comments) {
    const cCached = getCachedParsedXml(
      courseId,
      threadNumber,
      `comment-${c.id}`,
    );
    if (cCached && isXmlNode(cCached)) {
      xmlMap.set(`comment-${c.id}`, cCached as XmlNode);
    }
    if (c.comments.length > 0) {
      loadCachedCommentXml(c.comments, courseId, threadNumber, xmlMap);
    }
  }
}
