import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  Clock,
  FileText,
  Lightbulb,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import type { DashboardData } from "@/lib/dashboard";
import AddContactShortcut from "./AddContactShortcut";

const TZ = "Asia/Singapore";

function dayLabel(at: Date, now: Date) {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = key(now);
  const tomorrow = key(new Date(now.getTime() + 86_400_000));
  const k = key(at);
  if (k < today) return "Overdue";
  if (k === today) return "Today";
  if (k === tomorrow) return "Tomorrow";
  return at.toLocaleDateString("en-SG", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(at: Date) {
  const t = at.toLocaleTimeString("en-SG", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  // Dates without a time are stored at midnight; showing "12:00 am" is noise.
  return /^12:00\s?am$/i.test(t) ? "" : t;
}

function Stat({ label, value, hint, href }: { label: string; value: number; hint?: string; href?: string }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-muted/40">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const UPCOMING_ICON = { stage: CalendarClock, deadline: Clock, task: CheckSquare };

export function DashboardView({ data, now }: { data: DashboardData; now: Date }) {
  const { counts, pipeline, upcoming, drafts, suggestions, clashes, recent } = data;
  const max = Math.max(1, ...pipeline.map((p) => p.count));
  const attention = drafts.length + (suggestions > 0 ? 1 : 0) + clashes.length;

  return (
    <div className="col-span-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString("en-SG", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/myjobs?add-job=true">
              <BriefcaseBusiness className="mr-2 h-4 w-4" /> Add job
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/documents">
              <Upload className="mr-2 h-4 w-4" /> Upload document
            </Link>
          </Button>
          <AddContactShortcut />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4">
        <Stat label="Open applications" value={counts.open} hint={`${counts.total} tracked in total`} href="/dashboard/myjobs" />
        <Stat label="Applied, last 30 days" value={counts.appliedLast30} />
        <Stat label="Interviews, next 2 weeks" value={counts.interviewsSoon} href="/dashboard/interviews" />
        <Stat
          label="Awaiting your approval"
          value={counts.awaitingApproval}
          hint="Resumes and letters in draft"
          href="/dashboard/resumes"
        />
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-2">
        {/* Needs attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Needs your attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attention === 0 && <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>}
            {clashes.map(({ job, clashes: hits }) => (
              <Link
                key={job.id}
                href="/dashboard/availability"
                className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm hover:bg-amber-500/10"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <span className="font-medium">
                    {job.Company.label} · {job.JobTitle.label}
                  </span>{" "}
                  clashes with {hits.map((h) => h.title).join(" and ")}.
                </span>
              </Link>
            ))}
            {suggestions > 0 && (
              <Link
                href="/dashboard/bank?tab=suggestions"
                className="flex items-start gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <span>
                  Claude suggested {suggestions} addition{suggestions > 1 ? "s" : ""} to your experience bank.
                </span>
              </Link>
            )}
            {drafts.slice(0, 6).map((d) => (
              <Link
                key={d.id}
                href={d.href}
                className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <span className="flex min-w-0 items-start gap-3">
                  {d.fromClaude ? (
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.kind} · {d.fromClaude ? "drafted by Claude" : "draft"}, review and approve
                    </span>
                  </span>
                </span>
              </Link>
            ))}
            {drafts.length > 6 && (
              <Link href="/dashboard/resumes" className="block text-sm text-muted-foreground hover:underline">
                and {drafts.length - 6} more drafts
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Coming up</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No interviews, closing dates or tasks in the next two weeks.
              </p>
            ) : (
              <ul className="divide-y">
                {upcoming.slice(0, 8).map((u) => {
                  const Icon = UPCOMING_ICON[u.kind];
                  const day = dayLabel(u.at, now);
                  return (
                    <li key={u.key}>
                      <Link href={u.href} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{u.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.sub}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs">
                          <span className={day === "Overdue" ? "font-medium text-red-600" : "font-medium"}>{day}</span>
                          {u.kind === "stage" && timeLabel(u.at) && (
                            <span className="block text-muted-foreground">{timeLabel(u.at)}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a job to start tracking.</p>
            ) : (
              <ul className="space-y-2" aria-label="Jobs by status">
                {pipeline.map((p) => (
                  <li key={p.value}>
                    <Link
                      href={`/dashboard/myjobs?status=${encodeURIComponent(p.value)}`}
                      className="group grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-sm"
                      title={`${p.label}: ${p.count}`}
                    >
                      <span className="truncate text-muted-foreground group-hover:text-foreground">{p.label}</span>
                      <span className="h-3 rounded-r bg-muted/60">
                        <span
                          className="block h-3 rounded-r bg-primary/80 group-hover:bg-primary"
                          style={{ width: `${(p.count / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{p.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recently added</CardTitle>
            <Link href="/dashboard/myjobs" className="text-xs text-muted-foreground hover:underline">
              All jobs
            </Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((job) => (
                  <li key={job.id}>
                    <Link href={`/dashboard/myjobs/${job.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{job.Company.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{job.JobTitle.label}</span>
                      </span>
                      <StatusBadge label={job.Status.label} color={getJobStatusBadgeColor(job.Status.value)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {counts.total === 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-6 text-sm">
            <p className="font-medium">Getting started</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Fill the <Link href="/dashboard/bank" className="underline">Experience Bank</Link>, or import a bank file.
              </li>
              <li>
                Connect Claude in <Link href="/dashboard/settings" className="underline">Settings, MCP Access</Link>.
              </li>
              <li>Add a job, then ask Claude to tailor a resume for it. You approve every line before a PDF exists.</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
