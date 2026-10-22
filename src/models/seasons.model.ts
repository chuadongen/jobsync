import { z } from "zod";

// A target is a company or kind of role the user means to apply to; its
// windows say when applications for each intake open and close.

export const WINDOW_STATUSES = {
  suggested: "Suggested",
  confirmed: "Confirmed",
} as const;

export type WindowStatus = keyof typeof WINDOW_STATUSES;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalDate = z.coerce.date().optional().nullable();

export const TargetFormSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, { message: "Give the target a name." }).max(120),
    company: optionalText(120),
    keyword: optionalText(80),
    notes: optionalText(2000),
  })
  .refine((v) => v.company || v.keyword, {
    message: "Add a company, a title keyword, or both, so jobs can be matched to it.",
    path: ["company"],
  });

export type TargetForm = z.input<typeof TargetFormSchema>;

export const WindowFormSchema = z
  .object({
    id: z.string().optional(),
    intake: z.string().trim().min(1, { message: "Name the intake, e.g. Summer 2027." }).max(60),
    opensAt: z.coerce.date(),
    closesAt: optionalDate,
    roleStart: optionalDate,
    roleEnd: optionalDate,
    estimated: z.boolean().optional().default(false),
    source: optionalText(500),
  })
  .refine((v) => !v.closesAt || v.closesAt >= v.opensAt, {
    message: "Applications cannot close before they open.",
    path: ["closesAt"],
  })
  .refine((v) => !v.roleStart || !v.roleEnd || v.roleEnd >= v.roleStart, {
    message: "The role cannot end before it starts.",
    path: ["roleEnd"],
  });

export type WindowForm = z.input<typeof WindowFormSchema>;

export interface SeasonWindow {
  id: string;
  intake: string;
  opensAt: Date;
  closesAt: Date | null;
  roleStart: Date | null;
  roleEnd: Date | null;
  estimated: boolean;
  status: WindowStatus;
  source: string | null;
  checkedAt: Date;
  createdVia: string | null;
}

export interface SeasonJob {
  id: string;
  title: string;
  company: string;
  status: string;
  statusValue: string;
  createdAt: Date;
  appliedDate: Date | null;
}

export interface SeasonTarget {
  id: string;
  name: string;
  company: string | null;
  keyword: string | null;
  notes: string | null;
  archived: boolean;
  windows: SeasonWindow[];
  jobs: SeasonJob[];
  // The earliest a matching job was saved, per calendar year: when the
  // window was seen open in practice, which beats any estimate.
  observed: { year: number; firstSeen: Date }[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Company names drift ("Shopee" vs "Shopee Singapore"), so either containing
// the other counts. A keyword narrows to titles that mention it.
export function jobMatchesTarget(
  target: { company: string | null; keyword: string | null },
  job: { company: string; title: string },
): boolean {
  if (!target.company && !target.keyword) return false;
  if (target.company) {
    const a = norm(target.company);
    const b = norm(job.company);
    if (!a || !b || !(a.includes(b) || b.includes(a))) return false;
  }
  if (target.keyword && !norm(job.title).includes(norm(target.keyword))) return false;
  return true;
}

export type WindowPhase = "upcoming" | "soon" | "open" | "closing" | "closed";

// Where a window stands on a given day. "soon" is within four weeks of
// opening; "closing" is the last two weeks before a known close.
export function windowPhase(
  w: { opensAt: Date; closesAt: Date | null },
  now: Date,
): WindowPhase {
  const day = 86_400_000;
  const opens = new Date(w.opensAt).getTime();
  const closes = w.closesAt ? new Date(w.closesAt).getTime() : null;
  const t = now.getTime();
  if (t < opens) return opens - t <= 28 * day ? "soon" : "upcoming";
  if (closes !== null && t > closes + day - 1) return "closed";
  if (closes !== null && closes - t <= 14 * day) return "closing";
  return "open";
}

export const WINDOW_PHASE_LABELS: Record<WindowPhase, string> = {
  upcoming: "Upcoming",
  soon: "Opens soon",
  open: "Open",
  closing: "Closing soon",
  closed: "Closed",
};

// "Summer 2027" becomes "Summer 2028", "AY2026/27 internship" becomes
// "AY2027/28 internship". An intake with no year gets "(next year)".
export function nextIntakeName(intake: string): string {
  let changed = false;
  const bumped = intake
    .replace(/(?<!\d)(20\d{2})\/(\d{2})(?!\d)/g, (_, a: string, b: string) => {
      changed = true;
      return `${Number(a) + 1}/${String((Number(b) + 1) % 100).padStart(2, "0")}`;
    })
    .replace(/(?<![\d/])(20\d{2})(?![\d/])/g, (y: string) => {
      changed = true;
      return String(Number(y) + 1);
    });
  return changed ? bumped : `${intake} (next year)`;
}
