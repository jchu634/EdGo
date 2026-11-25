import {
  drizzle,
  type ExpoSQLiteAsyncDatabase,
} from "drizzle-orm/expo-sqlite/async";
import { useMigrations } from "drizzle-orm/expo-sqlite/async/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { openDatabaseSync } from "expo-sqlite";
import type React from "react";
import { createContext, useContext, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import migrations from "@/drizzle/migrations";

type Db = ExpoSQLiteAsyncDatabase;

export type { Db };

const DbContext = createContext<Db | null>(null);

export function useDb() {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb must be used within DbProvider");
  return db;
}

export function DbProvider({ children }: { children: React.ReactNode }) {
  const expoDb = useMemo(
    () => openDatabaseSync("edgo.db", { enableChangeListener: true }),
    [],
  );
  const db = useMemo(() => drizzle(expoDb), [expoDb]);

  useDrizzleStudio(expoDb);
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    throw error;
  }

  if (!success) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
