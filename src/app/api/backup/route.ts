import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildBackupZip } from "@/lib/files/backup";
import { contentDisposition } from "@/lib/files/responses";

// A scheduled job on the host has no session, so BACKUP_TOKEN (when set) also
// unlocks this route as a bearer token. Compared in constant time.
function hasBackupToken(req: Request) {
  const expected = process.env.BACKUP_TOKEN ?? "";
  if (expected.length < 24) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!hasBackupToken(req)) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  }
  const zip = await buildBackupZip();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(`jobsync-backup-${stamp}.zip`),
      "Cache-Control": "private, no-store",
    },
  });
}
