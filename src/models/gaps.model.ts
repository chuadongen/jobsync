import { z } from "zod";

// What a job asks for, as Claude reads it while tailoring, and how well the
// experience bank backs each requirement up.

export const REQUIREMENT_KINDS = ["skill", "experience", "qualification", "trait"] as const;
export const REQUIREMENT_IMPORTANCE = ["required", "preferred"] as const;
export const COVERAGE_LEVELS = ["strong", "weak", "none"] as const;

export type Coverage = (typeof COVERAGE_LEVELS)[number];

export const COVERAGE_LABELS: Record<Coverage, string> = {
  strong: "Well covered",
  weak: "Weak",
  none: "Missing",
};

export const RequirementSchema = z.object({
  label: z.string().trim().min(1).max(80),
  kind: z.enum(REQUIREMENT_KINDS).default("skill"),
  importance: z.enum(REQUIREMENT_IMPORTANCE).default("required"),
  coverage: z.enum(COVERAGE_LEVELS),
  evidence: z.array(z.string()).max(10).default([]),
});

export type Requirement = z.infer<typeof RequirementSchema>;

export const GapSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(2000),
  evidence: z.string().trim().max(500).optional().nullable(),
});

export type GapSuggestion = z.infer<typeof GapSuggestionSchema>;

export interface CoverageRow {
  label: string;
  kind: string;
  // How many of this base's analysed jobs ask for it, and how many require it
  mentions: number;
  required: number;
  coverage: Coverage;
  evidence: { id: string; text: string }[];
  assessedAt: Date;
}

export type FurthestStage = "applied" | "assessment" | "interview" | "offer";

export interface BaseResults {
  sent: number;
  waiting: number;
  // Closed without getting past the resume screen
  screenedOut: number;
  reachedAssessment: number;
  reachedInterview: number;
  offers: number;
  // Among closed applications, the furthest stage each reached
  stoppedAt: Record<FurthestStage, number>;
}

export interface MissingNumber {
  entry: string;
  sourceId: string;
  text: string;
}

export interface BaseGaps {
  base: { id: string; name: string; targetRole: string | null };
  analysedJobs: number;
  coverage: CoverageRow[];
  results: BaseResults;
  missingNumbers: MissingNumber[];
  report: { summary: string; suggestions: GapSuggestion[]; updatedAt: Date; createdVia: string | null } | null;
}

// Below these, the numbers are shown but labelled as a rough guide.
export const MIN_JOBS_FOR_COVERAGE = 10;
export const MIN_SENT_FOR_RESULTS = 10;

const NUMBER_WORDS =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|dozen|half|double|doubled|triple|tripled|twice)\b/i;

// A bullet "has a number" if it states a quantity in digits or words.
export function hasNumber(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.test(text);
}

const ASSESSMENT = /assessment|hirevue|video interview|online test|\boa\b|aptitude|case test/i;

// The furthest a job got, from its stage labels and the status each maps to.
export function furthestStage(stages: { label: string; statusValue: string }[]): FurthestStage {
  let best: FurthestStage = "applied";
  const rank: Record<FurthestStage, number> = { applied: 0, assessment: 1, interview: 2, offer: 3 };
  for (const s of stages) {
    let stage: FurthestStage = "applied";
    if (s.statusValue.startsWith("offer")) stage = "offer";
    else if (ASSESSMENT.test(s.label)) stage = "assessment";
    else if (s.statusValue === "interview") stage = "interview";
    if (rank[stage] > rank[best]) best = stage;
  }
  return best;
}
