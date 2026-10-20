"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  MoreVertical,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import {
  approveCoverLetter,
  deleteCoverLetter,
  markCoverLetterSubmitted,
  revokeCoverLetterApproval,
  updateCoverLetter,
} from "@/actions/resume.actions";
import { getDocStatusBadgeColor } from "@/lib/badge-colors";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  docStatusLabel,
  isExportable,
  type CoverLetterDetail,
  type ResumeHeaderData,
} from "@/models/resume.model";
import { JobPicker, type JobOption } from "./JobPicker";

// A4 at 96dpi, matching the cover letter PDF's margins (44pt by 54pt).
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

function paragraphsOf(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).join("\n").trim())
    .filter(Boolean);
}

function LetterPreview({ header, content }: { header: ResumeHeaderData; content: string }) {
  const contact = [
    header.location,
    header.email,
    header.phone,
    ...header.links.map((l) => l.url.replace(/^https?:\/\//, "")),
  ].filter(Boolean);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Preview (A4)</p>
      <div className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div
          className="mx-auto bg-white text-[14px] leading-[1.45] text-[#111]"
          style={{
            maxWidth: PAGE_WIDTH,
            minHeight: PAGE_HEIGHT / 2,
            padding: "40px 48px",
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
          data-testid="letter-preview"
        >
          <p className="text-center text-[24px] font-bold leading-none tracking-wide">{header.fullName || "Your Name"}</p>
          {contact.length > 0 && <p className="mt-2 text-center text-[12px] text-[#444]">{contact.join("  •  ")}</p>}
          <div className="mt-6 space-y-3">
            {paragraphsOf(content).map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type LetterEditorProps = {
  letter: CoverLetterDetail;
  header: ResumeHeaderData;
  jobs: JobOption[];
};

export function LetterEditor({ letter, header, jobs }: LetterEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(letter.title);
  const [content, setContent] = useState(letter.content);
  const [jobId, setJobId] = useState<string | null>(letter.jobId);
  const [confirm, setConfirm] = useState<"approve" | "submit" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();

  const frozen = letter.status === "submitted";
  const dirty = title !== letter.title || content !== letter.content || jobId !== letter.jobId;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  const act = (
    fn: () => Promise<{ success: boolean; message?: string }>,
    message: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      const result = await fn();
      setConfirm(null);
      if (!result.success) return toastError(result.message);
      toastSuccess(message);
      if (after) after();
      else router.refresh();
    });

  const save = () =>
    act(
      () => updateCoverLetter(letter.id, { title, content, jobId }),
      letter.status === "approved" ? "Saved. It needs approving again." : "Saved",
    );

  const discard = () => {
    setTitle(letter.title);
    setContent(letter.content);
    setJobId(letter.jobId);
  };

  return (
    <div className="col-span-3 space-y-4 py-2">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to cover letters" asChild>
          <Link href="/dashboard/resumes?tab=letters">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{letter.title}</h1>
            <Badge variant="outline">Cover letter</Badge>
            <StatusBadge label={docStatusLabel(letter.status)} color={getDocStatusBadgeColor(letter.status)} />
            {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {letter.job ? (
              <>
                For{" "}
                <Link
                  href={`/dashboard/myjobs/${letter.job.id}?tab=application`}
                  className="underline-offset-4 hover:underline"
                >
                  {letter.job.Company.label} · {letter.job.JobTitle.label}
                </Link>
              </>
            ) : (
              "Not linked to a job"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!frozen && (
            <Button variant="outline" disabled={!dirty || isPending} onClick={save} data-testid="save-letter-btn">
              Save
            </Button>
          )}
          {!frozen && dirty && (
            <Button variant="ghost" disabled={isPending} onClick={discard}>
              <Undo2 className="mr-1 h-4 w-4" /> Discard
            </Button>
          )}
          {letter.status === "draft" && (
            <Button
              disabled={dirty || isPending}
              title={dirty ? "Save your changes first" : undefined}
              onClick={() => setConfirm("approve")}
              data-testid="approve-letter-btn"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
          )}
          {isExportable(letter.status) && (
            <Button variant={frozen ? "default" : "outline"} asChild>
              <a href={`/api/letters/${letter.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1 h-4 w-4" /> PDF
              </a>
            </Button>
          )}
          {letter.status === "approved" && (
            <Button
              disabled={dirty || isPending}
              onClick={() => setConfirm("submit")}
              data-testid="submit-letter-btn"
            >
              <Send className="mr-1 h-4 w-4" /> Mark as sent
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {letter.status === "approved" && (
                <DropdownMenuItem onClick={() => act(() => revokeCoverLetterApproval(letter.id), "Back to draft")}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reopen as draft
                </DropdownMenuItem>
              )}
              {letter.status === "approved" && <DropdownMenuSeparator />}
              <DropdownMenuItem className="text-red-600" onClick={() => setConfirm("delete")}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {frozen && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          <p>
            Sent
            {letter.submittedAt
              ? ` on ${new Date(letter.submittedAt).toLocaleDateString("en-SG", { dateStyle: "medium" })}`
              : ""}
            . This is frozen as the record of what went out
            {letter.pdfPath ? <span className="text-muted-foreground"> (saved at {letter.pdfPath})</span> : null}.
          </p>
        </div>
      )}
      {letter.status === "approved" && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
          Approved. The PDF is available. Any edit returns it to draft for another review.
        </div>
      )}

      <div className="grid items-start gap-6 @5xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="letter-title">Title</Label>
            <Input id="letter-title" value={title} disabled={frozen} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="letter-job">Job</Label>
            <JobPicker id="letter-job" jobs={jobs} value={jobId} onChange={setJobId} allowNone disabled={frozen} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="letter-content">Letter</Label>
              <span className="text-xs text-muted-foreground">
                {words} words{words > 400 ? " · most readers stop around 300" : ""}
              </span>
            </div>
            <Textarea
              id="letter-content"
              value={content}
              disabled={frozen}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[480px] font-[inherit] leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs.</p>
          </div>
        </div>
        <div className="@5xl/main:sticky @5xl/main:top-4">
          <LetterPreview header={header} content={content} />
        </div>
      </div>

      <AlertDialog open={confirm === "approve" || confirm === "submit"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "approve" ? "Approve this letter?" : "Mark as sent?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "approve"
                ? "You are confirming every claim is accurate and the wording is yours to send. The PDF becomes available, and any later edit sends it back to draft."
                : "This writes the PDF into the job's application folder on your server and freezes the letter as the record of what you sent."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirm === "approve") act(() => approveCoverLetter(letter.id), "Approved. The PDF is ready.");
                else act(() => markCoverLetterSubmitted(letter.id), "Saved as sent");
              }}
            >
              {confirm === "approve" ? "Approve" : "Mark as sent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteAlertDialog
        pageTitle="cover letter"
        open={confirm === "delete"}
        onOpenChange={(o) => setConfirm(o ? "delete" : null)}
        onDelete={() =>
          act(() => deleteCoverLetter(letter.id), "Cover letter deleted", () =>
            router.push("/dashboard/resumes?tab=letters"),
          )
        }
        alertDescription={
          frozen ? "The record goes, but the PDF that was sent stays in the application folder on your server." : undefined
        }
      />
    </div>
  );
}
