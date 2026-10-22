import { z } from "zod";
import type { ResumeSectionKey } from "./resume.model";

// Each entry type prints under exactly one resume section.
export const BANK_ENTRY_TYPES = {
  education: { label: "Education", section: "education" },
  experience: { label: "Experience", section: "experience" },
  project: { label: "Project", section: "projects" },
  leadership: { label: "Leadership & Activities", section: "leadership" },
  award: { label: "Award / Competition", section: "awards" },
  certification: { label: "Certification", section: "certifications" },
  skill: { label: "Skills Line", section: "skills" },
} as const satisfies Record<string, { label: string; section: ResumeSectionKey }>;

export type BankEntryType = keyof typeof BANK_ENTRY_TYPES;

export const BANK_ENTRY_TYPE_VALUES = Object.keys(BANK_ENTRY_TYPES) as [
  BankEntryType,
  ...BankEntryType[],
];

export function sectionForEntryType(type: string): ResumeSectionKey | null {
  return BANK_ENTRY_TYPES[type as BankEntryType]?.section ?? null;
}

export function entryTypeLabel(type: string): string {
  return BANK_ENTRY_TYPES[type as BankEntryType]?.label ?? type;
}

export interface BankBullet {
  id: string;
  entryId: string;
  text: string;
  tags: string;
  sortOrder: number;
  archived: boolean;
}

export interface BankEntry {
  id: string;
  type: BankEntryType;
  organisation: string;
  title: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  url: string | null;
  details: string | null;
  notes: string | null;
  tags: string;
  sortOrder: number;
  archived: boolean;
  bullets: BankBullet[];
  createdAt: Date;
  updatedAt: Date;
}

// Tags are stored comma-separated; this is the one place that splits them.
export function splitTags(tags: string | null | undefined): string[] {
  return (tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function joinTags(tags: string[] | string | null | undefined): string {
  const list = Array.isArray(tags) ? tags : splitTags(tags);
  return [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))].join(
    ",",
  );
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const BankEntryFormSchema = z.object({
  id: z.string().optional(),
  type: z.enum(BANK_ENTRY_TYPE_VALUES),
  organisation: z
    .string()
    .trim()
    .min(1, { message: "A name is required." })
    .max(200),
  title: optionalText(200),
  location: optionalText(100),
  // Free text as printed, e.g. "Aug 2025" or "Present"
  startDate: optionalText(40),
  endDate: optionalText(40),
  url: optionalText(500),
  details: optionalText(2000),
  notes: optionalText(5000),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

export type BankEntryForm = z.input<typeof BankEntryFormSchema>;

export const BankBulletFormSchema = z.object({
  id: z.string().optional(),
  entryId: z.string().min(1),
  text: z
    .string()
    .trim()
    .min(3, { message: "A bullet needs some text." })
    .max(600),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

export type BankBulletForm = z.input<typeof BankBulletFormSchema>;

// What Claude may propose. A bullet lands on an existing entry; an entry
// arrives whole with its bullets. Neither touches the bank until accepted.
export const BankSuggestionPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bullet"),
    text: BankBulletFormSchema.shape.text,
    tags: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal("entry"),
    entry: BankEntryFormSchema.omit({ id: true }),
    bullets: z
      .array(
        z.object({
          text: BankBulletFormSchema.shape.text,
          tags: z.array(z.string()).optional(),
        }),
      )
      .max(15)
      .default([]),
  }),
]);

export type BankSuggestionPayload = z.infer<typeof BankSuggestionPayloadSchema>;

export interface BankSuggestion {
  id: string;
  entryId: string | null;
  entry?: { id: string; organisation: string; title: string | null } | null;
  payload: BankSuggestionPayload;
  rationale: string | null;
  status: "pending" | "accepted" | "rejected";
  createdVia: string | null;
  createdAt: Date;
}

export const ResumeHeaderFormSchema = z.object({
  fullName: z.string().trim().min(1, { message: "Your name is required." }).max(120),
  location: optionalText(100),
  email: optionalText(200),
  phone: optionalText(40),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        url: z.string().trim().min(1).max(300),
      }),
    )
    .max(4)
    .default([]),
});

export type ResumeHeaderForm = z.input<typeof ResumeHeaderFormSchema>;
