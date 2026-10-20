import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBankEntries, getResumeHeader } from "@/actions/bank.actions";
import { getJobPickerOptions, getResumeDoc } from "@/actions/resume.actions";
import { ResumeEditor } from "@/components/resumes/ResumeEditor";
import type { BankEntry } from "@/models/bank.model";

export const metadata: Metadata = {
  title: "Resume | JobSync",
};

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc, entries, header, jobs] = await Promise.all([
    getResumeDoc(id),
    // Archived entries included: one already on this resume must still edit.
    getBankEntries(true),
    getResumeHeader(),
    getJobPickerOptions(),
  ]);
  if (!doc.success) notFound();
  return (
    <ResumeEditor
      // Remount after a save so the working copy restarts from the server.
      key={`${doc.data.id}-${new Date(doc.data.updatedAt).getTime()}`}
      doc={doc.data}
      entries={(entries.success ? entries.data : []) as BankEntry[]}
      header={
        (header.success && header.data) || {
          fullName: "",
          location: null,
          email: null,
          phone: null,
          links: [],
        }
      }
      jobs={jobs.success ? jobs.data : []}
    />
  );
}
