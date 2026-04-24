import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { initDB } from "@/src/lib/courseStorage";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="edgo.db" onInit={initDB}>
      <Stack />
    </SQLiteProvider>
  );
}
