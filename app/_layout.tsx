import { Platform } from "react-native";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { initDB } from "@/src/lib/courseStorage";

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <SQLiteProvider databaseName="edgo.db" onInit={initDB}>
      <Stack
        screenOptions={{
          contentStyle: {
            paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
          },
        }}
      />
    </SQLiteProvider>
  );
}
