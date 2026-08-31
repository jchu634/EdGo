import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ViewedImage {
  uri: string;
  aspectRatio: number;
}

interface ImageViewerProps {
  image: ViewedImage;
  onClose: () => void;
}

const MIN_SCALE = 1;
const DOUBLE_TAP_SCALE = 2.5;
const MAX_SCALE = 4;

function clamp(value: number, minimum: number, maximum: number) {
  "worklet";
  return Math.min(Math.max(value, minimum), maximum);
}

export default function ImageViewer({ image, onClose }: ImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const viewportAspectRatio = width / height;
  const fittedWidth =
    image.aspectRatio > viewportAspectRatio
      ? width
      : height * image.aspectRatio;
  const fittedHeight =
    image.aspectRatio > viewportAspectRatio
      ? width / image.aspectRatio
      : height;

  const clampTranslation = (nextScale: number, x: number, y: number) => {
    "worklet";
    const maxX = Math.max(0, (fittedWidth * nextScale - width) / 2);
    const maxY = Math.max(0, (fittedHeight * nextScale - height) / 2);
    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.set(clamp(savedScale.get() * event.scale, MIN_SCALE, MAX_SCALE));
    })
    .onEnd(() => {
      const nextScale = clamp(scale.get(), MIN_SCALE, MAX_SCALE);
      const nextTranslation = clampTranslation(
        nextScale,
        translateX.get(),
        translateY.get(),
      );
      scale.set(withTiming(nextScale));
      savedScale.set(nextScale);
      translateX.set(withTiming(nextTranslation.x));
      translateY.set(withTiming(nextTranslation.y));
      savedTranslateX.set(nextTranslation.x);
      savedTranslateY.set(nextTranslation.y);
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onUpdate((event) => {
      if (scale.get() <= MIN_SCALE) return;
      const nextTranslation = clampTranslation(
        scale.get(),
        savedTranslateX.get() + event.translationX,
        savedTranslateY.get() + event.translationY,
      );
      translateX.set(nextTranslation.x);
      translateY.set(nextTranslation.y);
    })
    .onEnd(() => {
      savedTranslateX.set(translateX.get());
      savedTranslateY.set(translateY.get());
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (!success) return;
      const nextScale = scale.get() > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE;
      scale.set(withTiming(nextScale));
      savedScale.set(nextScale);
      translateX.set(withTiming(0));
      translateY.set(withTiming(0));
      savedTranslateX.set(0);
      savedTranslateY.set(0);
    });

  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "black" }}>
        <GestureDetector gesture={gestures}>
          <View className="flex-1 items-center justify-center overflow-hidden">
            <Animated.Image
              source={{ uri: image.uri }}
              resizeMode="contain"
              accessibilityLabel="Expanded discussion image"
              onLoad={() => setLoadState("loaded")}
              onError={() => setLoadState("error")}
              style={[
                { width: fittedWidth, height: fittedHeight },
                imageStyle,
                loadState !== "loaded" && { opacity: 0 },
              ]}
            />

            {loadState === "loading" && (
              <ActivityIndicator
                className="absolute"
                size="large"
                color="white"
              />
            )}

            {loadState === "error" && (
              <Text className="font-display absolute px-8 text-center text-white">
                Unable to load this image.
              </Text>
            )}
          </View>
        </GestureDetector>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
          hitSlop={12}
          onPress={onClose}
          className="absolute size-11 items-center justify-center rounded-full bg-black/60"
          style={{ top: insets.top + 12, right: insets.right + 12 }}
        >
          <Ionicons name="close" size={30} color="white" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
