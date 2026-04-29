import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

interface LinkTextProps {
  href: string;
  children: React.ReactNode;
}

export default function LinkText({ href, children }: LinkTextProps) {
  const { width, height } = useWindowDimensions();
  const [menuVisible, setMenuVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const openExternalUrl = useCallback(async (url: string) => {
    const trimmed = url.trim().toLowerCase();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))
      return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error("Failed to open URL:", err);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(href);
    setCopied(true);
    setTimeout(() => {
      setMenuVisible(false);
      setCopied(false);
    }, 800);
  }, [href]);

  const handleOpen = useCallback(() => {
    setMenuVisible(false);
    openExternalUrl(href);
  }, [href, openExternalUrl]);

  return (
    <>
      <Text
        className="text-blue-700 underline"
        onPress={() => openExternalUrl(href)}
        onLongPress={() => setMenuVisible(true)}
      >
        {children}
      </Text>
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          onPress={() => setMenuVisible(false)}
          style={{
            width,
            height,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Pressable
            style={{
              width: "80%",
              borderRadius: 12,
              backgroundColor: "white",
              padding: 16,
              alignSelf: "center",
            }}
          >
            <Text
              className="font-display mb-3 text-sm text-wrap text-gray-700"
              numberOfLines={2}
              ellipsizeMode="middle"
            >
              {href}
            </Text>

            {copied ? (
              <Text className="font-display text-center text-sm text-green-600">
                Copied!
              </Text>
            ) : (
              <View style={{ gap: 12 }}>
                <Pressable
                  onPress={handleCopy}
                  className="items-center rounded-lg bg-gray-300 py-3 active:bg-gray-200"
                  style={{
                    width: 200,
                    alignSelf: "center",
                  }}
                >
                  <Text className="font-display text-md text-center text-gray-800">
                    Copy Link
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleOpen}
                  className="items-center rounded-lg bg-gray-300 py-3 active:bg-gray-200"
                  style={{
                    width: 200,
                    alignSelf: "center",
                  }}
                >
                  <Text className="font-display text-md text-center text-gray-800">
                    Open Link
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
