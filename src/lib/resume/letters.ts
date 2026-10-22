import { z } from "zod";
import prisma from "@/lib/db";
import type { CoverLetterDetail } from "@/models/resume.model";

// Same lifecycle as a resume: draft -> approved -> submitted, edits to an
// approved letter send it back to draft, and a submitted one is frozen.

const LETTER_SELECT = {
  id: true,
  title: true,
  content: true,
  status: true,
  jobId: true,
  approvedAt: true,
  submittedAt: true,
  pdfPath: true,
  createdVia: true,
  updatedAt: true,
  job: {
    select: {
      id: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
    },
  },
};

export const LetterSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(20, { message: "The letter is too short." }).max(20_000),
  jobId: z.string().optional().nullable(),
});

export type LetterInput = z.input<typeof LetterSchema>;

async function requireLetter(userId: string, id: string) {
  const letter = await prisma.coverLetter.findFirst({
    where: { id, userId },
    select: LETTER_SELECT,
  });
  if (!letter) throw new Error("Cover letter not found");
  return letter;
}

async function assertJobOwned(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, userId }, select: { id: true } });
  if (!job) throw new Error("Job not found");
}

export async function listLetters(userId: string, filter: { jobId?: string } = {}) {
  return prisma.coverLetter.findMany({
    where: { userId, ...filter },
    select: LETTER_SELECT,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getLetter(userId: string, id: string) {
  return (await prisma.coverLetter.findFirst({
    where: { id, userId },
    select: LETTER_SELECT,
  })) as CoverLetterDetail | null;
}

export async function createLetter(
  userId: string,
  input: LetterInput,
  opts: { createdVia?: string | null } = {},
) {
  const data = LetterSchema.parse(input);
  if (data.jobId) await assertJobOwned(userId, data.jobId);
  return prisma.coverLetter.create({
    data: { ...data, jobId: data.jobId || null, userId, createdVia: opts.createdVia ?? null },
    select: LETTER_SELECT,
  });
}

export async function updateLetter(userId: string, id: string, input: LetterInput) {
  const data = LetterSchema.parse(input);
  const letter = await requireLetter(userId, id);
  if (letter.status === "submitted") {
    throw new Error("This letter was submitted and is frozen.");
  }
  if (data.jobId && data.jobId !== letter.jobId) await assertJobOwned(userId, data.jobId);
  return prisma.coverLetter.update({
    where: { id },
    data: { ...data, jobId: data.jobId || null, status: "draft", approvedAt: null },
    select: LETTER_SELECT,
  });
}

export async function approveLetter(userId: string, id: string) {
  const letter = await requireLetter(userId, id);
  if (letter.status !== "draft") throw new Error("Only a draft can be approved");
  return prisma.coverLetter.update({
    where: { id },
    data: { status: "approved", approvedAt: new Date() },
    select: LETTER_SELECT,
  });
}

export async function revokeLetterApproval(userId: string, id: string) {
  const letter = await requireLetter(userId, id);
  if (letter.status !== "approved") throw new Error("This letter is not approved");
  return prisma.coverLetter.update({
    where: { id },
    data: { status: "draft", approvedAt: null },
    select: LETTER_SELECT,
  });
}

export async function markLetterSubmitted(userId: string, id: string, pdfPath: string | null) {
  const letter = await requireLetter(userId, id);
  if (letter.status !== "approved") throw new Error("Approve the letter before submitting it");
  return prisma.coverLetter.update({
    where: { id },
    data: { status: "submitted", submittedAt: new Date(), pdfPath },
    select: LETTER_SELECT,
  });
}

export async function deleteLetter(userId: string, id: string) {
  const letter = await requireLetter(userId, id);
  await prisma.coverLetter.delete({ where: { id } });
  return { pdfPath: letter.pdfPath };
}
