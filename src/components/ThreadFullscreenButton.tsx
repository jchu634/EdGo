import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUniwind } from "uniwind";
import { useCourseLayout } from "@/src/providers/courseLayoutProvider";

export default function ThreadFullscreenButton() {
  const { isWide, isFullscreen, toggleFullscreen } = useCourseLayout();
  const { theme } = useUniwind();

  if (!isWide) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isFullscreen ? "Exit thread fullscreen" : "View thread fullscreen"
      }
      onPress={toggleFullscreen}
      className="ml-2 size-11 items-center justify-center rounded-lg"
    >
      <Ionicons
        name={isFullscreen ? "contract" : "expand"}
        size={24}
        color={theme === "dark" ? "#f1f5f9" : "#70069e"}
      />
    </Pressable>
  );
}
