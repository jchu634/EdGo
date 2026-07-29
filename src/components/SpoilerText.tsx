import { useState } from "react";
import { Pressable, View } from "react-native";
import cn from "cnfast";

export default function SpoilerText({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <Pressable
      onPress={() => {
        setIsPressed(!isPressed);
      }}
    >
      <View className={cn("mb-2", isPressed && "blur-sm")}>{children}</View>
    </Pressable>
  );
}
