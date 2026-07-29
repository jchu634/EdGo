import { useState } from "react";
import { Pressable, View } from "react-native";
import { cn } from "cnfast";

export default function SpoilerText({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isBlurred, setIsBlurred] = useState(true);

  return (
    <Pressable
      onPress={() => {
        setIsBlurred(!isBlurred);
      }}
    >
      <View className={cn("mb-2", isBlurred && "blur-sm")}>{children}</View>
    </Pressable>
  );
}
