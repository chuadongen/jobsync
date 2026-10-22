"use server";
import { revalidatePath } from "next/cache";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import * as seasons from "@/lib/seasons";
import type { TargetForm, WindowForm } from "@/models/seasons.model";

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
  if (result.success) {
    revalidatePath("/dashboard/seasons");
    revalidatePath("/dashboard/myjobs");
    revalidatePath("/dashboard");
  }
  return result;
}

export const getTargets = async (includeArchived = false) =>
  read((userId) => seasons.listTargets(userId, { includeArchived }), "Failed to load targets.");

export const saveTarget = async (form: TargetForm) =>
  run((userId) => seasons.saveTarget(userId, form), "Failed to save the target.");

export const setTargetArchived = async (id: string, archived: boolean) =>
  run((userId) => seasons.setTargetArchived(userId, id, archived), "Failed to update the target.");

export const deleteTarget = async (id: string) =>
  run((userId) => seasons.deleteTarget(userId, id), "Failed to delete the target.");

export const saveWindow = async (targetId: string, form: WindowForm) =>
  run((userId) => seasons.saveWindow(userId, targetId, form), "Failed to save the window.");

export const confirmWindow = async (id: string) =>
  run((userId) => seasons.confirmWindow(userId, id), "Failed to confirm the window.");

export const deleteWindow = async (id: string) =>
  run((userId) => seasons.deleteWindow(userId, id), "Failed to delete the window.");

export const rolloverWindow = async (id: string) =>
  run((userId) => seasons.rolloverWindow(userId, id), "Failed to estimate next year's window.");

export const rolloverAll = async () =>
  run((userId) => seasons.rolloverAll(userId), "Failed to estimate next year's windows.");

export const getRollableCount = async () =>
  read(async (userId) => (await seasons.rollableWindows(userId)).length, "Failed to check windows.");
