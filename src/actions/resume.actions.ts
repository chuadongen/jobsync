"use server";
import { revalidatePath } from "next/cache";
import { handleError } from "@/lib/utils";
import prisma from "@/lib/db";
import { requireUser } from "./shared";
import * as gaps from "@/lib/resume/gaps";
import * as docs from "@/lib/resume/docs";
import * as letters from "@/lib/resume/letters";
import { submitLetter, submitResume } from "@/lib/resume/submit";
import type { ResumeSectionKey } from "@/models/resume.model";

// Session-scoped wrappers over lib/resume. Approval and submission live only
// here, never in the MCP tools: those steps are the user's to take.

// Reads must not revalidate: Next forbids it while a page is rendering.
async function read<T>(fn: (userId: string) => Promise<T>, msg: string) {
  try {
    const user = await requireUser();
    return { success: true as const, data: await fn(user.id) };
  } catch (error) {
    return handleError(error, msg) as { success: false; message: string };
  }
}

async function run<T>(fn: (userId: string) => Promise<T>, msg: string) {
  const result = await read(fn, msg);
  if (result.success) revalidatePath("/dashboard/resumes");
  return result;
}

export const getBaseGaps = async (baseId: string) =>
  read((userId) => gaps.getBaseGaps(userId, baseId), "Failed to load the gaps.");

export const getResumeDocs = async (filter: { kind?: "base" | "variant"; jobId?: string } = {}) =>
  read((userId) => docs.listDocs(userId, filter), "Failed to load resumes.");

export const getResumeDoc = async (docId: string) =>
  read(async (userId) => {
    const doc = await docs.getDocDetail(userId, docId);
    if (!doc) throw new Error("Resume not found");
    return doc;
  }, "Failed to load the resume.");

export const createResumeBase = async (input: {
  name: string;
  targetRole?: string | null;
  sectionOrder?: ResumeSectionKey[];
}) => run((userId) => docs.createBase(userId, input), "Failed to create the base version.");

export const createResumeVariant = async (input: {
  baseId: string;
  jobId?: string | null;
  name?: string | null;
}) => run((userId) => docs.createVariant(userId, input), "Failed to create the variant.");

export const saveResumeContent = async (docId: string, content: docs.DocContent) =>
  run((userId) => docs.saveDocContent(userId, docId, content), "Failed to save the resume.");

export const updateResumeMeta = async (docId: string, meta: docs.DocMeta) =>
  run((userId) => docs.updateDocMeta(userId, docId, meta), "Failed to update the resume.");

export const duplicateResume = async (docId: string) =>
  run((userId) => docs.duplicateDoc(userId, docId), "Failed to duplicate the resume.");

export const approveResume = async (docId: string) =>
  run((userId) => docs.approveDoc(userId, docId), "Failed to approve the resume.");

export const revokeResumeApproval = async (docId: string) =>
  run((userId) => docs.revokeApproval(userId, docId), "Failed to reopen the resume.");

export const markResumeSubmitted = async (docId: string) =>
  run((userId) => submitResume(userId, docId), "Failed to submit the resume.");

// A submitted PDF stays in its application folder after the record goes: it
// is the copy of what was sent, and the folder is the user's to tidy.
export const deleteResume = async (docId: string) =>
  run(async (userId) => {
    await docs.deleteDoc(userId, docId);
  }, "Failed to delete the resume.");

export const getCoverLetters = async (filter: { jobId?: string } = {}) =>
  read((userId) => letters.listLetters(userId, filter), "Failed to load cover letters.");

export const getCoverLetter = async (id: string) =>
  read(async (userId) => {
    const letter = await letters.getLetter(userId, id);
    if (!letter) throw new Error("Cover letter not found");
    return letter;
  }, "Failed to load the cover letter.");

export const createCoverLetter = async (input: letters.LetterInput) =>
  run((userId) => letters.createLetter(userId, input), "Failed to create the cover letter.");

export const updateCoverLetter = async (id: string, input: letters.LetterInput) =>
  run((userId) => letters.updateLetter(userId, id, input), "Failed to save the cover letter.");

export const approveCoverLetter = async (id: string) =>
  run((userId) => letters.approveLetter(userId, id), "Failed to approve the cover letter.");

export const revokeCoverLetterApproval = async (id: string) =>
  run((userId) => letters.revokeLetterApproval(userId, id), "Failed to reopen the cover letter.");

export const markCoverLetterSubmitted = async (id: string) =>
  run((userId) => submitLetter(userId, id), "Failed to submit the cover letter.");

export const deleteCoverLetter = async (id: string) =>
  run(async (userId) => {
    await letters.deleteLetter(userId, id);
  }, "Failed to delete the cover letter.");

// For the job pickers on resumes, letters and documents: newest first, with
// a label that tells two roles at one company apart.
export const getJobPickerOptions = async () =>
  read(async (userId) => {
    const jobs = await prisma.job.findMany({
      where: { userId },
      select: {
        id: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Status: { select: { label: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return jobs.map((j) => ({
      id: j.id,
      label: `${j.Company.label} · ${j.JobTitle.label}`,
      status: j.Status.label,
    }));
  }, "Failed to load jobs.");
