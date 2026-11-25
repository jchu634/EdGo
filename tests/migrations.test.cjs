const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const ts = require("typescript");

function loadMigrationsHelper() {
  const filePath = path.resolve(__dirname, "../src/lib/migrations.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;

  const mod = { exports: {} };
  const fn = new Function("exports", "require", "module", transpiled);
  fn(mod.exports, require, mod);
  return mod.exports;
}

function loadRealBundle() {
  const drizzleDir = path.resolve(__dirname, "../drizzle");
  const journal = JSON.parse(
    fs.readFileSync(path.join(drizzleDir, "meta/_journal.json"), "utf8"),
  );
  const migrations = {};
  for (const entry of journal.entries) {
    const key = `m${String(entry.idx).padStart(4, "0")}`;
    migrations[key] = fs.readFileSync(
      path.join(drizzleDir, `${entry.tag}.sql`),
      "utf8",
    );
  }
  return { journal, migrations };
}

function createSqliteClient(sqliteDb) {
  return {
    async getAllAsync(sqlText, params = []) {
      return sqliteDb.prepare(sqlText).all(...params);
    },
  };
}

async function runDrizzleMigrate(sqliteDb, normalizedMigrations) {
  const drizzleRoot = path.resolve(__dirname, "../node_modules/drizzle-orm");
  const { readMigrationsFromRecord } = await import(
    pathToFileURL(path.join(drizzleRoot, "migrator.utils.js")).href
  );
  const { migrate } = await import(
    pathToFileURL(path.join(drizzleRoot, "up-migrations/sqlite-program.js"))
      .href
  );
  const { runAsyncProgram } = await import(
    pathToFileURL(path.join(drizzleRoot, "runtime/async.js")).href
  );
  const { SQLiteDialect } = await import(
    pathToFileURL(path.join(drizzleRoot, "sqlite-core/dialect.js")).href
  );

  const dialect = new SQLiteDialect();
  const runner = {
    async execute(query) {
      const built = dialect.sqlToQuery(query);
      sqliteDb.prepare(built.sql).run(...built.params);
    },
    async objects(query) {
      const built = dialect.sqlToQuery(query);
      return sqliteDb.prepare(built.sql).all(...built.params);
    },
    async atomically(queries) {
      sqliteDb.exec("BEGIN");
      try {
        for (const query of queries) {
          const built = dialect.sqlToQuery(query);
          sqliteDb.prepare(built.sql).run(...built.params);
        }
        sqliteDb.exec("COMMIT");
      } catch (err) {
        sqliteDb.exec("ROLLBACK");
        throw err;
      }
    },
  };

  const parsed = readMigrationsFromRecord(normalizedMigrations);
  await runAsyncProgram(() => migrate(parsed, runner));
}

test("applies all migrations cleanly on an empty database", async () => {
  const { normalizeMigrations, validateLegacyMigrationHistory } =
    loadMigrationsHelper();

  const sqliteDb = new DatabaseSync(":memory:");
  const client = createSqliteClient(sqliteDb);
  const bundle = loadRealBundle();
  const normalized = normalizeMigrations(bundle);

  await validateLegacyMigrationHistory(client, normalized);
  await runDrizzleMigrate(sqliteDb, normalized);

  const rows = sqliteDb
    .prepare("SELECT id, name FROM __drizzle_migrations ORDER BY id ASC")
    .all();
  assert.equal(rows.length, bundle.journal.entries.length);
  assert.deepEqual(
    rows.map((r) => r.name),
    Object.keys(normalized).sort(),
  );
});

test("upgrades a legacy database 1-to-1 without replaying applied migrations", async () => {
  const { normalizeMigrations, validateLegacyMigrationHistory } =
    loadMigrationsHelper();

  const sqliteDb = new DatabaseSync(":memory:");
  const client = createSqliteClient(sqliteDb);
  const bundle = loadRealBundle();
  const normalized = normalizeMigrations(bundle);

  sqliteDb.exec(`
    CREATE TABLE __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
  `);

  const insertLegacy = sqliteDb.prepare(
    "INSERT INTO __drizzle_migrations (id, hash, created_at) VALUES (?, '', ?)",
  );
  for (const entry of bundle.journal.entries) {
    const key = `m${String(entry.idx).padStart(4, "0")}`;
    const statements = bundle.migrations[key].split("--> statement-breakpoint");
    for (const stmt of statements) {
      if (stmt.trim()) {
        sqliteDb.exec(stmt);
      }
    }
    insertLegacy.run(entry.idx + 1, entry.when);
  }

  await validateLegacyMigrationHistory(client, normalized);
  await runDrizzleMigrate(sqliteDb, normalized);

  const rows = sqliteDb
    .prepare("SELECT id, name FROM __drizzle_migrations ORDER BY id ASC")
    .all();
  assert.equal(rows.length, bundle.journal.entries.length);
  assert.deepEqual(
    rows.map((r) => r.name),
    Object.keys(normalized).sort(),
  );
});

test("refuses legacy upgrade before running SQL when a row is unmatched", async () => {
  const { normalizeMigrations, validateLegacyMigrationHistory } =
    loadMigrationsHelper();

  const sqliteDb = new DatabaseSync(":memory:");
  const client = createSqliteClient(sqliteDb);
  const bundle = loadRealBundle();
  const normalized = normalizeMigrations(bundle);

  sqliteDb.exec(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
    INSERT INTO __drizzle_migrations (id, hash, created_at) VALUES (1, '', 9999999999999);
  `);

  await assert.rejects(
    () => validateLegacyMigrationHistory(client, normalized),
    /unmatched row/i,
  );

  const columns = sqliteDb
    .prepare("PRAGMA table_info(__drizzle_migrations)")
    .all();
  assert.equal(
    columns.some((c) => c.name === "name"),
    false,
  );
});
