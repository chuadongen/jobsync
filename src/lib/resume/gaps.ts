import prisma from "@/lib/db";
import {
  GapSuggestionSchema,
  RequirementSchema,
  furthestStage,
  hasNumber,
  type BaseGaps,
  type BaseResults,
  type Coverage,
  type CoverageRow,
  type GapSuggestion,
  type MissingNumber,
  type Requirement,
} from "@/models/gaps.model";
import { getDocDetail } from "./docs";

const CLOSED = ["rejected", "withdrawn", "expired", "archived"];

async function requireBase(userId: string, baseId: string) {
  const base = await prisma.resumeDoc.findFirst({
    where: { id: baseId, userId, kind: "base" },
    select: { id: true, name: true, targetRole: true },
  });
  if (!base) throw new Error("Base version not found");
  return base;
}

function parseRequirements(raw: string): Requirement[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Saved by Claude while tailoring. Evidence ids that are not the user's bank
// bullets are dropped rather than failing the whole save.
export async function saveJobRequirements(
  userId: string,
  input: { jobId: string; baseId?: string | null; requirements: unknown[] },
  createdVia: string | null = null,
) {
  const job = await prisma.job.findFirst({ where: { id: input.jobId, userId }, select: { id: true } });
  if (!job) throw new Error("Job not found");
  if (input.baseId) await requireBase(userId, input.baseId);

  const requirements = input.requirements.map((r) => RequirementSchema.parse(r));
  const cited = [...new Set(requirements.flatMap((r) => r.evidence))];
  const owned = new Set(
    (
      await prisma.bankBullet.findMany({
        where: { id: { in: cited }, entry: { userId } },
        select: { id: true },
      })
    ).map((b) => b.id),
  );
  const cleaned = requirements.map((r) => ({ ...r, evidence: r.evidence.filter((id) => owned.has(id)) }));

  const data = {
    baseId: input.baseId ?? null,
    requirements: JSON.stringify(cleaned),
    createdVia,
  };
  return prisma.jobAnalysis.upsert({
    where: { jobId: input.jobId },
    update: data,
    create: { ...data, userId, jobId: input.jobId },
  });
}

export async function saveGapReport(
  userId: string,
  input: { baseId: string; summary: string; suggestions: unknown[] },
  createdVia: string | null = null,
) {
  await requireBase(userId, input.baseId);
  const summary = input.summary.trim();
  if (!summary) throw new Error("The report needs a summary");
  const suggestions: GapSuggestion[] = input.suggestions.map((s) => GapSuggestionSchema.parse(s));
  const data = { summary, suggestions: JSON.stringify(suggestions), createdVia };
  return prisma.gapReport.upsert({
    where: { baseId: input.baseId },
    update: data,
    create: { ...data, userId, baseId: input.baseId },
  });
}

const COVERAGE_RANK: Record<Coverage, number> = { none: 0, weak: 1, strong: 2 };

// Requirements across every job mapped to this base: either the analysis
// names it, or the job has a variant made from it. The latest assessment of
// a requirement wins, since the bank may have grown since the first.
async function coverageFor(userId: string, baseId: string) {
  const analyses = await prisma.jobAnalysis.findMany({
    where: {
      userId,
      OR: [{ baseId }, { job: { resumeDocs: { some: { baseId } } } }],
    },
    orderBy: { updatedAt: "asc" },
  });

  const rows = new Map<string, CoverageRow & { evidenceIds: Set<string> }>();
  for (const a of analyses) {
    const seen = new Set<string>();
    for (const r of parseRequirements(a.requirements)) {
      const key = r.label.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const row = rows.get(key);
      if (row) {
        row.mentions += 1;
        if (r.importance === "required") row.required += 1;
        row.label = r.label;
        row.coverage = r.coverage;
        row.assessedAt = a.updatedAt;
        row.evidenceIds = new Set(r.evidence ?? []);
      } else {
        rows.set(key, {
          label: r.label,
          kind: r.kind,
          mentions: 1,
          required: r.importance === "required" ? 1 : 0,
          coverage: r.coverage,
          evidence: [],
          evidenceIds: new Set(r.evidence ?? []),
          assessedAt: a.updatedAt,
        });
      }
    }
  }

  const ids = [...new Set([...rows.values()].flatMap((r) => [...r.evidenceIds]))];
  const bullets = new Map(
    (
      await prisma.bankBullet.findMany({
        where: { id: { in: ids }, entry: { userId } },
        select: { id: true, text: true },
      })
    ).map((b) => [b.id, b.text]),
  );

  const coverage = [...rows.values()]
    .map(({ evidenceIds, ...row }) => ({
      ...row,
      evidence: [...evidenceIds].filter((id) => bullets.has(id)).map((id) => ({ id, text: bullets.get(id)! })),
    }))
    // Most-asked first; among equals, the weakest coverage first.
    .sort(
      (a, b) =>
        b.mentions - a.mentions ||
        COVERAGE_RANK[a.coverage] - COVERAGE_RANK[b.coverage] ||
        a.label.localeCompare(b.label),
    );
  return { analysedJobs: analyses.length, coverage };
}

// Outcomes of applications actually sent with a variant of this base.
async function resultsFor(userId: string, baseId: string): Promise<BaseResults> {
  const variants = await prisma.resumeDoc.findMany({
    where: { userId, baseId, kind: "variant", status: "submitted", jobId: { not: null } },
    select: {
      job: {
        select: {
          id: true,
          Status: { select: { value: true } },
          stages: { select: { StageType: { select: { label: true, Status: { select: { value: true } } } } } },
        },
      },
    },
  });
  // One job counts once even if two variants of this base went to it.
  const jobs = new Map(variants.filter((v) => v.job).map((v) => [v.job!.id, v.job!]));

  const results: BaseResults = {
    sent: jobs.size,
    waiting: 0,
    screenedOut: 0,
    reachedAssessment: 0,
    reachedInterview: 0,
    offers: 0,
    stoppedAt: { applied: 0, assessment: 0, interview: 0, offer: 0 },
  };
  for (const job of jobs.values()) {
    const furthest = furthestStage(
      job.stages.map((s) => ({ label: s.StageType.label, statusValue: s.StageType.Status.value })),
    );
    const closed = CLOSED.includes(job.Status.value);
    if (furthest !== "applied") results.reachedAssessment += 1;
    if (furthest === "interview" || furthest === "offer") results.reachedInterview += 1;
    if (furthest === "offer") results.offers += 1;
    if (furthest === "applied") {
      if (closed) results.screenedOut += 1;
      else results.waiting += 1;
    }
    if (closed) results.stoppedAt[furthest] += 1;
  }
  return results;
}

async function missingNumbersFor(userId: string, baseId: string): Promise<MissingNumber[]> {
  const doc = await getDocDetail(userId, baseId);
  if (!doc) return [];
  return doc.rendered.sections
    .filter((s) => s.key !== "skills" && s.key !== "education")
    .flatMap((s) =>
      s.items.flatMap((item) =>
        item.bullets
          .filter((b) => !hasNumber(b.text))
          .map((b) => ({ entry: item.organisation, sourceId: b.sourceId, text: b.text })),
      ),
    );
}

export async function getBaseGaps(userId: string, baseId: string): Promise<BaseGaps> {
  const base = await requireBase(userId, baseId);
  const [{ analysedJobs, coverage }, results, missingNumbers, report] = await Promise.all([
    coverageFor(userId, baseId),
    resultsFor(userId, baseId),
    missingNumbersFor(userId, baseId),
    prisma.gapReport.findUnique({ where: { baseId } }),
  ]);
  let suggestions: GapSuggestion[] = [];
  if (report) {
    try {
      suggestions = JSON.parse(report.suggestions);
    } catch {
      suggestions = [];
    }
  }
  return {
    base,
    analysedJobs,
    coverage,
    results,
    missingNumbers,
    report: report
      ? { summary: report.summary, suggestions, updatedAt: report.updatedAt, createdVia: report.createdVia }
      : null,
  };
}

// Labels already in use, so Claude reuses "SQL" rather than adding "SQL skills".
export async function requirementLabels(userId: string) {
  const analyses = await prisma.jobAnalysis.findMany({ where: { userId }, select: { requirements: true } });
  const labels = new Map<string, string>();
  for (const a of analyses) {
    for (const r of parseRequirements(a.requirements)) {
      labels.set(r.label.toLowerCase().trim(), r.label);
    }
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}
