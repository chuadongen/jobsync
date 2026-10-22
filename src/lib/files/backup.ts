import fs from "fs/promises";
import os from "os";
import path from "path";
import JSZip from "jszip";
import prisma from "@/lib/db";
import { dataDir } from "./storage";

// One zip holding everything: a consistent copy of the database and every
// file under vault/ and applications/. To restore, stop the app, put the
// database back at DATABASE_URL and unzip the folders into the data dir.

const FOLDERS = ["vault", "applications"];

async function addFolder(zip: JSZip, root: string, relative: string) {
  const full = path.join(root, relative);
  let entries;
  try {
    entries = await fs.readdir(full, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) await addFolder(zip, root, child);
    else if (entry.isFile()) {
      zip.file(child.split(path.sep).join("/"), await fs.readFile(path.join(root, child)));
    }
  }
}

export async function buildBackupZip(): Promise<Uint8Array> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "jobsync-backup-"));
  const snapshot = path.join(tmp, "jobsync.db");
  try {
    // VACUUM INTO copies a consistent database even while the app writes,
    // which copying the file directly does not guarantee.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    const zip = new JSZip();
    zip.file("jobsync.db", await fs.readFile(snapshot));
    const root = dataDir();
    for (const folder of FOLDERS) await addFolder(zip, root, folder);
    zip.file(
      "README.txt",
      [
        "JobSync backup",
        `Created ${new Date().toISOString()}`,
        "",
        "jobsync.db     the database; restore it to the path in DATABASE_URL",
        "vault/         documents not tied to an application",
        "applications/  per-application folders with submitted PDFs and uploads",
        "",
        "Stop the app before restoring, then copy the folders back into the data directory.",
        "",
      ].join("\n"),
    );
    return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
