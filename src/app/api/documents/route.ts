import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDocument } from "@/lib/files/documents";
import { APP_CONSTANTS } from "@/lib/constants";

// Multipart upload: file, title, category, and optional notes and jobId.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Refuse an oversized body before buffering it.
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > APP_CONSTANTS.MAX_DOCUMENT_SIZE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "The file is too large" }, { status: 413 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was attached" }, { status: 400 });
    }
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === "string" && value.trim() ? value.trim() : null;
    };
    const document = await createDocument(userId, {
      title: text("title") ?? file.name,
      category: (text("category") ?? "other") as any,
      notes: text("notes"),
      jobId: text("jobId"),
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ success: true, data: document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
