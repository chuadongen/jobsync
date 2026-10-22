import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportBank } from "@/lib/resume/portable";
import { contentDisposition } from "@/lib/files/responses";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const data = await exportBank(userId);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": contentDisposition(`experience-bank-${stamp}.json`),
      "Cache-Control": "private, no-store",
    },
  });
}
