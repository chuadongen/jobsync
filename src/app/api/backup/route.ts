import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildBackupZip } from "@/lib/files/backup";
import { contentDisposition } from "@/lib/files/responses";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
