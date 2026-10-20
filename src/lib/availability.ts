import prisma from "@/lib/db";
import {
  AvailabilityFormSchema,
  overlapDays,
  type AvailabilityForm,
  type AvailabilityKind,
} from "@/models/availability.model";

export async function listBlocks(userId: string) {
  return prisma.availabilityBlock.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
  });
}

export async function saveBlock(userId: string, input: AvailabilityForm) {
  const form = AvailabilityFormSchema.parse(input);
  const data = {
    title: form.title,
    kind: form.kind,
    startDate: form.startDate,
    endDate: form.endDate,
    notes: form.notes || null,
  };
  if (form.id) {
    const owned = await prisma.availabilityBlock.findFirst({
      where: { id: form.id, userId },
      select: { id: true },
    });
    if (!owned) throw new Error("Block not found");
    return prisma.availabilityBlock.update({ where: { id: form.id }, data });
  }
  return prisma.availabilityBlock.create({ data: { ...data, userId } });
}

export async function deleteBlock(userId: string, id: string) {
  const owned = await prisma.availabilityBlock.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Block not found");
  await prisma.availabilityBlock.delete({ where: { id } });
}

export interface Clash {
  blockId: string;
  title: string;
  kind: AvailabilityKind;
  startDate: Date;
  endDate: Date;
  days: number;
}

export async function clashesFor(
  userId: string,
  start: Date,
  end: Date,
): Promise<Clash[]> {
  const blocks = await prisma.availabilityBlock.findMany({
    where: { userId, startDate: { lte: end }, endDate: { gte: start } },
    orderBy: { startDate: "asc" },
  });
  return blocks.map((b) => ({
    blockId: b.id,
    title: b.title,
    kind: b.kind as AvailabilityKind,
    startDate: b.startDate,
    endDate: b.endDate,
    days: overlapDays(start, end, b.startDate, b.endDate),
  }));
}

export const CLOSED_STATUSES = ["rejected", "withdrawn", "archived", "expired", "offer-declined"];

// Open applications with a known role period, for the availability timeline.
export async function rolePeriods(userId: string) {
  return prisma.job.findMany({
    where: {
      userId,
      startDate: { not: null },
      endDate: { not: null },
      Status: { value: { notIn: CLOSED_STATUSES } },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      Status: { select: { label: true, value: true } },
    },
    orderBy: { startDate: "asc" },
  });
}

// Every job with a role period that runs into a block, for the dashboard
// and the availability page. Closed applications are left out.
export async function jobClashes(userId: string) {
  const [jobs, blocks] = await Promise.all([rolePeriods(userId), listBlocks(userId)]);
  return jobs
    .map((job) => ({
      job,
      clashes: blocks
        .filter((b) => b.startDate <= job.endDate! && job.startDate! <= b.endDate)
        .map((b) => ({
          blockId: b.id,
          title: b.title,
          kind: b.kind as AvailabilityKind,
          startDate: b.startDate,
          endDate: b.endDate,
          days: overlapDays(job.startDate!, job.endDate!, b.startDate, b.endDate),
        })),
    }))
    .filter((row) => row.clashes.length > 0);
}
