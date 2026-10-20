import fs from "fs/promises";
import path from "path";
import { APP_CONSTANTS } from "@/lib/constants";

// Everything the app writes lives under one data directory, in a layout that
// reads sensibly from a terminal or a file manager on the server:
//
//   data/
//     vault/<category>/<file>                         standalone documents
//     applications/<year>/<Company - Title>/<file>    per-application files
//
// Database rows store paths relative to the data directory, so the whole
// directory can be moved or restored without rewriting anything.

export function dataDir(): string {
  return path.resolve(APP_CONSTANTS.DATA_DIR);
}

// Strips anything that could escape a directory or upset a filesystem:
// separators, control characters, reserved punctuation and leading dots.
export function safeSegment(input: string, fallback = "untitled"): string {
  const cleaned = input
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    // ".." and "." left behind by a stripped path are not names
    .replace(/(^|\s)\.+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

export function safeFileName(name: string, fallback = "file"): string {
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const stem = safeSegment(path.basename(name, path.extname(name)), fallback);
  return `${stem}${ext}`;
}

export function applicationFolder(job: {
  appliedDate?: Date | null;
  createdAt: Date;
  Company: { label: string };
  JobTitle: { label: string };
}): string {
  const year = (job.appliedDate ?? job.createdAt).getFullYear();
  const name = safeSegment(`${job.Company.label} - ${job.JobTitle.label}`);
  return path.join("applications", String(year), name);
}

export function vaultFolder(category: string): string {
  return path.join("vault", safeSegment(category, "other"));
}

// Resolves a stored relative path, refusing anything outside the data dir.
export function resolveDataPath(relative: string): string {
  const root = dataDir();
  const full = path.resolve(root, relative);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Path escapes the data directory");
  }
  return full;
}

// Writes without overwriting: a clash gets " (2)", " (3)" and so on, so a
// second resume for the same application never replaces the first.
export async function writeUniqueFile(
  folder: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<string> {
  const dir = resolveDataPath(folder);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? `${stem}${ext}` : `${stem} (${n})${ext}`;
    const relative = path.join(folder, candidate);
    try {
      await fs.writeFile(resolveDataPath(relative), bytes, { flag: "wx" });
      return relative;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("Too many files with the same name");
}

export async function readDataFile(relative: string): Promise<Buffer> {
  return fs.readFile(resolveDataPath(relative));
}

// Never throws: callers run it after a database change that must stand.
export async function removeDataFile(relative: string | null | undefined) {
  if (!relative) return;
  try {
    await fs.unlink(resolveDataPath(relative));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not remove file", relative, error);
    }
  }
}
