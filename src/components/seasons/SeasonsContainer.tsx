"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Check,
  MoreVertical,
  Pencil,
  PlusCircle,
  Sparkles,
  Target as TargetIcon,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import {
  confirmWindow,
  rolloverAll,
  rolloverWindow,
  deleteTarget,
  deleteWindow,
  setTargetArchived,
} from "@/actions/seasons.actions";
import { RESEARCH_WINDOWS_PROMPT, copyClaudePrompt } from "@/lib/claudePrompt";
import { toastActionResult } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AvailabilityBlock } from "@/models/availability.model";
import {
  WINDOW_PHASE_LABELS,
  windowPhase,
  type SeasonTarget,
  type SeasonWindow,
  type WindowPhase,
  nextIntakeName,
} from "@/models/seasons.model";
import { formatDay } from "@/components/availability/dates";
import { SeasonsBar } from "./SeasonsBar";
import { TargetDialog, WindowDialog } from "./TargetDialogs";

const PHASE_BADGE: Record<WindowPhase, string> = {
  upcoming: "border-sky-500/40 text-sky-700 dark:text-sky-300",
  soon: "border-blue-500/50 text-blue-700 dark:text-blue-300",
  open: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
  closing: "border-amber-500/60 text-amber-700 dark:text-amber-300",
  closed: "text-muted-foreground",
};

