"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateResumeMeta } from "@/actions/resume.actions";
import { toastActionResult } from "@/lib/toast";
import type { ResumeDocDetail } from "@/models/resume.model";
import { JobPicker, type JobOption } from "./JobPicker";

export function EditResumeDetailsDialog({
  open,
  onOpenChange,
  doc,
  jobs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ResumeDocDetail;
  jobs: JobOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(doc.name);
  const [targetRole, setTargetRole] = useState(doc.targetRole ?? "");
  const [jobId, setJobId] = useState<string | null>(doc.jobId);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(doc.name);
    setTargetRole(doc.targetRole ?? "");
    setJobId(doc.jobId);
  }, [open, doc]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateResumeMeta(doc.id, {
        name,
        ...(doc.kind === "base" ? { targetRole } : { jobId }),
      });
      toastActionResult(result, {
        success: "Details updated",
        onSuccess: () => {
          onOpenChange(false);
          router.refresh();
        },
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resume details</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-name">Name</Label>
            <Input id="doc-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {doc.kind === "base" ? (
            <div className="space-y-2">
              <Label htmlFor="doc-role">Target role</Label>
              <Input id="doc-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              <p className="text-xs text-muted-foreground">Claude reads this to pick the right base for a job.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="doc-job">Job</Label>
              <JobPicker id="doc-job" jobs={jobs} value={jobId} onChange={setJobId} allowNone />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              Save
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
