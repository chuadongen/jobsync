"use client";

import Link from "next/link";
import { FileText, FolderOpen, Mail } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getDocStatusBadgeColor } from "@/lib/badge-colors";
import { docStatusLabel } from "@/models/resume.model";
import { documentCategoryLabel } from "@/models/document.model";
import type { JobResponse } from "@/models/job.model";
import { JobTabEmptyState } from "./JobTabEmptyState";

type JobApplicationTabProps = {
  job: JobResponse;
  onCopyPrompt: () => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 divide-y rounded-md border">{children}</ul>
    </div>
  );
}

// Everything that goes out with this application. Tailoring happens in
// Claude over MCP; this tab is where the results land for review.
export function JobApplicationTab({ job, onCopyPrompt }: JobApplicationTabProps) {
  const resumes = job.resumeDocs ?? [];
  const letters = job.coverLetters ?? [];
  const documents = job.documents ?? [];

  if (resumes.length + letters.length + documents.length === 0) {
    return (
      <JobTabEmptyState
        icon={FileText}
        title="Nothing prepared yet"
        description="Copy the Claude prompt, paste it into Claude, and the tailored draft will appear here for your approval."
        actionLabel="Copy Claude Prompt"
        onAction={onCopyPrompt}
      />
    );
  }

  return (
    <div className="space-y-6">
      {resumes.length > 0 && (
        <Section title="Resumes">
          {resumes.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/dashboard/resumes/${doc.id}`}
                className="flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {doc.name}
              </Link>
              <StatusBadge
                label={docStatusLabel(doc.status)}
                color={getDocStatusBadgeColor(doc.status)}
              />
            </li>
          ))}
        </Section>
      )}
      {letters.length > 0 && (
        <Section title="Cover Letters">
          {letters.map((letter) => (
            <li key={letter.id} className="flex items-center gap-3 px-3 py-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/dashboard/letters/${letter.id}`}
                className="flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {letter.title}
              </Link>
              <StatusBadge
                label={docStatusLabel(letter.status)}
                color={getDocStatusBadgeColor(letter.status)}
              />
            </li>
          ))}
        </Section>
      )}
      {documents.length > 0 && (
        <Section title="Documents">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`/api/documents/${doc.id}`}
                className="flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {doc.title}
              </a>
              <span className="text-xs text-muted-foreground">
                {documentCategoryLabel(doc.category)}
              </span>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}
