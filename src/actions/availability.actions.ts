"use server";
import { revalidatePath } from "next/cache";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import * as availability from "@/lib/availability";
import type { AvailabilityForm } from "@/models/availability.model";

async function run<T>(fn: (userId: string) => Promise<T>, msg: string) {
  try {
    const user = await requireUser();
    const data = await fn(user.id);
    revalidatePath("/dashboard/availability");
    return { success: true as const, data };
  } catch (error) {
    return handleError(error, msg) as { success: false; message: string };
  }
}

export const getAvailabilityBlocks = async () =>
  run((userId) => availability.listBlocks(userId), "Failed to load availability.");

export const saveAvailabilityBlock = async (form: AvailabilityForm) =>
  run((userId) => availability.saveBlock(userId, form), "Failed to save the block.");

export const deleteAvailabilityBlock = async (id: string) =>
  run((userId) => availability.deleteBlock(userId, id), "Failed to delete the block.");

export const getJobClashes = async () =>
  run((userId) => availability.jobClashes(userId), "Failed to check clashes.");

export const getClashesForPeriod = async (start: Date, end: Date) =>
  run((userId) => availability.clashesFor(userId, start, end), "Failed to check clashes.");
