import { z } from "zod";

// "absolute" is a commitment (an exchange semester you are going on);
// "potential" is something that may happen (an exchange you applied for, a
// trip not yet booked). Clashes with either are shown, with different weight.
export const AVAILABILITY_KINDS = {
  absolute: "Confirmed",
  potential: "Tentative",
} as const;

export type AvailabilityKind = keyof typeof AVAILABILITY_KINDS;

export const AvailabilityFormSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, { message: "Give the block a name." }).max(120),
    kind: z.enum(["absolute", "potential"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

export type AvailabilityForm = z.input<typeof AvailabilityFormSchema>;

export interface AvailabilityBlock {
  id: string;
  title: string;
  kind: AvailabilityKind;
  startDate: Date;
  endDate: Date;
  notes: string | null;
}

// Inclusive at both ends: a block ending on the day a role starts clashes.
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}
