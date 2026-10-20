"use server";
import { revalidatePath } from "next/cache";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import * as documents from "@/lib/files/documents";

// Uploads go through POST /api/documents (server actions are a poor fit for
// file bodies); everything else about a document is handled here.

async function run<T>(fn: (userId: string) => Promise<T>, msg: string) {
  try {
    const user = await requireUser();
    const data = await fn(user.id);
    revalidatePath("/dashboard/documents");
    return { success: true as const, data };
  } catch (error) {
    return handleError(error, msg) as { success: false; message: string };
  }
}

export const getDocuments = async (filter: { category?: string; jobId?: string } = {}) =>
  run((userId) => documents.listDocuments(userId, filter), "Failed to load documents.");

export const updateDocument = async (id: string, meta: documents.DocumentMeta) =>
  run((userId) => documents.updateDocument(userId, id, meta), "Failed to update the document.");

export const deleteDocument = async (id: string) =>
  run((userId) => documents.deleteDocument(userId, id), "Failed to delete the document.");
