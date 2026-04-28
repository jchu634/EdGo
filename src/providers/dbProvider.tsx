import React, { createContext, useContext, useMemo } from "react";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle, ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "@/src/db/schema";
import migrations from "@/drizzle/migrations";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";

type Db = ExpoSQLiteDatabase<typeof schema>;

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
    []
  );
  const db = useMemo(() => drizzle(expoDb, { schema }), [expoDb]);

  useDrizzleStudio(expoDb);
  useMigrations(db, migrations);

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