function WindowRow({
  window: w,
  now,
  onEdit,
  onDelete,
  onConfirm,
  onRollover,
}: {
  window: SeasonWindow;
  now: Date | null;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm?: () => void;
  onRollover?: () => void;
}) {
  const phase = now ? windowPhase(w, now) : null;
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-2 rounded-md border p-2.5 text-sm",
        w.status === "suggested" && "border-dashed border-violet-500/60 bg-violet-500/5",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{w.intake}</span>
          {w.status === "suggested" ? (
            <Badge variant="outline" className="border-violet-500/50 text-violet-600">
              <Sparkles className="mr-1 h-3 w-3" /> Suggested
            </Badge>
          ) : (
            phase && (
              <Badge variant="outline" className={PHASE_BADGE[phase]}>
                {WINDOW_PHASE_LABELS[phase]}
              </Badge>
            )
          )}
          {w.estimated && <Badge variant="outline">Estimated</Badge>}
        </div>
        <p className="text-muted-foreground">
          {formatDay(w.opensAt)} to {w.closesAt ? formatDay(w.closesAt) : "rolling / unknown"}
          {w.roleStart && (
            <>
              {" · role "}
              {formatDay(w.roleStart)}
              {w.roleEnd ? ` to ${formatDay(w.roleEnd)}` : ""}
            </>
          )}
        </p>
        {w.source && (
          <p className="truncate text-xs text-muted-foreground" title={w.source}>
            {/^https?:\/\//.test(w.source) ? (
              <a href={w.source} target="_blank" rel="noopener noreferrer" className="underline">
                {w.source.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              w.source
            )}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {onConfirm && (
          <Button size="sm" variant="outline" className="mr-1 h-7" onClick={onConfirm}>
            <Check className="mr-1 h-3.5 w-3.5" /> Confirm
          </Button>
        )}
        {onRollover && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Estimate next year from ${w.intake}`}
            title="Estimate next year's window from this one"
            onClick={onRollover}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${w.intake}`} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={w.status === "suggested" ? `Discard ${w.intake}` : `Delete ${w.intake}`}
          onClick={onDelete}
        >
          {w.status === "suggested" ? <X className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </li>
  );
}

export function SeasonsContainer({
  targets,
  blocks,
  rollableCount,
}: {
  targets: SeasonTarget[];
  blocks: AvailabilityBlock[];
  // Closed confirmed windows that have no next-year window yet
  rollableCount: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const [showArchived, setShowArchived] = useState(false);
  const [targetDialog, setTargetDialog] = useState<{ open: boolean; target: SeasonTarget | null }>({
    open: false,
    target: null,
  });
  const [windowDialog, setWindowDialog] = useState<{
    open: boolean;
    target: SeasonTarget | null;
    window: SeasonWindow | null;
  }>({ open: false, target: null, window: null });
  const [deleting, setDeleting] = useState<SeasonTarget | null>(null);
  const [, startTransition] = useTransition();

  const refresh = () => router.refresh();
  const act = (fn: () => Promise<any>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      toastActionResult(result, { success, onSuccess: refresh });
    });

  const active = targets.filter((t) => !t.archived);
  const visible = showArchived ? targets : active;
  const suggestions = active.flatMap((t) =>
    t.windows.filter((w) => w.status === "suggested").map((w) => ({ target: t, window: w })),
  );

  return (
    <div className="col-span-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Application Seasons</h1>
          <p className="text-sm text-muted-foreground">
            The companies and roles you are aiming for, and when each one takes applications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rollableCount > 0 && (
            <Button
              variant="outline"
              title="Copy each closed window forward a year, marked as estimated"
              onClick={() =>
                act(
                  () => rolloverAll(),
                  `Estimated ${rollableCount} window${rollableCount > 1 ? "s" : ""} for next year`,
                )
              }
              data-testid="rollover-all-btn"
            >
              <CalendarPlus className="mr-2 h-4 w-4" /> Estimate next year ({rollableCount})
            </Button>
          )}
          <Button variant="outline" onClick={() => copyClaudePrompt(RESEARCH_WINDOWS_PROMPT)}>
            <Sparkles className="mr-2 h-4 w-4" /> Research with Claude
          </Button>
          <Button onClick={() => setTargetDialog({ open: true, target: null })} data-testid="add-target-btn">
            <PlusCircle className="mr-2 h-4 w-4" /> Add target
          </Button>
        </div>
      </div>

      {active.length > 0 && <SeasonsBar targets={active} blocks={blocks} />}

      {suggestions.length > 0 && (
        <Card className="border-violet-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" /> {suggestions.length} window
              {suggestions.length > 1 ? "s" : ""} from Claude to check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Check each against its source. Confirming one replaces any other window the target has for that intake.
            </p>
            <ul className="space-y-2">
              {suggestions.map(({ target, window: w }) => (
                <div key={w.id}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{target.name}</p>
                  <WindowRow
                    window={w}
                    now={now}
                    onConfirm={() => act(() => confirmWindow(w.id), "Window confirmed")}
                    onEdit={() => setWindowDialog({ open: true, target, window: w })}
                    onDelete={() => act(() => deleteWindow(w.id), "Suggestion discarded")}
                  />
                </div>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Switch id="show-archived-targets" checked={showArchived} onCheckedChange={setShowArchived} />
        <Label htmlFor="show-archived-targets" className="text-sm">
          Show archived
        </Label>
      </div>

      {targets.length === 0 ? (
        <JobTabEmptyState
          icon={TargetIcon}
          title="No targets yet"
          description="Add the companies and roles you are aiming for. Then ask Claude to research when their applications open, or enter the dates yourself."
          actionLabel="Add target"
          onAction={() => setTargetDialog({ open: true, target: null })}
        />
      ) : (
        <div className="grid gap-4 @4xl/main:grid-cols-2">
          {visible.map((t) => {
            const confirmed = t.windows.filter((w) => w.status === "confirmed");
            return (
              <Card key={t.id} className={cn(t.archived && "opacity-60")}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {[t.company && `Company: ${t.company}`, t.keyword && `Title has "${t.keyword}"`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${t.name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTargetDialog({ open: true, target: t })}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit target
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          act(() => setTargetArchived(t.id, !t.archived), t.archived ? "Target restored" : "Target archived")
                        }
                      >
                        {t.archived ? (
                          <>
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4" /> Archive
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => setDeleting(t)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3">
                  {t.notes && <p className="text-sm">{t.notes}</p>}
                  {confirmed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No confirmed window yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {confirmed.map((w) => (
                        <WindowRow
                          key={w.id}
                          window={w}
                          now={now}
                          onEdit={() => setWindowDialog({ open: true, target: t, window: w })}
                          onDelete={() => act(() => deleteWindow(w.id), "Window deleted")}
                          onRollover={
                            t.windows.some((other) => other.intake === nextIntakeName(w.intake))
                              ? undefined
                              : () => act(() => rolloverWindow(w.id), `Estimated ${nextIntakeName(w.intake)}`)
                          }
                        />
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2"
                    onClick={() => setWindowDialog({ open: true, target: t, window: null })}
                  >
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add window
                  </Button>
                  <div className="border-t pt-2 text-xs text-muted-foreground">
                    {t.jobs.length === 0 ? (
                      "No saved jobs match yet."
                    ) : (
                      <>
                        {t.jobs.length} saved job{t.jobs.length > 1 ? "s" : ""}:{" "}
                        {t.jobs.slice(0, 3).map((j, i) => (
                          <span key={j.id}>
                            {i > 0 && ", "}
                            <Link href={`/dashboard/myjobs/${j.id}`} className="underline-offset-4 hover:underline">
                              {j.title}
                            </Link>
                          </span>
                        ))}
                        {t.jobs.length > 3 && ` and ${t.jobs.length - 3} more`}
                      </>
                    )}
                    {t.observed.length > 0 && (
                      <p className="mt-1">
                        First matching job saved: {t.observed.map((o) => formatDay(o.firstSeen)).join(", ")}. Next
                        year, this tells you when the window really opened.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TargetDialog
        open={targetDialog.open}
        onOpenChange={(open) => setTargetDialog((d) => ({ ...d, open }))}
        target={targetDialog.target}
        onSaved={refresh}
      />
      <WindowDialog
        open={windowDialog.open}
        onOpenChange={(open) => setWindowDialog((d) => ({ ...d, open }))}
        target={windowDialog.target}
        window={windowDialog.window}
        onSaved={refresh}
      />
      <DeleteAlertDialog
        pageTitle="target"
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDelete={() => {
          if (deleting) act(() => deleteTarget(deleting.id), "Target deleted");
          setDeleting(null);
        }}
        alertDescription="Its windows go too. Saved jobs are not affected."
      />
    </div>
  );
}
