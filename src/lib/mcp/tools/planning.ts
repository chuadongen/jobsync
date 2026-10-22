import * as seasons from "@/lib/seasons";
import * as stages from "@/lib/stages";
import * as gaps from "@/lib/resume/gaps";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { MIN_JOBS_FOR_COVERAGE, MIN_SENT_FOR_RESULTS } from "@/models/gaps.model";

// Handlers for the planning tools: application seasons, base resume gaps and
// interview stages. Window research lands as suggestions for the user to
// confirm; stage prep and debriefs are notes, written directly.

type ToolResult = { content: Array<{ type: "text"; text: string }> };

const text = (value: string): ToolResult => ({ content: [{ type: "text", text: value }] });
const json = (value: unknown) => text(JSON.stringify(value, null, 1));

function appUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

async function guarded(userId: string, fn: () => Promise<ToolResult>): Promise<ToolResult> {
  const rate = checkMcpRateLimit(userId);
  if (!rate.allowed) {
    return text(`Rate limit exceeded. Try again in ${Math.ceil(rate.resetIn / 1000)}s.`);
  }
  try {
    return await fn();
  } catch (error: any) {
    return text(`Error: ${error?.issues?.[0]?.message ?? error?.message ?? "Unknown error"}`);
  }
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function handleListTargets(input: { includeArchived?: boolean }, userId: string) {
  return guarded(userId, async () => {
    const targets = await seasons.listTargets(userId, input);
    if (targets.length === 0) {
      return text("No targets yet. Create one by saving windows with save_target_windows and a target name.");
    }
    return json(
      targets.map((t) => ({
        id: t.id,
        name: t.name,
        company: t.company,
        keyword: t.keyword,
        notes: t.notes,
        windows: t.windows.map((w) => ({
          id: w.id,
          intake: w.intake,
          status: w.status,
          opensAt: day(w.opensAt),
          closesAt: day(w.closesAt),
          roleStart: day(w.roleStart),
          roleEnd: day(w.roleEnd),
          estimated: w.estimated,
          source: w.source,
          checkedAt: day(w.checkedAt),
        })),
        savedJobs: t.jobs.map((j) => `${j.title} (${j.status}, saved ${day(j.createdAt)})`),
        firstSeenOpen: t.observed.map((o) => ({ year: o.year, date: day(o.firstSeen) })),
      })),
    );
  });
}

export function handleSaveTargetWindows(
  input: {
    target: { id?: string; name?: string; company?: string; keyword?: string };
    windows: Array<{
      intake: string;
      opensAt: string;
      closesAt?: string;
      roleStart?: string;
      roleEnd?: string;
      estimated?: boolean;
      source: string;
    }>;
  },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    const saved = await seasons.suggestWindows(userId, input, tokenName);
    return text(
      `Saved ${saved.windows.length} window${saved.windows.length === 1 ? "" : "s"} for target ${saved.targetId} as suggestions. ` +
        `They show on the user's Jobs page once confirmed at ${appUrl("/dashboard/seasons")}.`,
    );
  });
}

export function handleGetJobStages(input: { jobId: string }, userId: string) {
  return guarded(userId, async () => {
    const [data, labels] = await Promise.all([
      stages.getStagesForJob(userId, input.jobId),
      stages.stageTypeLabels(userId),
    ]);
    return json({ ...data, stageTypes: labels });
  });
}

export function handleAddStage(
  input: { jobId: string; stage: string; date?: string; setAsCurrent?: boolean },
  userId: string,
) {
  return guarded(userId, async () => {
    let occurredAt: Date | null = null;
    if (input.date) {
      occurredAt = new Date(input.date);
      if (Number.isNaN(occurredAt.getTime())) return text(`Could not read the date "${input.date}".`);
    }
    const stage = await stages.addStageForJob(userId, { ...input, occurredAt });
    return text(
      `Added "${stage.stage}" (stage id: ${stage.id})${stage.current ? " as the current stage" : ""}. ` +
        `Save preparation to it with save_stage_notes.`,
    );
  });
}

export function handleSaveStageNotes(
  input: { stageId: string; prepNotes?: string; debrief?: string },
  userId: string,
) {
  return guarded(userId, async () => {
    const stage = await stages.saveStagePrep(userId, input.stageId, input);
    const what = [input.prepNotes !== undefined && "prep notes", input.debrief !== undefined && "debrief"]
      .filter(Boolean)
      .join(" and ");
    return text(
      `Saved ${what} on "${stage!.StageType.label}". The user sees them on the job's timeline: ${appUrl(`/dashboard/myjobs/${stage!.jobId}?tab=timeline`)}`,
    );
  });
}

export function handleSaveJobRequirements(
  input: { jobId: string; baseId?: string; requirements: unknown[] },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    const saved = await gaps.saveJobRequirements(userId, input, tokenName);
    const count = JSON.parse(saved.requirements).length;
    return text(
      `Saved ${count} requirements for the job${saved.baseId ? ", counted towards its base version's gaps" : ""}.`,
    );
  });
}

export function handleGetBaseGaps(input: { baseId: string }, userId: string) {
  return guarded(userId, async () => {
    const data = await gaps.getBaseGaps(userId, input.baseId);
    return json({
      ...data,
      caveats: [
        data.analysedJobs < MIN_JOBS_FOR_COVERAGE &&
          `Only ${data.analysedJobs} analysed job(s): coverage frequencies are indicative.`,
        data.results.sent < MIN_SENT_FOR_RESULTS &&
          `Only ${data.results.sent} sent application(s): treat results as a rough guide, not market feedback.`,
      ].filter(Boolean),
    });
  });
}

export function handleSaveGapReport(
  input: { baseId: string; summary: string; suggestions: unknown[] },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    await gaps.saveGapReport(userId, input, tokenName);
    return text(`Saved the gap report. The user reads it on the base version: ${appUrl(`/dashboard/resumes/${input.baseId}?tab=gaps`)}`);
  });
}
