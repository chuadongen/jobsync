import { StatusBadge } from "@/components/StatusBadge";
import { getDocStatusBadgeColor } from "@/lib/badge-colors";
import { docStatusLabel } from "@/models/resume.model";
import type { JobResponse } from "@/models/job.model";

// The furthest-along variant wins: a job is "Submitted" once any of its
// resumes went out, whatever drafts are still lying around.
const RANK: Record<string, number> = { draft: 0, approved: 1, submitted: 2 };

export function ResumeStatusCell({ job }: { job: JobResponse }) {
  const docs = job.resumeDocs ?? [];
  if (docs.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const best = docs.reduce((a, b) =>
    (RANK[b.status] ?? 0) > (RANK[a.status] ?? 0) ? b : a,
  );
  return (
    <StatusBadge
      label={docStatusLabel(best.status)}
      color={getDocStatusBadgeColor(best.status)}
      className="whitespace-nowrap"
    />
  );
}
