"use server";
import { revalidatePath } from "next/cache";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import * as bank from "@/lib/resume/bank";
import type {
  BankBulletForm,
  BankEntryForm,
  ResumeHeaderForm,
} from "@/models/bank.model";

// Thin session-scoped wrappers over lib/resume/bank, which the MCP tools
// share. Every action returns { success, data } or { success: false, message }.

async function run<T>(fn: (userId: string) => Promise<T>, msg: string) {
  try {
    const user = await requireUser();
    const data = await fn(user.id);
    revalidatePath("/dashboard/bank");
    return { success: true as const, data };
  } catch (error) {
    return handleError(error, msg) as { success: false; message: string };
  }
}

export const getBankEntries = async (includeArchived = false) =>
  run((userId) => bank.listBankEntries(userId, { includeArchived }), "Failed to load the experience bank.");

export const createBankEntry = async (form: BankEntryForm) =>
  run((userId) => bank.createBankEntry(userId, form), "Failed to add the entry.");

export const updateBankEntry = async (form: BankEntryForm) =>
  run((userId) => bank.updateBankEntry(userId, form), "Failed to update the entry.");

export const setBankEntryArchived = async (entryId: string, archived: boolean) =>
  run(
    (userId) => bank.setBankEntryArchived(userId, entryId, archived),
    "Failed to update the entry.",
  );

export const getBankEntryUsage = async (entryId: string) =>
  run((userId) => bank.countEntryUsage(userId, entryId), "Failed to check the entry.");

export const deleteBankEntry = async (entryId: string) =>
  run((userId) => bank.deleteBankEntry(userId, entryId), "Failed to delete the entry.");

export const reorderBankEntries = async (orderedIds: string[]) =>
  run((userId) => bank.reorderBankEntries(userId, orderedIds), "Failed to reorder entries.");

export const createBankBullet = async (form: BankBulletForm) =>
  run((userId) => bank.createBankBullet(userId, form), "Failed to add the bullet.");

export const updateBankBullet = async (form: BankBulletForm) =>
  run((userId) => bank.updateBankBullet(userId, form), "Failed to update the bullet.");

export const setBankBulletArchived = async (bulletId: string, archived: boolean) =>
  run(
    (userId) => bank.setBankBulletArchived(userId, bulletId, archived),
    "Failed to update the bullet.",
  );

export const deleteBankBullet = async (bulletId: string) =>
  run((userId) => bank.deleteBankBullet(userId, bulletId), "Failed to delete the bullet.");

export const reorderBankBullets = async (entryId: string, orderedIds: string[]) =>
  run(
    (userId) => bank.reorderBankBullets(userId, entryId, orderedIds),
    "Failed to reorder bullets.",
  );

export const getBankSuggestions = async () =>
  run((userId) => bank.listBankSuggestions(userId), "Failed to load suggestions.");

export const acceptBankSuggestion = async (id: string, editedPayload?: unknown) =>
  run(
    (userId) => bank.acceptBankSuggestion(userId, id, editedPayload),
    "Failed to accept the suggestion.",
  );

export const rejectBankSuggestion = async (id: string) =>
  run((userId) => bank.rejectBankSuggestion(userId, id), "Failed to reject the suggestion.");

export const getResumeHeader = async () =>
  run((userId) => bank.getResumeHeader(userId), "Failed to load your contact details.");

export const saveResumeHeader = async (form: ResumeHeaderForm) =>
  run((userId) => bank.saveResumeHeader(userId, form), "Failed to save your contact details.");
