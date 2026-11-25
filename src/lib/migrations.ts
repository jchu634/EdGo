export interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

export interface MigrationBundle {
  journal?: {
    entries: JournalEntry[];
  };
  migrations: Record<string, string>;
}

export interface SqliteQueryClient {
  getAllAsync<T>(source: string): Promise<T[]>;
}

const TIMESTAMP_PREFIX_RE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;

function formatUtcTimestampPrefix(when: number): string {
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid migration timestamp: ${when}`);
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    String(date.getUTCFullYear()).padStart(4, "0") +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

function parseTimestampPrefixToMillis(key: string): number {
  const match = TIMESTAMP_PREFIX_RE.exec(key);
  if (!match) {
    throw new Error(
      `Migration key "${key}" is missing a YYYYMMDDHHMMSS timestamp prefix`,
    );
  }
  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

export function normalizeMigrations(
  bundle: MigrationBundle,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  const usedLegacyKeys = new Set<string>();
  const seenMillis = new Map<number, string>();

  const register = (name: string, sql: string) => {
    const millis = parseTimestampPrefixToMillis(name);
    const existing = seenMillis.get(millis);
    if (existing) {
      throw new Error(
        `Ambiguous migration timestamp (${millis}) shared by "${existing}" and "${name}"`,
      );
    }
    seenMillis.set(millis, name);
    normalized[name] = sql;
  };

  if (bundle.journal?.entries) {
    for (const entry of bundle.journal.entries) {
      const legacyKey = `m${String(entry.idx).padStart(4, "0")}`;
      const sql = bundle.migrations[legacyKey] ?? bundle.migrations[entry.tag];
      if (!sql) {
        throw new Error(
          `Missing SQL for journal migration "${entry.tag}" (${legacyKey})`,
        );
      }
      usedLegacyKeys.add(legacyKey);
      usedLegacyKeys.add(entry.tag);
      const prefixedName = TIMESTAMP_PREFIX_RE.test(entry.tag)
        ? entry.tag
        : `${formatUtcTimestampPrefix(entry.when)}_${entry.tag}`;
      register(prefixedName, sql);
    }
  }

  for (const [key, sql] of Object.entries(bundle.migrations)) {
    if (usedLegacyKeys.has(key)) continue;
    register(key, sql);
  }

  return normalized;
}

export async function validateLegacyMigrationHistory(
  client: SqliteQueryClient,
  normalizedMigrations: Record<string, string>,
  migrationsTable = "__drizzle_migrations",
): Promise<void> {
  const tableExists = await client.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${migrationsTable}'`,
  );
  if (tableExists.length === 0) {
    return;
  }

  const columns = await client.getAllAsync<{ name: string }>(
    `PRAGMA table_info("${migrationsTable}")`,
  );
  if (columns.some((col) => col.name === "name")) {
    return;
  }

  const byMillis = new Map<number, string>();
  for (const name of Object.keys(normalizedMigrations)) {
    const millis = parseTimestampPrefixToMillis(name);
    if (byMillis.has(millis)) {
      throw new Error(
        `Cannot upgrade legacy migrations table: multiple local migrations share timestamp ${millis}`,
      );
    }
    byMillis.set(millis, name);
  }

  const dbRows = await client.getAllAsync<{
    id: number;
    hash: string;
    created_at: number | string;
  }>(`SELECT id, hash, created_at FROM "${migrationsTable}" ORDER BY id ASC`);

  const matchedMigrations = new Set<string>();
  const unmatched: string[] = [];

  for (const row of dbRows) {
    const numericCreatedAt = Number(row.created_at);
    const millis = Number.isFinite(numericCreatedAt)
      ? Math.floor(numericCreatedAt / 1000) * 1000
      : Number.NaN;
    const matchedName = byMillis.get(millis);

    if (!matchedName) {
      unmatched.push(`[id: ${row.id}, created_at: ${row.created_at}]`);
      continue;
    }

    if (matchedMigrations.has(matchedName)) {
      throw new Error(
        `Cannot upgrade legacy migrations table: multiple rows map to migration "${matchedName}"`,
      );
    }

    matchedMigrations.add(matchedName);
  }

  if (unmatched.length > 0) {
    throw new Error(
      `Cannot upgrade legacy migrations table: ${unmatched.length} unmatched row(s) (${unmatched.join(", ")})`,
    );
  }
}
