import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocument } from "@/lib/files/documents";
import { readDataFile } from "@/lib/files/storage";
import { contentDisposition } from "@/lib/files/responses";

// PDFs and images open in the browser tab unless ?download=1; everything
// else always downloads.
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const document = await getDocument(userId, id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readDataFile(document.filePath);
  } catch {
    return NextResponse.json(
      { error: `The file is missing from the server at ${document.filePath}` },
      { status: 410 },
    );
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": contentDisposition(
        document.fileName,
        INLINE.has(document.mimeType) && !new URL(req.url).searchParams.has("download")
          ? "inline"
          : "attachment",
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
