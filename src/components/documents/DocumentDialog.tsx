"use client";
import { useEffect, useState, useTransition } from "react";
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
import { JobPicker, type JobOption } from "@/components/resumes/JobPicker";
import { updateDocument } from "@/actions/document.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
  type VaultDocument,
} from "@/models/document.model";

const MAX_MB = 20;

// Guess a category from the file name so most uploads need no extra clicks.
function guessCategory(name: string): DocumentCategory {
  const n = name.toLowerCase();
  if (/transcript|result slip|grades/.test(n)) return "transcript";
  if (/cert|certificate|award/.test(n)) return "certificate";
  if (/cover/.test(n)) return "cover-letter";
  if (/resume|cv\b/.test(n)) return "resume";
  if (/testimonial|recommend|reference/.test(n)) return "recommendation";
  if (/portfolio/.test(n)) return "portfolio";
  return "other";
}

function titleFrom(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

type DocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Editing when set; uploading a new file otherwise.
  document: VaultDocument | null;
  jobs: JobOption[];
  defaultJobId?: string | null;
  onSaved: () => void;
};

export function DocumentDialog({ open, onOpenChange, document, jobs, defaultJobId, onSaved }: DocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [jobId, setJobId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle(document?.title ?? "");
    setCategory(document?.category ?? "other");
    setJobId(document ? document.jobId : (defaultJobId ?? null));
    setNotes(document?.notes ?? "");
  }, [open, document, defaultJobId]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    if (!title.trim()) setTitle(titleFrom(f.name));
    if (category === "other") setCategory(guessCategory(f.name));
  };

  const tooLarge = !!file && file.size > MAX_MB * 1024 * 1024;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (document) {
        const result = await updateDocument(document.id, { title, category, jobId, notes });
        if (!result.success) return toastError(result.message);
        toastSuccess("Document updated");
      } else {
        if (!file) return;
        const body = new FormData();
        body.set("file", file);
        body.set("title", title);
        body.set("category", category);
        if (jobId) body.set("jobId", jobId);
        if (notes.trim()) body.set("notes", notes);
        const res = await fetch("/api/documents", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) return toastError(json.message ?? json.error ?? "Upload failed");
        toastSuccess(`Saved to ${json.data.filePath}`);
      }
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{document ? "Edit document" : "Upload document"}</DialogTitle>
          <DialogDescription>
            {document
              ? `Stored at ${document.filePath}. Editing changes the details here, not the file.`
              : "Files linked to a job go into that application's folder; the rest go into the vault by category."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!document && (
            <div className="space-y-2">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                accept={ALLOWED_DOCUMENT_EXTENSIONS.join(",")}
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <p className={tooLarge ? "text-xs text-red-600" : "text-xs text-muted-foreground"}>
                {tooLarge
                  ? `That file is over ${MAX_MB} MB.`
                  : `${ALLOWED_DOCUMENT_EXTENSIONS.join(" ")} · up to ${MAX_MB} MB`}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger id="doc-category" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-job">Job (optional)</Label>
              <JobPicker id="doc-job" jobs={jobs} value={jobId} onChange={setJobId} allowNone />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-notes">Notes</Label>
            <Textarea
              id="doc-notes"
              rows={3}
              value={notes}
              placeholder="e.g. Certified true copy, valid until 2028"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || (!document && (!file || tooLarge))}>
              {document ? "Save" : "Upload"}
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
