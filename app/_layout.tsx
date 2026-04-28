import { ActivityIndicator, Platform } from "react-native";
import { Suspense } from "react";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { KeyProvider } from "@/src/providers/keyProvider";
import { DbProvider } from "@/src/providers/dbProvider";

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <KeyProvider>
        <DbProvider>
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: "#70069e",
              },
              headerTitle: "",
              headerRight: () => (
                <>
                  <Ionicons
                    name="search"
                    size={24}
                    color="white"
                    style={{ marginRight: 16 }}
                  />
                  <Ionicons name="person" size={24} color="white" />
                </>
              ),
              contentStyle: {
                paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
              },
            }}
          />
        </DbProvider>
      </KeyProvider>
    </Suspense>
  );
}
