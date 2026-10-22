"use client";
import { StatusBadge } from "../StatusBadge";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import { JobResponse } from "@/models/job.model";

type JobStatusBadgeProps = {
  job: JobResponse;
  className?: string;
};

// Past-due drafts override the stored status. Shared by the table and card
// views so the two can't disagree about the same job.
export function JobStatusBadge({ job, className }: JobStatusBadgeProps) {
  if (job.dueDate && new Date() > job.dueDate && job.Status?.value === "draft") {
    return <StatusBadge label="Expired" color="amber" className={className} />;
  }

  return (
    <StatusBadge
      label={job.Status?.label ?? ""}
      color={getJobStatusBadgeColor(job.Status?.value ?? "")}
      className={className}
    />
  );
}
