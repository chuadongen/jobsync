import { Metadata } from "next";
import { getDocuments } from "@/actions/document.actions";
import { getJobPickerOptions } from "@/actions/resume.actions";
import { DocumentsContainer } from "@/components/documents/DocumentsContainer";
import type { VaultDocument } from "@/models/document.model";

export const metadata: Metadata = {
  title: "Documents | JobSync",
};

export default async function DocumentsPage() {
  const [documents, jobs] = await Promise.all([getDocuments(), getJobPickerOptions()]);
  return (
    <DocumentsContainer
      documents={(documents.success ? documents.data : []) as VaultDocument[]}
      jobs={jobs.success ? jobs.data : []}
    />
  );
}
