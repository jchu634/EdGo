import { ActivityIndicator, Platform } from "react-native";
import { Suspense } from "react";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SQLiteProvider, openDatabaseSync } from "expo-sqlite";

import { drizzle } from "drizzle-orm/expo-sqlite";
import migrations from "@/drizzle/migrations";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";

import { KeyProvider } from "@/src/providers/keyProvider";
import { DbProvider } from "@/src/providers/dbProvider";

export default function RootLayout() {
  const expoDb = openDatabaseSync("edgo.db", { enableChangeListener: true });
  const db = drizzle(expoDb);

  useDrizzleStudio(expoDb);
  const { success, error } = useMigrations(db, migrations);
  const insets = useSafeAreaInsets();

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <KeyProvider>
        <SQLiteProvider
          databaseName="edgo.db"
          options={{ enableChangeListener: true }}
          useSuspense
        >
          <DbProvider>
            <Stack
              screenOptions={{
                contentStyle: {
                  paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
                },
              }}
            />
          </DbProvider>
        </SQLiteProvider>
      </KeyProvider>
    </Suspense>
  );
}
