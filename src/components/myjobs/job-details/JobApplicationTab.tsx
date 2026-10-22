"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCopy, FilePlus2, FileText, FolderOpen, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateLetterDialog, CreateVariantDialog } from "@/components/resumes/CreateResumeDialogs";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { getResumeDocs } from "@/actions/resume.actions";
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
  const router = useRouter();
  const resumes = job.resumeDocs ?? [];
  const letters = job.coverLetters ?? [];
  const documents = job.documents ?? [];
  const [open, setOpen] = useState<"variant" | "letter" | "upload" | null>(null);
  const [bases, setBases] = useState<{ id: string; name: string; targetRole: string | null }[]>([]);
  // The pickers only need this job; it is preselected and the only choice.
  const jobs = [
    {
      id: job.id,
      label: `${job.Company?.label ?? "Company"} · ${job.JobTitle?.label ?? "Role"}`,
      status: job.Status?.label ?? "",
    },
  ];

  const openVariant = async () => {
    const result = await getResumeDocs({ kind: "base" });
    setBases(result.success ? (result.data as typeof bases) : []);
    setOpen("variant");
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={onCopyPrompt}>
        <ClipboardCopy className="mr-1.5 h-4 w-4" /> Copy Claude Prompt
      </Button>
      <Button size="sm" variant="outline" onClick={openVariant}>
        <FilePlus2 className="mr-1.5 h-4 w-4" /> Resume from a base
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen("letter")}>
        <Mail className="mr-1.5 h-4 w-4" /> Write a letter
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen("upload")}>
        <Upload className="mr-1.5 h-4 w-4" /> Upload document
      </Button>
    </div>
  );

  const dialogs = (
    <>
      {open === "variant" && (
        <CreateVariantDialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          bases={bases}
          jobs={jobs}
          defaultJobId={job.id}
        />
      )}
      {open === "letter" && (
        <CreateLetterDialog open onOpenChange={(o) => !o && setOpen(null)} jobs={jobs} defaultJobId={job.id} />
      )}
      <DocumentDialog
        open={open === "upload"}
        onOpenChange={(o) => !o && setOpen(null)}
        document={null}
        jobs={jobs}
        defaultJobId={job.id}
        onSaved={() => router.refresh()}
      />
    </>
  );

  if (resumes.length + letters.length + documents.length === 0) {
    return (
      <div className="space-y-4">
        <JobTabEmptyState
          icon={FileText}
          title="Nothing prepared yet"
          description="Copy the Claude prompt and paste it into Claude: the tailored draft lands here for your approval. Or start a resume from one of your bases yourself."
        />
        <div className="flex justify-center">{actions}</div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actions}
      {dialogs}
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
