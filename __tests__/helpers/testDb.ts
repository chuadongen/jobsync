import fs from "fs";
import os from "os";
import path from "path";

// A real SQLite database for logic whose correctness lives in the queries:
// ownership, provenance and lifecycle rules are easy to fake past with mocks.
// Call before importing anything that touches @/lib/db, so the client binds
// to the temp file.
export function useTempDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-test-"));
  const file = path.join(dir, "test.db");
  process.env.DATABASE_URL = `file:${file}`;
  process.env.DATA_DIR = path.join(dir, "data");
  return { dir, file };
}

export async function migrate(prisma: { $executeRawUnsafe: (sql: string) => Promise<unknown> }) {
  const migrations = path.resolve(__dirname, "../../prisma/migrations");
  for (const name of fs.readdirSync(migrations).sort()) {
    const sqlFile = path.join(migrations, name, "migration.sql");
    if (!fs.existsSync(sqlFile)) continue;
    const sql = fs.readFileSync(sqlFile, "utf8").replace(/^--.*$/gm, "");
    for (const statement of sql.split(/;\s*\n/)) {
      if (statement.trim()) await prisma.$executeRawUnsafe(statement);
    }
  }
}
