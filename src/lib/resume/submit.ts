import path from "path";
import fs from "fs/promises";
import prisma from "@/lib/db";
import {
  applicationFolder,
  resolveDataPath,
  safeFileName,
  writeUniqueFile,
} from "@/lib/files/storage";
import { getResumeHeader } from "./bank";
import { getDocDetail, markDocSubmitted } from "./docs";
import { getLetter, markLetterSubmitted } from "./letters";
import { outgoingName } from "./naming";
import { renderCoverLetterPdf, renderResumePdf } from "./pdf";

// Submitting writes the exact PDF that was sent into the application's
// folder and freezes the record, so "what did Shopee see?" always has an
// answer, even after the bank or the base version moves on.

async function folderForJob(userId: string, jobId: string | null) {
  if (!jobId) return path.join("applications", "unlinked");
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      createdAt: true,
      appliedDate: true,
      description: true,
      jobUrl: true,
      Company: { select: { label: true } },
      JobTitle: { select: { label: true } },
    },
  });
  if (!job) throw new Error("Job not found");
  const folder = applicationFolder(job);
  await saveJobDescription(folder, job);
  return folder;
}

// Postings get taken down; a copy beside the resume keeps the context of
// what was tailored against. Written once and never overwritten.
async function saveJobDescription(
  folder: string,
  job: { description: string; jobUrl: string | null; Company: { label: string }; JobTitle: { label: string } },
) {
  const file = resolveDataPath(path.join(folder, "job-description.md"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = [
    `# ${job.JobTitle.label} at ${job.Company.label}`,
    job.jobUrl ? `\n${job.jobUrl}\n` : "",
    job.description.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim(),
    "",
  ].join("\n");
  await fs.writeFile(file, body, { flag: "wx" }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
}

export async function submitResume(userId: string, docId: string) {
  const doc = await getDocDetail(userId, docId);
  if (!doc) throw new Error("Resume not found");
  if (doc.kind !== "variant") throw new Error("Only a variant is submitted to a job");
  if (doc.status !== "approved") throw new Error("Approve the resume before submitting it");

  const folder = await folderForJob(userId, doc.jobId);
  const title = outgoingName(doc.rendered.header.fullName, "Resume");
  const pdf = await renderResumePdf(doc.rendered, title);
  const fileName = safeFileName(`${title}.pdf`, "Resume");
  const pdfPath = await writeUniqueFile(folder, fileName, pdf);
  return markDocSubmitted(userId, docId, doc.rendered, pdfPath);
}

export async function submitLetter(userId: string, letterId: string) {
  const letter = await getLetter(userId, letterId);
  if (!letter) throw new Error("Cover letter not found");
  if (letter.status !== "approved") throw new Error("Approve the letter before submitting it");

  const header = await getResumeHeader(userId);
  if (!header) throw new Error("Add your contact details in the Experience Bank first");
  const folder = await folderForJob(userId, letter.jobId);
  const title = outgoingName(header.fullName, "Cover Letter");
  const pdf = await renderCoverLetterPdf(header, letter.content, title);
  const fileName = safeFileName(`${title}.pdf`, "Cover Letter");
  const pdfPath = await writeUniqueFile(folder, fileName, pdf);
  return markLetterSubmitted(userId, letterId, pdfPath);
}
