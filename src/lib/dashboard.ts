import prisma from "@/lib/db";
import { JOB_STATUSES } from "@/lib/constants";
import { CLOSED_STATUSES, jobClashes } from "@/lib/availability";

const DAY = 86_400_000;
const JOB_LABEL = {
  id: true,
  JobTitle: { select: { label: true } },
  Company: { select: { label: true } },
} as const;

// Everything the dashboard shows, in one round of queries. "Upcoming" looks
// two weeks ahead; overdue items are included so they are not lost.
export async function getDashboard(userId: string, now = new Date()) {
  const soon = new Date(now.getTime() + 14 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);

  const [
    byStatus,
    appliedLast30,
    stages,
    deadlines,
    tasks,
    draftResumes,
    draftLetters,
    suggestions,
    clashes,
    recent,
    windows,
    suggestedWindows,
  ] = await Promise.all([
    prisma.job.groupBy({ by: ["statusId"], where: { userId }, _count: { _all: true } }),
    prisma.job.count({ where: { userId, appliedDate: { gte: monthAgo } } }),
    prisma.jobStage.findMany({
      where: { Job: { userId }, occurredAt: { gte: new Date(now.getTime() - DAY), lte: soon } },
      select: {
        id: true,
        occurredAt: true,
        format: true,
        StageType: { select: { label: true } },
        Job: { select: JOB_LABEL },
      },
      orderBy: { occurredAt: "asc" },
      take: 10,
    }),
    prisma.job.findMany({
      where: {
        userId,
        applied: false,
        dueDate: { lte: soon, gte: new Date(now.getTime() - 7 * DAY) },
        Status: { value: { notIn: CLOSED_STATUSES } },
      },
      select: { ...JOB_LABEL, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["in-progress", "needs-attention"] }, dueDate: { lte: soon } },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.resumeDoc.findMany({
      where: { userId, status: "draft" },
      select: { id: true, name: true, kind: true, createdVia: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.coverLetter.findMany({
      where: { userId, status: "draft" },
      select: { id: true, title: true, createdVia: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bankSuggestion.count({ where: { userId, status: "pending" } }),
    jobClashes(userId),
    prisma.job.findMany({
      where: { userId },
      select: {
        ...JOB_LABEL,
        createdAt: true,
        appliedDate: true,
        Status: { select: { label: true, value: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    // Confirmed windows opening in the next four weeks, or closing in two.
    prisma.targetWindow.findMany({
      where: {
        status: "confirmed",
        target: { userId, archived: false },
        OR: [
          { opensAt: { gte: new Date(now.getTime() - DAY), lte: new Date(now.getTime() + 28 * DAY) } },
          { closesAt: { gte: new Date(now.getTime() - DAY), lte: soon } },
        ],
      },
      select: {
        id: true,
        intake: true,
        opensAt: true,
        closesAt: true,
        target: { select: { name: true } },
      },
    }),
    prisma.targetWindow.count({ where: { status: "suggested", target: { userId, archived: false } } }),
  ]);

  const statuses = await prisma.jobStatus.findMany({
    where: { id: { in: byStatus.map((s) => s.statusId) } },
    select: { id: true, label: true, value: true },
  });
  const order = JOB_STATUSES.map((s) => s.value as string);
  const pipeline = byStatus
    .map((row) => {
      const status = statuses.find((s) => s.id === row.statusId);
      return { value: status?.value ?? "unknown", label: status?.label ?? "Unknown", count: row._count._all };
    })
    .sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));

  const total = pipeline.reduce((n, s) => n + s.count, 0);
  const open = pipeline.filter((s) => !CLOSED_STATUSES.includes(s.value)).reduce((n, s) => n + s.count, 0);

  type Upcoming = {
    key: string;
    at: Date;
    kind: "stage" | "deadline" | "task" | "window";
    title: string;
    sub: string;
    href: string;
  };
  const upcoming: Upcoming[] = [
    ...stages.map((s) => ({
      key: `s-${s.id}`,
      at: s.occurredAt!,
      kind: "stage" as const,
      title: s.StageType.label,
      sub: `${s.Job.Company.label} · ${s.Job.JobTitle.label}`,
      href: `/dashboard/myjobs/${s.Job.id}?tab=timeline`,
    })),
    ...deadlines.map((j) => ({
      key: `d-${j.id}`,
      at: j.dueDate!,
      kind: "deadline" as const,
      title: "Application closes",
      sub: `${j.Company.label} · ${j.JobTitle.label}`,
      href: `/dashboard/myjobs/${j.id}`,
    })),
    ...tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        key: `t-${t.id}`,
        at: t.dueDate!,
        kind: "task" as const,
        title: t.title,
        sub: "Task",
        href: "/dashboard/tasks",
      })),
    // A window shows once: as opening if that is still ahead, else as closing.
    ...windows.map((w) => {
      const opening = w.opensAt >= new Date(now.getTime() - DAY);
      return {
        key: `w-${w.id}`,
        at: opening ? w.opensAt : w.closesAt!,
        kind: "window" as const,
        title: opening ? "Applications open" : "Applications close",
        sub: `${w.target.name} · ${w.intake}`,
        href: "/dashboard/seasons",
      };
    }),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    counts: {
      total,
      open,
      appliedLast30,
      interviewsSoon: stages.filter((s) => s.occurredAt! >= now).length,
      awaitingApproval: draftResumes.length + draftLetters.length,
    },
    pipeline,
    upcoming,
    drafts: [
      ...draftResumes.map((d) => ({
        id: d.id,
        title: d.name,
        kind: d.kind === "base" ? "Base resume" : "Resume variant",
        fromClaude: Boolean(d.createdVia),
        updatedAt: d.updatedAt,
        href: `/dashboard/resumes/${d.id}`,
      })),
      ...draftLetters.map((l) => ({
        id: l.id,
        title: l.title,
        kind: "Cover letter",
        fromClaude: Boolean(l.createdVia),
        updatedAt: l.updatedAt,
        href: `/dashboard/letters/${l.id}`,
      })),
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    suggestions,
    suggestedWindows,
    clashes,
    recent,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
