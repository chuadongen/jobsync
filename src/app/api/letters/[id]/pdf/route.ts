import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLetter } from "@/lib/resume/letters";
import { getResumeHeader } from "@/lib/resume/bank";
import { renderCoverLetterPdf } from "@/lib/resume/pdf";
import { readDataFile } from "@/lib/files/storage";
import { isExportable } from "@/models/resume.model";
import { pdfResponse } from "@/lib/files/responses";
import { outgoingName } from "@/lib/resume/naming";

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
  const letter = await getLetter(userId, id);
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isExportable(letter.status)) {
    return NextResponse.json(
      { error: "Approve this cover letter before exporting it." },
      { status: 403 },
    );
  }

  const header = await getResumeHeader(userId);
  const title = outgoingName(header?.fullName, "Cover Letter");
  if (letter.status === "submitted" && letter.pdfPath) {
    try {
      return pdfResponse(await readDataFile(letter.pdfPath), title);
    } catch {
      // Moved or removed by hand: fall through and re-render.
    }
  }
  if (!header) {
    return NextResponse.json(
      { error: "Add your contact details in the Experience Bank first." },
      { status: 400 },
    );
  }
  return pdfResponse(
    await renderCoverLetterPdf(header, letter.content, title),
    title,
  );
}
