"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  approveResume,
  deleteResume,
  duplicateResume,
  markResumeSubmitted,
  revokeResumeApproval,
  saveResumeContent,
} from "@/actions/resume.actions";
import { getDocStatusBadgeColor } from "@/lib/badge-colors";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatDateRange } from "@/lib/resume/dates";
import {
  groupBySection,
  renderEditable,
  type EditableContent,
  type EditableItem,
} from "@/lib/resume/preview";
import { sectionForEntryType, type BankEntry } from "@/models/bank.model";
import {
  RESUME_SECTIONS,
  docStatusLabel,
  isExportable,
  type ResumeDocDetail,
  type ResumeHeaderData,
} from "@/models/resume.model";
import { ResumePreview } from "./ResumePreview";
import { EditResumeDetailsDialog } from "./EditResumeDetailsDialog";
import { BaseGapsPanel } from "./BaseGapsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import type { BaseGaps } from "@/models/gaps.model";
import type { JobOption } from "./JobPicker";

function contentFromDoc(doc: ResumeDocDetail): EditableContent {
  return {
    sectionOrder: doc.sectionOrder,
    items: doc.rendered.sections.flatMap((s) =>
      s.items.map((item) => ({
        entryId: item.entryId,
        // The detail carries the resolved title; an override is anything
        // that differs from the bank entry, worked out by the editor below.
        titleOverride: item.title,
        detailsOverride: item.details,
        bullets: item.bullets.map((b) => ({ sourceId: b.sourceId, text: b.text })),
      })),
    ),
  };
}

