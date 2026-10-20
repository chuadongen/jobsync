import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocDetail } from "@/lib/resume/docs";
import { renderResumePdf } from "@/lib/resume/pdf";
import { readDataFile } from "@/lib/files/storage";
import { isExportable } from "@/models/resume.model";
import { pdfResponse } from "@/lib/files/responses";

// No PDF exists for a draft: approval is the gate between Claude's wording
// and a file that could be sent. A submitted resume serves the exact file
// that was written on submit.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const doc = await getDocDetail(userId, id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isExportable(doc.status)) {
    return NextResponse.json(
      { error: "Approve this resume before exporting it." },
      { status: 403 },
    );
  }

  if (doc.status === "submitted" && doc.pdfPath) {
    try {
      return pdfResponse(await readDataFile(doc.pdfPath), doc.name);
    } catch {
      // The file was moved or removed by hand: re-render the frozen snapshot.
    }
  }
  return pdfResponse(await renderResumePdf(doc.rendered, doc.name), doc.name);
}
