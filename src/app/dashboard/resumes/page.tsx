import { Metadata } from "next";
import {
  getCoverLetters,
  getJobPickerOptions,
  getResumeDocs,
} from "@/actions/resume.actions";
import {
  ResumesContainer,
  type LetterRow,
  type ResumeRow,
} from "@/components/resumes/ResumesContainer";

export const metadata: Metadata = {
  title: "Resumes | JobSync",
};

export default async function ResumesPage() {
  const [resumes, letters, jobs] = await Promise.all([
    getResumeDocs(),
    getCoverLetters(),
    getJobPickerOptions(),
  ]);
  return (
    <ResumesContainer
      resumes={(resumes.success ? resumes.data : []) as ResumeRow[]}
      letters={(letters.success ? letters.data : []) as LetterRow[]}
      jobs={jobs.success ? jobs.data : []}
    />
  );
}
