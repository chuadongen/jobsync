"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RESEARCH_WINDOWS_PROMPT, copyClaudePrompt } from "@/lib/claudePrompt";
import { rangesOverlap, type AvailabilityBlock } from "@/models/availability.model";
import {
  WINDOW_PHASE_LABELS,
  windowPhase,
  type SeasonTarget,
  type SeasonWindow,
  type WindowPhase,
} from "@/models/seasons.model";
import { formatDay } from "@/components/availability/dates";

const MONTHS = 12;
const DAY = 86_400_000;

function monthStart(d: Date, offset = 0) {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

const PHASE_CLASS: Record<WindowPhase, string> = {
  upcoming: "bg-sky-500/70 text-white",
  soon: "bg-blue-600 text-white",
  open: "bg-emerald-600 text-white",
  closing: "bg-amber-500 text-white",
  closed: "bg-muted-foreground/30 text-foreground/70",
};

// An open-ended window (no known close) is drawn for six weeks and faded out.
const OPEN_ENDED_DAYS = 42;

function windowEnd(w: SeasonWindow) {
  return w.closesAt ? new Date(w.closesAt) : new Date(new Date(w.opensAt).getTime() + OPEN_ENDED_DAYS * DAY);
}

function isUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function WindowDetails({
  target,
  window: w,
  blocks,
  now,
}: {
  target: SeasonTarget;
  window: SeasonWindow;
  blocks: AvailabilityBlock[];
  now: Date;
}) {
  const phase = windowPhase(w, now);
  const clashes =
    w.roleStart && w.roleEnd
      ? blocks.filter((b) =>
          rangesOverlap(new Date(w.roleStart!), new Date(w.roleEnd!), new Date(b.startDate), new Date(b.endDate)),
        )
      : [];
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-semibold">{target.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{w.intake}</Badge>
          {w.status === "suggested" ? (
            <Badge variant="outline" className="border-violet-500/50 text-violet-600">
              <Sparkles className="mr-1 h-3 w-3" /> Suggested, not confirmed
            </Badge>
          ) : (
            <Badge variant="secondary">{WINDOW_PHASE_LABELS[phase]}</Badge>
          )}
          {w.estimated && <Badge variant="outline">Estimated</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">Opens</dt>
        <dd>{formatDay(w.opensAt)}</dd>
        <dt className="text-muted-foreground">Closes</dt>
        <dd>{w.closesAt ? formatDay(w.closesAt) : "Not known (often rolling)"}</dd>
        {w.roleStart && (
          <>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              {formatDay(w.roleStart)}
              {w.roleEnd ? ` to ${formatDay(w.roleEnd)}` : ""}
            </dd>
          </>
        )}
      </dl>
      {clashes.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          The role period runs into {clashes.map((b) => b.title).join(" and ")}.
        </p>
      )}
      {w.source && (
        <p className="break-words text-xs text-muted-foreground">
          Source:{" "}
          {isUrl(w.source) ? (
            <a href={w.source} target="_blank" rel="noopener noreferrer" className="underline">
              {w.source.replace(/^https?:\/\//, "").slice(0, 60)}
              <ExternalLink className="ml-0.5 inline h-3 w-3" />
            </a>
          ) : (
            w.source
          )}
          {" · checked "}
          {formatDay(w.checkedAt)}
        </p>
      )}
      {target.jobs.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Saved jobs</p>
          <ul className="mt-1 space-y-0.5">
            {target.jobs.slice(0, 5).map((j) => (
              <li key={j.id}>
                <Link href={`/dashboard/myjobs/${j.id}`} className="underline-offset-4 hover:underline">
                  {j.title}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">· {j.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No saved job matches this target yet.</p>
      )}
      <Link href="/dashboard/seasons" className="block text-xs text-primary hover:underline">
        {w.status === "suggested" ? "Confirm or correct it in Seasons" : "Manage in Seasons"}
      </Link>
    </div>
  );
}

type SeasonsBarProps = {
  targets: SeasonTarget[];
  blocks: AvailabilityBlock[];
  // On the Jobs page the bar is a summary: a few lanes, expandable.
  compact?: boolean;
};

export function SeasonsBar({ targets, blocks, compact = false }: SeasonsBarProps) {
  // Today and the month grid depend on the viewer's clock and timezone,
  // which the server cannot know, so the bar draws after hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const [offset, setOffset] = useState(0);
  const [showAll, setShowAll] = useState(!compact);

  const from = now ? monthStart(now, offset - 1) : null;
  const to = from ? monthStart(from, MONTHS) : null;

  const lanes = useMemo(() => {
    if (!from || !to || !now) return [];
    return targets
      .filter((t) => !t.archived)
      .map((t) => ({
        target: t,
        windows: t.windows.filter((w) => rangesOverlap(new Date(w.opensAt), windowEnd(w), from, to)),
      }))
      .filter((l) => l.windows.length > 0)
      .sort((a, b) => {
        // Soonest relevant window first: open ones, then the next to open.
        const key = (l: typeof a) =>
          Math.min(
            ...l.windows.map((w) => {
              const p = windowPhase(w, now);
              return p === "closed" ? Infinity : new Date(w.opensAt).getTime();
            }),
          );
        return key(a) - key(b);
      });
  }, [targets, from?.getTime(), to?.getTime(), now?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (targets.length === 0) {
    return (
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <CalendarRange className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Plan your application seasons</p>
              <p className="text-sm text-muted-foreground">
                Add the companies and roles you are aiming for, and their application windows show here.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copyClaudePrompt(RESEARCH_WINDOWS_PROMPT)}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Research with Claude
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/seasons">Set up targets</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!now || !from || !to) return <div className="mb-4 h-32 rounded-lg border bg-card" />;

  const span = to.getTime() - from.getTime();
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - from.getTime()) / span) * 100));
  const months = Array.from({ length: MONTHS }, (_, i) => monthStart(from, i));
  const visibleBlocks = blocks.filter((b) => rangesOverlap(new Date(b.startDate), new Date(b.endDate), from, to));
  const shown = showAll ? lanes : lanes.slice(0, 5);
  const todayLeft = pct(now);

  const background = (
    <>
      {months.map((m) => (
        <div key={m.toISOString()} className="absolute inset-y-0 border-l border-dashed border-muted" style={{ left: `${pct(m)}%` }} />
      ))}
      {visibleBlocks.map((b) => (
        <div
          key={b.id}
          className={cn("absolute inset-y-0", b.kind === "absolute" ? "bg-rose-500/[0.06]" : "bg-amber-500/[0.06]")}
          style={{
            left: `${pct(new Date(b.startDate))}%`,
            width: `${pct(new Date(new Date(b.endDate).getTime() + DAY)) - pct(new Date(b.startDate))}%`,
          }}
        />
      ))}
      <div className="absolute inset-y-0 w-px bg-red-500/70" style={{ left: `${todayLeft}%` }} />
    </>
  );

  return (
    <Card className="mb-4" data-testid="seasons-bar">
      <CardContent className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Application seasons</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 text-[11px] text-muted-foreground md:flex">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-600" /> Open</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-amber-500" /> Closing</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-blue-600" /> Opens soon</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-dashed border-violet-500" /> Suggested</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-rose-500/30" /> Away</span>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Earlier" onClick={() => setOffset((o) => o - 3)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7" disabled={offset === 0} onClick={() => setOffset(0)}>
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Later" onClick={() => setOffset((o) => o + 3)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="ml-40 flex border-b text-[11px] text-muted-foreground">
              {months.map((m) => (
                <div key={m.toISOString()} className="flex-1 px-1 pb-1">
                  {m.toLocaleDateString("en-SG", { month: "short" })}
                  {m.getMonth() === 0 && <span className="ml-1 font-medium text-foreground">{m.getFullYear()}</span>}
                </div>
              ))}
            </div>

            {visibleBlocks.length > 0 && (
              <div className="flex items-center border-b">
                <div className="w-40 shrink-0 truncate py-1 pr-3 text-xs text-muted-foreground">Away</div>
                <div className="relative h-6 flex-1">
                  {background}
                  {visibleBlocks.map((b) => (
                    <div
                      key={b.id}
                      className={cn(
                        "absolute top-1.5 h-3 truncate rounded px-1 text-[10px] leading-3",
                        b.kind === "absolute" ? "bg-rose-500/60 text-white" : "border border-dashed border-amber-500 text-amber-700",
                      )}
                      style={{
                        left: `${pct(new Date(b.startDate))}%`,
                        width: `${Math.max(1, pct(new Date(new Date(b.endDate).getTime() + DAY)) - pct(new Date(b.startDate)))}%`,
                      }}
                      title={`${b.title}: ${formatDay(b.startDate)} to ${formatDay(b.endDate)}`}
                    >
                      {b.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lanes.length === 0 ? (
              <p className="ml-40 py-4 text-sm text-muted-foreground">No windows in these months.</p>
            ) : (
              shown.map(({ target, windows }) => (
                <div key={target.id} className="flex items-center border-b last:border-b-0">
                  <div className="w-40 shrink-0 truncate py-1.5 pr-3 text-sm" title={target.name}>
                    {target.name}
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {target.jobs.length > 0 ? `${target.jobs.length} saved job${target.jobs.length > 1 ? "s" : ""}` : "No jobs yet"}
                    </span>
                  </div>
                  <div className="relative h-10 flex-1">
                    {background}
                    {windows.map((w) => {
                      const left = pct(new Date(w.opensAt));
                      const right = pct(new Date(windowEnd(w).getTime() + DAY));
                      const phase = windowPhase(w, now);
                      return (
                        <Popover key={w.id}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "absolute top-1.5 h-5 truncate rounded px-1.5 text-left text-[11px] font-medium leading-5 transition-opacity hover:opacity-90",
                                w.status === "suggested"
                                  ? "border border-dashed border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                                  : PHASE_CLASS[phase],
                              )}
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(1.2, right - left)}%`,
                                ...(!w.closesAt && w.status !== "suggested"
                                  ? { maskImage: "linear-gradient(to right, black 70%, transparent)" }
                                  : {}),
                              }}
                              aria-label={`${target.name}, ${w.intake}: ${WINDOW_PHASE_LABELS[phase]}`}
                            >
                              {w.intake}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="start">
                            <WindowDetails target={target} window={w} blocks={blocks} now={now} />
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                    {windows.map((w) => {
                      if (!w.roleStart || !w.roleEnd) return null;
                      // Red when the role runs into time you have committed elsewhere.
                      const clash = blocks.some(
                        (b) =>
                          b.kind === "absolute" &&
                          rangesOverlap(new Date(w.roleStart!), new Date(w.roleEnd!), new Date(b.startDate), new Date(b.endDate)),
                      );
                      return (
                          <div
                            key={`role-${w.id}`}
                            className={cn("absolute bottom-1 h-1 rounded-full", clash ? "bg-red-500/70" : "bg-foreground/25")}
                            style={{
                              left: `${pct(new Date(w.roleStart))}%`,
                              width: `${Math.max(0.5, pct(new Date(new Date(w.roleEnd).getTime() + DAY)) - pct(new Date(w.roleStart)))}%`,
                            }}
                            title={`Role: ${formatDay(w.roleStart)} to ${formatDay(w.roleEnd)}${clash ? " (clashes with a confirmed block)" : ""}`}
                          />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Bars are application windows; the thin line under one is the role period, red when it clashes. Click a bar for details.</span>
          <div className="flex gap-3">
            {lanes.length > 5 && (
              <button type="button" className="text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `Show all ${lanes.length}`}
              </button>
            )}
            {compact && (
              <Link href="/dashboard/seasons" className="text-primary hover:underline">
                Manage targets
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
