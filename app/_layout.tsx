import { ActivityIndicator, Platform, Pressable } from "react-native";
import { Suspense } from "react";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { KeyProvider } from "@/src/providers/keyProvider";
import { DbProvider } from "@/src/providers/dbProvider";
import { LinkTextProvider } from "@/src/components/LinkText";
import { useRouter } from "expo-router";

export default function RootLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <KeyProvider>
        <DbProvider>
          <LinkTextProvider>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: "#70069e",
                },
                headerTintColor: "white",
                headerTitle: "",
                headerRight: () => (
                  <>
                    <Ionicons
                      name="search"
                      size={24}
                      color="white"
                      style={{ marginRight: 16 }}
                    />
                    <Pressable onPress={() => router.navigate("/settings")}>
                      <Ionicons name="person" size={24} color="white" />
                    </Pressable>
                  </>
                ),
                contentStyle: {
                  paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
                },
              }}
            />
          </LinkTextProvider>
        </DbProvider>
      </KeyProvider>
    </Suspense>
  );
}
