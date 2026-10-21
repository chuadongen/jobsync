import prisma from "@/lib/db";
import { promoteStage, syncJobFromCurrentStage } from "@/actions/jobStage/shared";
import { sortStages } from "@/lib/jobs/sortStages";

// Stage access for Claude. It reads a job's rounds, adds one when the user
// reports a new round, and writes the prep and debrief fields. The user's
// own notes field is theirs: nothing here writes to it.

const MAX_TEXT = 20_000;

async function requireJob(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      description: true,
      Company: { select: { label: true } },
      JobTitle: { select: { label: true } },
      Status: { select: { label: true } },
    },
  });
  if (!job) throw new Error("Job not found");
  return job;
}

const STAGE_SELECT = {
  id: true,
  occurredAt: true,
  isCurrent: true,
  outcome: true,
  notes: true,
  prepNotes: true,
  debrief: true,
  format: true,
  location: true,
  durationMins: true,
  createdAt: true,
  StageType: { select: { label: true, sortOrder: true, Status: { select: { value: true } } } },
  interviewers: { select: { Contact: { select: { name: true, title: true } } } },
} as const;

function shapeStage(s: any) {
  return {
    id: s.id,
    stage: s.StageType.label,
    date: s.occurredAt,
    current: s.isCurrent,
    outcome: s.outcome,
    format: s.format,
    location: s.location,
    durationMins: s.durationMins,
    interviewers: s.interviewers.map((i: any) =>
      i.Contact.title ? `${i.Contact.name} (${i.Contact.title})` : i.Contact.name,
    ),
    userNotes: s.notes,
    prepNotes: s.prepNotes,
    debrief: s.debrief,
  };
}

// The job's rounds, plus debriefs from earlier applications to the same
// company: the best predictor of the next round is how theirs actually ran.
export async function getStagesForJob(userId: string, jobId: string) {
  const job = await requireJob(userId, jobId);
  const [stages, history] = await Promise.all([
    prisma.jobStage.findMany({ where: { jobId, Job: { userId } }, select: STAGE_SELECT }),
    prisma.jobStage.findMany({
      where: {
        debrief: { not: null },
        jobId: { not: jobId },
        Job: { userId, Company: { label: job.Company.label } },
      },
      select: {
        ...STAGE_SELECT,
        Job: { select: { id: true, JobTitle: { select: { label: true } }, createdAt: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
  ]);
  return {
    job: {
      id: job.id,
      title: job.JobTitle.label,
      company: job.Company.label,
      status: job.Status.label,
    },
    stages: sortStages(stages as any).map(shapeStage),
    sameCompanyHistory: history.map((s: any) => ({
      job: `${s.Job.JobTitle.label} (${s.Job.createdAt.getFullYear()})`,
      ...shapeStage(s),
    })),
  };
}

export async function stageTypeLabels(userId: string) {
  const types = await prisma.jobStageType.findMany({
    where: { createdBy: userId },
    select: { label: true },
    orderBy: { sortOrder: "asc" },
  });
  return types.map((t) => t.label);
}

// Adds a round the user reports ("I got the OA"). The type must be one of the
// user's stage types, matched without case, so Claude cannot mint new ones.
export async function addStageForJob(
  userId: string,
  input: { jobId: string; stage: string; occurredAt?: Date | null; setAsCurrent?: boolean },
) {
  await requireJob(userId, input.jobId);
  const types = await prisma.jobStageType.findMany({
    where: { createdBy: userId },
    select: { id: true, label: true },
  });
  const wanted = input.stage.trim().toLowerCase();
  const type = types.find((t) => t.label.toLowerCase() === wanted);
  if (!type) {
    throw new Error(`Unknown stage "${input.stage}". Use one of: ${types.map((t) => t.label).join(", ")}`);
  }
  const setAsCurrent = input.setAsCurrent ?? true;
  return prisma.$transaction(async (tx: any) => {
    const stage = await tx.jobStage.create({
      data: { jobId: input.jobId, stageTypeId: type.id, occurredAt: input.occurredAt ?? null },
    });
    if (setAsCurrent) {
      await promoteStage(tx, input.jobId, stage.id, userId);
      await syncJobFromCurrentStage(tx, input.jobId, stage.id, userId);
    }
    return { id: stage.id, stage: type.label, current: setAsCurrent };
  });
}

export async function saveStagePrep(
  userId: string,
  stageId: string,
  input: { prepNotes?: string | null; debrief?: string | null },
) {
  const data: { prepNotes?: string | null; debrief?: string | null } = {};
  for (const key of ["prepNotes", "debrief"] as const) {
    if (input[key] === undefined) continue;
    const value = input[key]?.trim() ?? "";
    if (value.length > MAX_TEXT) throw new Error(`${key} is too long`);
    data[key] = value || null;
  }
  if (Object.keys(data).length === 0) throw new Error("Nothing to save: pass prepNotes, debrief or both");
  const res = await prisma.jobStage.updateMany({ where: { id: stageId, Job: { userId } }, data });
  if (res.count === 0) throw new Error("Stage not found");
  return prisma.jobStage.findFirst({
    where: { id: stageId },
    select: { id: true, jobId: true, StageType: { select: { label: true } } },
  });
}
