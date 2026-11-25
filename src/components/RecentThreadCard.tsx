import { ChatsIcon, EyeIcon, HeartIcon } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";
import { useUniwind } from "uniwind";

export interface RecentThreadCardProps {
  title: string;
  courseCode?: string;
  colour: string;
  replyCount: number;
  viewCount: number;
  voteCount: number;
  largerCards: boolean;
  onPress?: () => void;
}

export default function RecentThreadCard({
  title,
  courseCode,
  colour,
  replyCount,
  viewCount,
  voteCount,
  largerCards,
  onPress,
}: RecentThreadCardProps) {
  const { theme } = useUniwind();
  const iconColor = theme === "dark" ? "white" : "black";

  return (
    <Pressable
      className={
        largerCards
          ? "mx-1.5 mb-3 flex-row overflow-hidden rounded-l-sm rounded-r-2xl bg-slate-200 dark:bg-neutral-800"
          : "mx-1.5 mb-2 flex-row overflow-hidden rounded-l-sm rounded-r-2xl bg-slate-200 dark:bg-neutral-800"
      }
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="w-2.5 shrink-0" style={{ backgroundColor: colour }} />
      <View
        className={
          largerCards
            ? "min-w-0 flex-1 p-4 pl-3"
            : "min-w-0 flex-1 px-3 py-2 pl-2.5"
        }
      >
        <Text className="font-display-bold dark:text-white" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row items-center justify-between gap-x-2">
          <Text
            className="font-display min-w-0 flex-1 text-xs text-gray-600 dark:text-slate-300"
            numberOfLines={1}
          >
            {courseCode}
          </Text>
          <View className="shrink-0 flex-row">
            {replyCount !== 0 && (
              <View className="flex min-w-10 flex-row items-center">
                <Text className="font-display pl-2 dark:text-white">
                  {replyCount}
                </Text>
                <ChatsIcon size={14} color={iconColor} />
              </View>
            )}
            <View className="flex min-w-10 flex-row items-center">
              <Text className="font-display pl-2 dark:text-white">
                {viewCount}
              </Text>
              <EyeIcon size={14} color={iconColor} />
            </View>
            <View className="flex min-w-10 flex-row items-center">
              <Text className="font-display pl-2 dark:text-white">
                {voteCount}
              </Text>
              <HeartIcon size={14} color={iconColor} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
