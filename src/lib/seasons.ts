import prisma from "@/lib/db";
import {
  TargetFormSchema,
  WindowFormSchema,
  jobMatchesTarget,
  type SeasonTarget,
  type TargetForm,
  type WindowForm,
  type WindowStatus,
} from "@/models/seasons.model";

const WINDOW_ORDER = { orderBy: { opensAt: "asc" as const } };

async function requireTarget(userId: string, id: string) {
  const target = await prisma.target.findFirst({ where: { id, userId }, select: { id: true } });
  if (!target) throw new Error("Target not found");
  return target;
}

async function requireWindow(userId: string, id: string) {
  const window = await prisma.targetWindow.findFirst({
    where: { id, target: { userId } },
    select: { id: true, targetId: true, intake: true },
  });
  if (!window) throw new Error("Window not found");
  return window;
}

// Every target with its windows and the saved jobs that match it. Matching
// runs here rather than in SQL: it is fuzzy on company names, and one user's
// jobs are a few hundred rows at most.
export async function listTargets(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<SeasonTarget[]> {
  const [targets, jobs] = await Promise.all([
    prisma.target.findMany({
      where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
      include: { windows: WINDOW_ORDER },
      orderBy: { name: "asc" },
    }),
    prisma.job.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        appliedDate: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Status: { select: { label: true, value: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return targets.map((t) => {
    const matched = jobs
      .filter((j) => jobMatchesTarget(t, { company: j.Company.label, title: j.JobTitle.label }))
      .map((j) => ({
        id: j.id,
        title: j.JobTitle.label,
        company: j.Company.label,
        status: j.Status.label,
        statusValue: j.Status.value,
        createdAt: j.createdAt,
        appliedDate: j.appliedDate,
      }));
    const firstSeen = new Map<number, Date>();
    for (const j of matched) {
      const year = j.createdAt.getFullYear();
      const seen = firstSeen.get(year);
      if (!seen || j.createdAt < seen) firstSeen.set(year, j.createdAt);
    }
    return {
      id: t.id,
      name: t.name,
      company: t.company,
      keyword: t.keyword,
      notes: t.notes,
      archived: t.archived,
      windows: t.windows.map((w) => ({ ...w, status: w.status as WindowStatus })),
      jobs: matched,
      observed: [...firstSeen.entries()]
        .map(([year, date]) => ({ year, firstSeen: date }))
        .sort((a, b) => a.year - b.year),
    };
  });
}

export async function saveTarget(userId: string, input: TargetForm, opts: { createdVia?: string | null } = {}) {
  const form = TargetFormSchema.parse(input);
  const data = { name: form.name, company: form.company, keyword: form.keyword, notes: form.notes };
  if (form.id) {
    await requireTarget(userId, form.id);
    return prisma.target.update({ where: { id: form.id }, data });
  }
  return prisma.target.create({ data: { ...data, userId, createdVia: opts.createdVia ?? null } });
}

export async function setTargetArchived(userId: string, id: string, archived: boolean) {
  await requireTarget(userId, id);
  return prisma.target.update({ where: { id }, data: { archived } });
}

export async function deleteTarget(userId: string, id: string) {
  await requireTarget(userId, id);
  await prisma.target.delete({ where: { id } });
}

export async function saveWindow(
  userId: string,
  targetId: string,
  input: WindowForm,
  opts: { status?: WindowStatus; createdVia?: string | null } = {},
) {
  const form = WindowFormSchema.parse(input);
  await requireTarget(userId, targetId);
  const data = {
    intake: form.intake,
    opensAt: form.opensAt,
    closesAt: form.closesAt ?? null,
    roleStart: form.roleStart ?? null,
    roleEnd: form.roleEnd ?? null,
    estimated: form.estimated,
    source: form.source,
    checkedAt: new Date(),
  };
  if (form.id) {
    const existing = await requireWindow(userId, form.id);
    if (existing.targetId !== targetId) throw new Error("Window not found");
    // A user edit is a confirmation: they have looked at it.
    return prisma.targetWindow.update({ where: { id: form.id }, data: { ...data, status: "confirmed" } });
  }
  return prisma.targetWindow.create({
    data: { ...data, targetId, status: opts.status ?? "confirmed", createdVia: opts.createdVia ?? null },
  });
}

// Confirming a suggestion makes it the window for its intake: any other
// window the target has for the same intake is the older answer and goes.
export async function confirmWindow(userId: string, id: string) {
  const window = await requireWindow(userId, id);
  await prisma.$transaction([
    prisma.targetWindow.deleteMany({
      where: { targetId: window.targetId, intake: window.intake, NOT: { id } },
    }),
    prisma.targetWindow.update({ where: { id }, data: { status: "confirmed" } }),
  ]);
}

export async function deleteWindow(userId: string, id: string) {
  await requireWindow(userId, id);
  await prisma.targetWindow.delete({ where: { id } });
}

// Claude's research: find or create the target, then queue each window as a
// suggestion. A repeat suggestion for an intake replaces the earlier pending
// one rather than piling up; confirmed windows are left for the user to swap.
export async function suggestWindows(
  userId: string,
  input: {
    target: { id?: string; name?: string; company?: string | null; keyword?: string | null };
    windows: WindowForm[];
  },
  createdVia: string,
) {
  let targetId = input.target.id;
  if (targetId) {
    await requireTarget(userId, targetId);
  } else {
    if (!input.target.name) throw new Error("A new target needs a name");
    const existing = await prisma.target.findFirst({
      where: { userId, name: input.target.name },
      select: { id: true },
    });
    targetId =
      existing?.id ??
      (
        await saveTarget(
          userId,
          { name: input.target.name, company: input.target.company, keyword: input.target.keyword },
          { createdVia },
        )
      ).id;
  }

  const saved = [];
  for (const w of input.windows) {
    const form = WindowFormSchema.parse(w);
    await prisma.targetWindow.deleteMany({
      where: { targetId, intake: form.intake, status: "suggested" },
    });
    saved.push(await saveWindow(userId, targetId!, form, { status: "suggested", createdVia }));
  }
  return { targetId: targetId!, windows: saved };
}

export async function countSuggestedWindows(userId: string) {
  return prisma.targetWindow.count({ where: { status: "suggested", target: { userId, archived: false } } });
}
