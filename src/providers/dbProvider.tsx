import React, { createContext, useContext, useMemo } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { drizzle, ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "@/src/db/schema";

type Db = ExpoSQLiteDatabase<typeof schema> & {
  $client: ReturnType<typeof useSQLiteContext>;
};

export type { Db };

const DbContext = createContext<Db | null>(null);

export function useDb() {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb must be used within DbProvider");
  return db;
}

export function DbProvider({ children }: { children: React.ReactNode }) {
  const expoDb = useSQLiteContext();
  const db = useMemo(() => drizzle(expoDb, { schema }), [expoDb]);

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
