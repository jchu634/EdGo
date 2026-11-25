import {
  drizzle,
  type ExpoSQLiteAsyncDatabase,
} from "drizzle-orm/expo-sqlite/async";
import { migrate } from "drizzle-orm/expo-sqlite/async/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { openDatabaseSync } from "expo-sqlite";
import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import migrations from "@/drizzle/migrations";
import {
  normalizeMigrations,
  validateLegacyMigrationHistory,
} from "@/src/lib/migrations";

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
  const [migrationState, setMigrationState] = useState<{
    success: boolean;
    error?: Error;
  }>({ success: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const normalized = normalizeMigrations(migrations);
        await validateLegacyMigrationHistory(expoDb, normalized);
        await migrate(db, { migrations: normalized });
        if (!cancelled) {
          setMigrationState({ success: true });
        }
      } catch (err) {
        if (!cancelled) {
          setMigrationState({
            success: false,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, expoDb]);

  if (migrationState.error) {
    throw migrationState.error;
  }

  if (!migrationState.success) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
