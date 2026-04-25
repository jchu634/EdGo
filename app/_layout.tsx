import { Platform } from "react-native";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { initDB } from "@/src/lib/courseStorage";
import { KeyProvider } from "@/src/providers/keyProvider";

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <KeyProvider>
      <SQLiteProvider databaseName="edgo.db" onInit={initDB}>
        <Stack
          screenOptions={{
            contentStyle: {
              paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
            },
          }}
        />
      </SQLiteProvider>
    </KeyProvider>
  );
}
