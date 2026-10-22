import { z } from "zod";
import { COVERAGE_LEVELS, REQUIREMENT_IMPORTANCE, REQUIREMENT_KINDS } from "./gaps.model";

// Input shapes for the planning tools: application seasons, base resume gaps
// and interview stage prep. As with the resume tools, the .describe() text is
// what Claude reads, so it carries the rules.

const isoDate = (what: string) =>
  z.string().describe(`${what}, as YYYY-MM-DD.`);

export const McpListTargetsInputShape = {
  includeArchived: z.boolean().optional().describe("Include targets the user archived. Default false."),
};

export const McpSaveTargetWindowsInputShape = {
  target: z
    .object({
      id: z.string().optional().describe("Existing target id from list_targets. Omit to find or create by name."),
      name: z.string().optional().describe('Display name for a new target, e.g. "GovTech SWE intern" or "Consulting summer analyst".'),
      company: z.string().optional().describe("Company name saved jobs are matched on. Omit for a role-type target."),
      keyword: z.string().optional().describe('Word that must appear in a job title, e.g. "Product" or "Software". Optional.'),
    })
    .describe("Which target the windows belong to."),
  windows: z
    .array(
      z.object({
        intake: z.string().describe('The intake this window is for, e.g. "Summer 2027" or "Off-cycle Jan 2027".'),
        opensAt: isoDate("When applications open"),
        closesAt: isoDate("When applications close").optional(),
        roleStart: isoDate("When the role itself starts").optional(),
        roleEnd: isoDate("When the role ends").optional(),
        estimated: z
          .boolean()
          .optional()
          .describe("True when the dates are inferred from previous years rather than announced for this intake."),
        source: z.string().describe("Where this came from: a URL, or a short note on what it is based on. Required."),
      }),
    )
    .min(1)
    .describe("One entry per intake. Each is saved as a suggestion the user confirms in JobSync."),
};

export const McpGetJobStagesInputShape = {
  jobId: z.string().describe("Job id from search_jobs or get_job."),
};

export const McpAddStageInputShape = {
  jobId: z.string().describe("Job id."),
  stage: z.string().describe('Stage type label, e.g. "Online Assessment", "1st Screening Interview", "Offer". get_job_stages lists the valid labels.'),
  date: z.string().optional().describe("When the round happens or happened, as YYYY-MM-DD or a full ISO date-time."),
  setAsCurrent: z.boolean().optional().describe("Make this the job's current stage, which moves the job's status. Default true."),
};

export const McpSaveStageNotesInputShape = {
  stageId: z.string().describe("Stage id from get_job_stages or add_stage."),
  prepNotes: z
    .string()
    .optional()
    .describe("Preparation for this round in Markdown: likely questions, what to research, stories from the bank to use. Replaces any earlier prep notes."),
  debrief: z
    .string()
    .optional()
    .describe("What actually happened, as the user told you, and how it compared with the prep: what came up, what was missed, what to do differently. Replaces any earlier debrief."),
};

export const McpSaveJobRequirementsInputShape = {
  jobId: z.string().describe("Job id."),
  baseId: z
    .string()
    .optional()
    .describe("The base version this kind of role maps to (from list_resumes). Usually the base you tailored from."),
  requirements: z
    .array(
      z.object({
        label: z
          .string()
          .describe("Short, reusable label: \"SQL\", \"Stakeholder management\", \"Python\". Reuse labels from requirementLabelsInUse in get_job where they fit."),
        kind: z.enum(REQUIREMENT_KINDS).optional().describe("Default skill."),
        importance: z.enum(REQUIREMENT_IMPORTANCE).optional().describe("Whether the posting requires it or only prefers it. Default required."),
        coverage: z
          .enum(COVERAGE_LEVELS)
          .describe("How well the experience bank backs this up: strong (clear, specific bullets), weak (only implied or thin), none."),
        evidence: z.array(z.string()).optional().describe("Bank bullet ids that support it. Empty when coverage is none."),
      }),
    )
    .min(1)
    .describe("The posting's real requirements, typically 6 to 15. Leave out boilerplate."),
};

export const McpGetBaseGapsInputShape = {
  baseId: z.string().describe("Base version id from list_resumes."),
};

export const McpSaveGapReportInputShape = {
  baseId: z.string().describe("Base version id."),
  summary: z.string().describe("Two to four sentences: the biggest gaps for this kind of role and the single most useful next step."),
  suggestions: z
    .array(
      z.object({
        title: z.string().describe("Short action, e.g. \"Add a measured result to the HDB internship\"."),
        detail: z.string().describe("What to do and why, specific to the user's bank."),
        evidence: z.string().optional().describe("What backs it: e.g. \"SQL asked for in 8 of 11 BA postings; one weak bullet\"."),
      }),
    )
    .max(8)
    .describe("Three to six suggestions, most valuable first. Each must follow from the gap data, not general advice."),
};
