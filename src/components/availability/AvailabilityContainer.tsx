"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import { deleteAvailabilityBlock } from "@/actions/availability.actions";
import { toastActionResult } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_KINDS,
  rangesOverlap,
  overlapDays,
  type AvailabilityBlock,
} from "@/models/availability.model";
import { BlockDialog } from "./BlockDialog";
import { formatDay, formatSpan } from "./dates";

export type RolePeriod = {
  id: string;
  startDate: Date | null;
  endDate: Date | null;
  JobTitle: { label: string };
  Company: { label: string };
  Status: { label: string; value: string };
};

const WINDOW_MONTHS = 12;

function monthStart(d: Date, offset = 0) {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

type Bar = {
  key: string;
  label: string;
  sub: string;
  start: Date;
  end: Date;
  className: string;
  href?: string;
};

function Timeline({ bars, from }: { bars: Bar[]; from: Date }) {
  const to = monthStart(from, WINDOW_MONTHS);
  const span = to.getTime() - from.getTime();
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - from.getTime()) / span) * 100));
  const months = Array.from({ length: WINDOW_MONTHS }, (_, i) => monthStart(from, i));
  const today = new Date();
  const visible = bars.filter((b) => rangesOverlap(b.start, b.end, from, to));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Month scale */}
        <div className="ml-44 flex border-b text-[11px] text-muted-foreground">
          {months.map((m) => (
            <div key={m.toISOString()} className="flex-1 border-l px-1 pb-1">
              {m.toLocaleDateString("en-SG", { month: "short" })}
              {m.getMonth() === 0 && <span className="ml-1 font-medium text-foreground">{m.getFullYear()}</span>}
            </div>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="ml-44 py-6 text-sm text-muted-foreground">Nothing in this window.</p>
        ) : (
          visible.map((bar) => {
            const left = pct(bar.start);
            // One day past the end, so a single-day block still shows.
            const right = pct(new Date(bar.end.getTime() + 86_400_000));
            return (
              <div key={bar.key} className="flex items-center border-b last:border-b-0">
                <div className="w-44 shrink-0 truncate py-2 pr-3 text-sm" title={`${bar.label} · ${bar.sub}`}>
                  {bar.href ? (
                    <Link href={bar.href} className="underline-offset-4 hover:underline">
                      {bar.label}
                    </Link>
                  ) : (
                    bar.label
                  )}
                  <span className="block truncate text-xs text-muted-foreground">{bar.sub}</span>
                </div>
                <div className="relative h-9 flex-1">
                  {months.map((m) => (
                    <div
                      key={m.toISOString()}
                      className="absolute inset-y-0 border-l border-dashed border-muted"
                      style={{ left: `${pct(m)}%` }}
                    />
                  ))}
                  {today >= from && today < to && (
                    <div className="absolute inset-y-0 w-px bg-red-500/70" style={{ left: `${pct(today)}%` }} />
                  )}
                  <div
                    className={cn("absolute top-2 h-5 rounded", bar.className)}
                    style={{ left: `${left}%`, width: `${Math.max(0.6, right - left)}%` }}
                    title={formatSpan(bar.start, bar.end)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AvailabilityContainer({ blocks, roles }: { blocks: AvailabilityBlock[]; roles: RolePeriod[] }) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; block: AvailabilityBlock | null }>({ open: false, block: null });
  const [deleting, setDeleting] = useState<AvailabilityBlock | null>(null);
  const [, startTransition] = useTransition();
  // The timeline depends on today's date in the viewer's timezone, which the
  // server cannot know, so it is drawn after hydration only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const from = monthStart(new Date(), offset - 1);
  const now = new Date();
  const upcoming = blocks.filter((b) => new Date(b.endDate) >= now);
  const past = blocks.filter((b) => new Date(b.endDate) < now);

  const bars: Bar[] = useMemo(
    () => [
      ...blocks.map((b) => ({
        key: `b-${b.id}`,
        label: b.title,
        sub: AVAILABILITY_KINDS[b.kind],
        start: new Date(b.startDate),
        end: new Date(b.endDate),
        className:
          b.kind === "absolute"
            ? "bg-rose-500/80"
            : "border-2 border-dashed border-amber-500 bg-amber-400/30",
      })),
      ...roles.map((r) => ({
        key: `j-${r.id}`,
        label: r.Company.label,
        sub: `${r.JobTitle.label} · ${r.Status.label}`,
        start: new Date(r.startDate!),
        end: new Date(r.endDate!),
        className: "bg-blue-500/70",
        href: `/dashboard/myjobs/${r.id}`,
      })),
    ],
    [blocks, roles],
  );

  const clashes = useMemo(
    () =>
      roles.flatMap((r) =>
        blocks
          .filter((b) => rangesOverlap(new Date(r.startDate!), new Date(r.endDate!), new Date(b.startDate), new Date(b.endDate)))
          .map((b) => ({
            role: r,
            block: b,
            days: overlapDays(new Date(r.startDate!), new Date(r.endDate!), new Date(b.startDate), new Date(b.endDate)),
          })),
      ),
    [blocks, roles],
  );

  const remove = (block: AvailabilityBlock) =>
    startTransition(async () => {
      const result = await deleteAvailabilityBlock(block.id);
      toastActionResult(result, {
        success: "Block deleted",
        onSuccess: () => {
          setDeleting(null);
          router.refresh();
        },
      });
    });

  const BlockRow = ({ block }: { block: AvailabilityBlock }) => (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{block.title}</span>
          <Badge
            variant="outline"
            className={block.kind === "absolute" ? "border-rose-500/50 text-rose-600" : "border-amber-500/50 text-amber-600"}
          >
            {AVAILABILITY_KINDS[block.kind]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{formatSpan(block.startDate, block.endDate)}</p>
        {block.notes && <p className="mt-1 text-sm">{block.notes}</p>}
      </div>
      <div className="flex shrink-0">
        <Button variant="ghost" size="icon" aria-label={`Edit ${block.title}`} onClick={() => setDialog({ open: true, block })}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${block.title}`} onClick={() => setDeleting(block)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="col-span-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
          <p className="text-sm text-muted-foreground">
            Exchange, trips and other stretches you are away, set against the role periods of open applications.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, block: null })} data-testid="add-block-btn">
          <PlusCircle className="mr-2 h-4 w-4" /> Add block
        </Button>
      </div>

      {clashes.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> {clashes.length} clash{clashes.length > 1 ? "es" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {clashes.map(({ role, block, days }) => (
              <p key={`${role.id}-${block.id}`}>
                <Link href={`/dashboard/myjobs/${role.id}`} className="font-medium underline-offset-4 hover:underline">
                  {role.Company.label} · {role.JobTitle.label}
                </Link>{" "}
                overlaps <span className="font-medium">{block.title}</span> by {days} day{days > 1 ? "s" : ""}
                {block.kind === "potential" && <span className="text-muted-foreground"> (tentative)</span>}.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Timeline</CardTitle>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-4 rounded-sm bg-rose-500/80" /> Confirmed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-4 rounded-sm border border-dashed border-amber-500 bg-amber-400/30" /> Tentative
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-4 rounded-sm bg-blue-500/70" /> Role period
              </span>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="Earlier" onClick={() => setOffset((o) => o - 6)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset(0)}>
                Today
              </Button>
              <Button variant="ghost" size="icon" aria-label="Later" onClick={() => setOffset((o) => o + 6)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mounted ? <Timeline bars={bars} from={from} /> : <div className="h-24" />}
          {roles.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Add a role start and end date to a job to see it here.
            </p>
          )}
        </CardContent>
      </Card>

      {blocks.length === 0 ? (
        <JobTabEmptyState
          icon={CalendarRange}
          title="No blocks yet"
          description="Add your exchange semester, holidays or exam periods so you can see at a glance which roles you can actually take."
          actionLabel="Add block"
          onAction={() => setDialog({ open: true, block: null })}
        />
      ) : (
        <div className="grid gap-4 @4xl/main:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming and current</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing ahead.</p>
            ) : (
              upcoming.map((b) => <BlockRow key={b.id} block={b} />)
            )}
          </section>
          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Past</h2>
              {past
                .slice()
                .reverse()
                .map((b) => (
                  <BlockRow key={b.id} block={b} />
                ))}
            </section>
          )}
        </div>
      )}

      <BlockDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        block={dialog.block}
        onSaved={() => router.refresh()}
      />
      <DeleteAlertDialog
        pageTitle="block"
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDelete={() => deleting && remove(deleting)}
        alertDescription={deleting ? `${deleting.title}, ${formatDay(deleting.startDate)} to ${formatDay(deleting.endDate)}.` : undefined}
      />
    </div>
  );
}
