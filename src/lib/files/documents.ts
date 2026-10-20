import { z } from "zod";
import prisma from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { DOCUMENT_CATEGORY_VALUES } from "@/models/document.model";
import {
  applicationFolder,
  removeDataFile,
  safeFileName,
  vaultFolder,
  writeUniqueFile,
} from "./storage";

// Extension, not the browser's MIME claim, decides what is accepted: the
// claim is client-supplied and the extension is what the file is opened by.
const ALLOWED = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".md": "text/markdown",
} as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = Object.keys(ALLOWED);

function mimeFor(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const mime = ALLOWED[ext as keyof typeof ALLOWED];
  if (!mime) {
    throw new Error(
      `That file type is not accepted. Use one of: ${ALLOWED_DOCUMENT_EXTENSIONS.join(", ")}`,
    );
  }
  return mime;
}

export const DocumentMetaSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(DOCUMENT_CATEGORY_VALUES),
  notes: z.string().trim().max(2000).optional().nullable(),
  jobId: z.string().optional().nullable(),
});

export type DocumentMeta = z.input<typeof DocumentMetaSchema>;

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  category: true,
  fileName: true,
  filePath: true,
  mimeType: true,
  sizeBytes: true,
  notes: true,
  uploadedAt: true,
  jobId: true,
  job: {
    select: {
      id: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
    },
  },
};

async function jobForFolder(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      createdAt: true,
      appliedDate: true,
      Company: { select: { label: true } },
      JobTitle: { select: { label: true } },
    },
  });
  if (!job) throw new Error("Job not found");
  return job;
}

// A job-linked file lands in that application's folder; anything else goes
// to the vault under its category.
export async function createDocument(
  userId: string,
  input: DocumentMeta & { fileName: string; bytes: Uint8Array },
) {
  const meta = DocumentMetaSchema.parse(input);
  if (input.bytes.byteLength === 0) throw new Error("The file is empty");
  if (input.bytes.byteLength > APP_CONSTANTS.MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      `Files are limited to ${Math.round(APP_CONSTANTS.MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB`,
    );
  }
  const mimeType = mimeFor(input.fileName);
  const fileName = safeFileName(input.fileName);

  const folder = meta.jobId
    ? applicationFolder(await jobForFolder(userId, meta.jobId))
    : vaultFolder(meta.category);
  const filePath = await writeUniqueFile(folder, fileName, input.bytes);

  try {
    return await prisma.document.create({
      data: {
        userId,
        title: meta.title,
        category: meta.category,
        notes: meta.notes || null,
        jobId: meta.jobId || null,
        fileName,
        filePath,
        mimeType,
        sizeBytes: input.bytes.byteLength,
      },
      select: DOCUMENT_SELECT,
    });
  } catch (error) {
    await removeDataFile(filePath);
    throw error;
  }
}

export async function listDocuments(
  userId: string,
  filter: { category?: string; jobId?: string } = {},
) {
  return prisma.document.findMany({
    where: { userId, ...filter },
    select: DOCUMENT_SELECT,
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getDocument(userId: string, id: string) {
  return prisma.document.findFirst({ where: { id, userId }, select: DOCUMENT_SELECT });
}

// Metadata only: the file stays where it was written, so a path someone has
// bookmarked on the server keeps working.
export async function updateDocument(userId: string, id: string, input: DocumentMeta) {
  const meta = DocumentMetaSchema.parse(input);
  const existing = await getDocument(userId, id);
  if (!existing) throw new Error("Document not found");
  if (meta.jobId && meta.jobId !== existing.jobId) await jobForFolder(userId, meta.jobId);
  return prisma.document.update({
    where: { id },
    data: {
      title: meta.title,
      category: meta.category,
      notes: meta.notes || null,
      jobId: meta.jobId || null,
    },
    select: DOCUMENT_SELECT,
  });
}

export async function deleteDocument(userId: string, id: string) {
  const existing = await getDocument(userId, id);
  if (!existing) throw new Error("Document not found");
  await prisma.document.delete({ where: { id } });
  await removeDataFile(existing.filePath);
}
