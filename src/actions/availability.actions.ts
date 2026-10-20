"use server";
import { revalidatePath } from "next/cache";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import * as availability from "@/lib/availability";
import type { AvailabilityForm } from "@/models/availability.model";

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
  if (result.success) revalidatePath("/dashboard/availability");
  return result;
}

export const getAvailabilityBlocks = async () =>
  read((userId) => availability.listBlocks(userId), "Failed to load availability.");

export const saveAvailabilityBlock = async (form: AvailabilityForm) =>
  run((userId) => availability.saveBlock(userId, form), "Failed to save the block.");

export const deleteAvailabilityBlock = async (id: string) =>
  run((userId) => availability.deleteBlock(userId, id), "Failed to delete the block.");

export const getJobClashes = async () =>
  read((userId) => availability.jobClashes(userId), "Failed to check clashes.");

export const getClashesForPeriod = async (start: Date, end: Date) =>
  read((userId) => availability.clashesFor(userId, start, end), "Failed to check clashes.");
