import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResumeHeader } from "@/actions/bank.actions";
import { getCoverLetter, getJobPickerOptions } from "@/actions/resume.actions";
import { LetterEditor } from "@/components/resumes/LetterEditor";

export const metadata: Metadata = {
  title: "Cover Letter | JobSync",
};

export default async function CoverLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [letter, header, jobs] = await Promise.all([
    getCoverLetter(id),
    getResumeHeader(),
    getJobPickerOptions(),
  ]);
  if (!letter.success) notFound();
  return (
    <LetterEditor
      key={`${letter.data.id}-${new Date(letter.data.updatedAt).getTime()}`}
      letter={letter.data}
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
