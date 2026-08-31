import { Image, Pressable } from "react-native";

import { useImageViewer } from "@/src/providers/modalProvider";

interface ContentImageProps {
  uri: string;
  aspectRatio: number;
}

export default function ContentImage({ uri, aspectRatio }: ContentImageProps) {
  const { openImage } = useImageViewer();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open image viewer"
      onPress={() => openImage({ uri, aspectRatio })}
      className="my-2 w-full"
    >
      <Image
        source={{ uri }}
        style={{ aspectRatio }}
        className="w-full rounded-lg"
        resizeMethod="auto"
        resizeMode="contain"
      />
    </Pressable>
  );
}
