"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCoverLetter,
  createResumeBase,
  createResumeVariant,
} from "@/actions/resume.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import { JobPicker, type JobOption } from "./JobPicker";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function CreateBaseDialog({ open, onOpenChange }: DialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createResumeBase({ name, targetRole });
      if (!result.success) return toastError(result.message);
      toastSuccess("Base version created");
      onOpenChange(false);
      router.push(`/dashboard/resumes/${result.data!.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New base version</DialogTitle>
          <DialogDescription>
            A base is your starting resume for one kind of role. Variants for specific jobs are derived from it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-name">Name</Label>
            <Input id="base-name" required value={name} placeholder="PM" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="base-role">Target role</Label>
            <Input
              id="base-role"
              value={targetRole}
              placeholder="Product management internships"
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              Create
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateVariantDialog({
  open,
  onOpenChange,
  bases,
  jobs,
  defaultJobId,
}: DialogProps & {
  bases: { id: string; name: string; targetRole: string | null }[];
  jobs: JobOption[];
  defaultJobId?: string;
}) {
  const router = useRouter();
  const [baseId, setBaseId] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(defaultJobId ?? null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createResumeVariant({ baseId, jobId });
      if (!result.success) return toastError(result.message);
      toastSuccess("Variant created from the base");
      onOpenChange(false);
      router.push(`/dashboard/resumes/${result.data!.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New variant by hand</DialogTitle>
          <DialogDescription>
            Copies a base for one job so you can edit it yourself. To have Claude tailor it, use Copy Claude Prompt on the job instead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variant-base">Base version</Label>
            <Select value={baseId} onValueChange={setBaseId}>
              <SelectTrigger id="variant-base" aria-label="Base version">
                <SelectValue placeholder="Pick a base" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.targetRole ? ` · ${b.targetRole}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="variant-job">Job</Label>
            <JobPicker id="variant-job" jobs={jobs} value={jobId} onChange={setJobId} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !baseId || !jobId}>
              Create
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateLetterDialog({
  open,
  onOpenChange,
  jobs,
}: DialogProps & { jobs: JobOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCoverLetter({ title, content, jobId });
      if (!result.success) return toastError(result.message);
      toastSuccess("Cover letter drafted");
      onOpenChange(false);
      router.push(`/dashboard/letters/${result.data!.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New cover letter</DialogTitle>
          <DialogDescription>Write it here, or ask Claude to draft one for a job and it will appear in this list.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="letter-title">Title</Label>
            <Input id="letter-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="letter-job">Job</Label>
            <JobPicker id="letter-job" jobs={jobs} value={jobId} onChange={setJobId} allowNone />
          </div>
          <div className="space-y-2">
            <Label htmlFor="letter-content">Letter</Label>
            <Textarea id="letter-content" rows={10} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || content.trim().length < 20}>
              Save draft
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