// Overrides equal to the bank value are not overrides; dropping them keeps
// later bank edits flowing through to the resume.
function normalise(content: EditableContent, entries: Map<string, BankEntry>): EditableContent {
  return {
    sectionOrder: content.sectionOrder,
    items: content.items.map((item) => {
      const entry = entries.get(item.entryId);
      return {
        ...item,
        titleOverride: item.titleOverride && item.titleOverride !== entry?.title ? item.titleOverride : null,
        detailsOverride:
          item.detailsOverride && item.detailsOverride !== entry?.details ? item.detailsOverride : null,
        bullets: item.bullets.map((b) => ({ ...b, text: b.text.trim() })),
      };
    }),
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type ResumeEditorProps = {
  doc: ResumeDocDetail;
  entries: BankEntry[];
  header: ResumeHeaderData;
  jobs: JobOption[];
  // Base versions only: variants are judged by their job, not by the market.
  gaps?: BaseGaps | null;
};

const EDITOR_TABS = ["content", "gaps"] as const;

export function ResumeEditor({ doc, entries, header, jobs, gaps }: ResumeEditorProps) {
  const [tab, setTab] = useTabQueryParam(EDITOR_TABS, "content");
  const router = useRouter();
  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const initial = useMemo(() => normalise(contentFromDoc(doc), entryMap), [doc, entryMap]);
  const [content, setContent] = useState<EditableContent>(initial);
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"approve" | "submit" | "delete" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showRationale, setShowRationale] = useState(true);

  const frozen = doc.status === "submitted";
  const normalised = normalise(content, entryMap);
  const dirty = JSON.stringify(normalised) !== JSON.stringify(initial);
  // A frozen doc shows its snapshot; anything else previews the working copy.
  const preview = frozen ? doc.rendered : renderEditable(content, entryMap, header);

  const updateItem = (index: number, patch: Partial<EditableItem>) =>
    setContent((c) => ({
      ...c,
      items: c.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  const updateBullet = (index: number, bulletIndex: number, text: string) =>
    setContent((c) => ({
      ...c,
      items: c.items.map((item, i) =>
        i === index
          ? { ...item, bullets: item.bullets.map((b, j) => (j === bulletIndex ? { ...b, text } : b)) }
          : item,
      ),
    }));

  // Moves an item within its section by swapping with its section neighbour.
  const moveItem = (sectionIndices: number[], position: number, delta: number) => {
    const target = sectionIndices[position + delta];
    if (target === undefined) return;
    const from = sectionIndices[position];
    setContent((c) => {
      const items = [...c.items];
      [items[from], items[target]] = [items[target], items[from]];
      return { ...c, items };
    });
  };

  const addEntry = (entry: BankEntry) =>
    setContent((c) => ({
      ...c,
      items: [
        ...c.items,
        {
          entryId: entry.id,
          titleOverride: null,
          detailsOverride: null,
          bullets: entry.bullets.filter((b) => !b.archived).slice(0, 3).map((b) => ({ sourceId: b.id, text: b.text })),
        },
      ],
    }));

  const save = () =>
    startTransition(async () => {
      const result = await saveResumeContent(doc.id, normalised);
      if (!result.success) return toastError(result.message);
      toastSuccess(doc.status === "approved" ? "Saved. It needs approving again." : "Saved");
      router.refresh();
    });

  const act = (
    fn: () => Promise<{ success: boolean; message?: string; data?: { id: string } | null | void }>,
    message: string,
    after?: (data: any) => void,
  ) =>
    startTransition(async () => {
      const result = await fn();
      setConfirm(null);
      if (!result.success) return toastError(result.message);
      toastSuccess(message);
      if (after) after(result.data);
      else router.refresh();
    });

  const usedEntryIds = new Set(content.items.map((i) => i.entryId));
  const sections = groupBySection(content, entryMap);

  const editorGrid = (
      <div className="grid items-start gap-6 @5xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Editor */}
        <div className="space-y-4">
          {doc.rationale && (
            <Card className="border-violet-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-violet-500" /> Claude&apos;s notes
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowRationale((v) => !v)}>
                  {showRationale ? "Hide" : "Show"}
                </Button>
              </CardHeader>
              {showRationale && (
                <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.rationale}</CardContent>
              )}
            </Card>
          )}

          {sections.map(({ key, items }, sectionPosition) => {
            const candidates = entries.filter(
              (e) => !e.archived && !usedEntryIds.has(e.id) && sectionForEntryType(e.type) === key,
            );
            if (items.length === 0 && candidates.length === 0) return null;
            const indices = items.map((x) => x.index);
            return (
              <Card key={key} data-testid={`section-${key}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm uppercase tracking-wide">{RESUME_SECTIONS[key]}</CardTitle>
                  {!frozen && (
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Move ${RESUME_SECTIONS[key]} up`}
                        disabled={sectionPosition === 0}
                        onClick={() => setContent((c) => ({ ...c, sectionOrder: move(c.sectionOrder, sectionPosition, sectionPosition - 1) }))}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Move ${RESUME_SECTIONS[key]} down`}
                        disabled={sectionPosition === content.sectionOrder.length - 1}
                        onClick={() => setContent((c) => ({ ...c, sectionOrder: move(c.sectionOrder, sectionPosition, sectionPosition + 1) }))}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map(({ item, index }, position) => {
                    const entry = entryMap.get(item.entryId);
                    if (!entry) return null;
                    const usedSources = new Set(item.bullets.map((b) => b.sourceId));
                    const spare = entry.bullets.filter((b) => !usedSources.has(b.id) && !b.archived);
                    const sourceText = new Map(entry.bullets.map((b) => [b.id, b.text]));
                    return (
                      <div key={`${item.entryId}-${index}`} className="rounded-md border p-3" data-testid="resume-item">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{entry.organisation}</p>
                            <p className="text-xs text-muted-foreground">
                              {[entry.title, formatDateRange(entry.startDate, entry.endDate)].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {!frozen && (
                            <div className="flex shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move entry up" disabled={position === 0} onClick={() => moveItem(indices, position, -1)}>
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move entry down" disabled={position === items.length - 1} onClick={() => moveItem(indices, position, 1)}>
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Remove ${entry.organisation}`}
                                onClick={() => setContent((c) => ({ ...c, items: c.items.filter((_, i) => i !== index) }))}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {key !== "skills" && (
                          <Input
                            className="mt-2 h-8 text-sm"
                            aria-label="Printed title"
                            disabled={frozen}
                            value={item.titleOverride ?? entry.title ?? ""}
                            placeholder="Printed title"
                            onChange={(e) => updateItem(index, { titleOverride: e.target.value })}
                          />
                        )}
                        {(entry.details || item.detailsOverride || key === "skills") && (
                          <Textarea
                            className="mt-2 min-h-0 text-sm"
                            rows={key === "skills" ? 2 : 1}
                            aria-label="Printed details"
                            disabled={frozen}
                            value={item.detailsOverride ?? entry.details ?? ""}
                            onChange={(e) => updateItem(index, { detailsOverride: e.target.value })}
                          />
                        )}

                        <ul className="mt-3 space-y-3">
                          {item.bullets.map((bullet, bulletIndex) => {
                            const source = sourceText.get(bullet.sourceId) ?? "";
                            const reworded = bullet.text.trim() !== source.trim();
                            return (
                              <li key={`${bullet.sourceId}-${bulletIndex}`} className="space-y-1">
                                <div className="flex items-start gap-1">
                                  <Textarea
                                    className={cn("min-h-0 flex-1 text-sm", reworded && "border-violet-500/50")}
                                    rows={2}
                                    disabled={frozen}
                                    aria-label="Bullet wording"
                                    value={bullet.text}
                                    onChange={(e) => updateBullet(index, bulletIndex, e.target.value)}
                                  />
                                  {!frozen && (
                                    <div className="flex flex-col">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Move bullet up" disabled={bulletIndex === 0} onClick={() => updateItem(index, { bullets: move(item.bullets, bulletIndex, bulletIndex - 1) })}>
                                        <ArrowUp className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Move bullet down" disabled={bulletIndex === item.bullets.length - 1} onClick={() => updateItem(index, { bullets: move(item.bullets, bulletIndex, bulletIndex + 1) })}>
                                        <ArrowDown className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove bullet" onClick={() => updateItem(index, { bullets: item.bullets.filter((_, j) => j !== bulletIndex) })}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {reworded && (
                                  <div className="flex items-start gap-2 pl-1 text-xs text-muted-foreground" data-testid="reworded-note">
                                    <span className="font-medium text-violet-600 dark:text-violet-400">Reworded from bank:</span>
                                    <span className="flex-1">{source}</span>
                                    {!frozen && (
                                      <button
                                        type="button"
                                        className="shrink-0 underline-offset-2 hover:underline"
                                        onClick={() => updateBullet(index, bulletIndex, source)}
                                      >
                                        Use original
                                      </button>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>

                        {!frozen && key !== "skills" && spare.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-muted-foreground">
                                <Plus className="mr-1 h-3.5 w-3.5" /> Add bullet from bank
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-w-md">
                              {spare.map((b) => (
                                <DropdownMenuItem
                                  key={b.id}
                                  className="whitespace-normal"
                                  onClick={() => updateItem(index, { bullets: [...item.bullets, { sourceId: b.id, text: b.text }] })}
                                >
                                  {b.text}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}

                  {!frozen && candidates.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add from bank
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>{RESUME_SECTIONS[key]}</DropdownMenuLabel>
                        {candidates.map((e) => (
                          <DropdownMenuItem key={e.id} onClick={() => addEntry(e)}>
                            {e.organisation}
                            {e.title ? <span className="ml-1 text-muted-foreground">· {e.title}</span> : null}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Preview */}
        <div className="@5xl/main:sticky @5xl/main:top-4">
          <ResumePreview resume={preview} />
        </div>
      </div>
  );

  return (
    <div className="col-span-3 space-y-4 py-2">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to resumes" asChild>
          <Link href="/dashboard/resumes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{doc.name}</h1>
            <Badge variant="outline">{doc.kind === "base" ? "Base version" : "Job variant"}</Badge>
            <StatusBadge label={docStatusLabel(doc.status)} color={getDocStatusBadgeColor(doc.status)} />
            {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {doc.kind === "base"
              ? doc.targetRole || "No target role set"
              : doc.job
                ? (
                    <>
                      For{" "}
                      <Link href={`/dashboard/myjobs/${doc.job.id}?tab=application`} className="underline-offset-4 hover:underline">
                        {doc.job.Company.label} · {doc.job.JobTitle.label}
                      </Link>
                      {doc.base && ` · from the ${doc.base.name} base`}
                    </>
                  )
                : "Not linked to a job"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!frozen && (
            <Button variant="outline" disabled={!dirty || isPending} onClick={save} data-testid="save-resume-btn">
              Save
            </Button>
          )}
          {!frozen && dirty && (
            <Button variant="ghost" disabled={isPending} onClick={() => setContent(initial)}>
              <Undo2 className="mr-1 h-4 w-4" /> Discard
            </Button>
          )}
          {doc.status === "draft" && (
            <Button
              disabled={dirty || isPending || content.items.length === 0}
              title={dirty ? "Save your changes first" : undefined}
              onClick={() => setConfirm("approve")}
              data-testid="approve-resume-btn"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
          )}
          {isExportable(doc.status) && (
            <Button variant={doc.status === "submitted" ? "default" : "outline"} asChild>
              <a href={`/api/resumes/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer" data-testid="download-pdf-btn">
                <Download className="mr-1 h-4 w-4" /> PDF
              </a>
            </Button>
          )}
          {doc.status === "approved" && doc.kind === "variant" && (
            <Button disabled={dirty || isPending} onClick={() => setConfirm("submit")} data-testid="submit-resume-btn">
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
              <DropdownMenuItem disabled={frozen} onClick={() => setDetailsOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit details
              </DropdownMenuItem>
              {doc.status === "approved" && (
                <DropdownMenuItem onClick={() => act(() => revokeResumeApproval(doc.id), "Back to draft")}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reopen as draft
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  act(() => duplicateResume(doc.id), "Duplicated as a new draft", (data) =>
                    router.push(`/dashboard/resumes/${data.id}`),
                  )
                }
              >
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
            Sent{doc.submittedAt ? ` on ${new Date(doc.submittedAt).toLocaleDateString("en-SG", { dateStyle: "medium" })}` : ""}. This is frozen as the record of what went out
            {doc.pdfPath ? <span className="text-muted-foreground"> (saved at {doc.pdfPath})</span> : null}. Duplicate it to make changes.
          </p>
        </div>
      )}
      {doc.status === "approved" && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
          Approved. The PDF is available. Any edit returns it to draft for another review.
        </div>
      )}

      {gaps ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="gaps" data-testid="gaps-tab">
              Gaps
              <Badge variant="secondary" className="ml-2">
                {gaps.coverage.filter((c) => c.coverage !== "strong").length + gaps.missingNumbers.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="content" className="mt-4">
            {editorGrid}
          </TabsContent>
          <TabsContent value="gaps" className="mt-4">
            <BaseGapsPanel gaps={gaps} />
          </TabsContent>
        </Tabs>
      ) : (
        editorGrid
      )}

      <AlertDialog open={confirm === "approve" || confirm === "submit"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "approve" ? "Approve this resume?" : "Mark as sent?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "approve"
                ? "You are confirming every line is accurate and worded the way you want. The PDF becomes available, and any later edit sends it back to draft."
                : "This writes the PDF into the job's application folder on your server and freezes this resume as the record of what you sent. It cannot be edited afterwards, only duplicated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirm === "approve") act(() => approveResume(doc.id), "Approved. The PDF is ready.");
                else act(() => markResumeSubmitted(doc.id), "Saved as sent");
              }}
            >
              {confirm === "approve" ? "Approve" : "Mark as sent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteAlertDialog
        pageTitle="resume"
        open={confirm === "delete"}
        onOpenChange={(o) => setConfirm(o ? "delete" : null)}
        onDelete={() => act(() => deleteResume(doc.id), "Resume deleted", () => router.push("/dashboard/resumes"))}
        alertDescription={
          doc.status === "submitted"
            ? "The record goes, but the PDF that was sent stays in the application folder on your server."
            : undefined
        }
      />

      <EditResumeDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} doc={doc} jobs={jobs} />
    </div>
  );
}

