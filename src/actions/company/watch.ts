"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import type { Company } from "@/models/job.model";
import { requireUser } from "../shared";

// Toggles watch intent only; removing the row entirely is deleteCompanyById.
export const setCompanyWatched = async (
  companyId: string,
  watched: boolean,
): Promise<{ success: boolean; message?: string; data?: Company }> => {
  try {
    const user = await requireUser();

    const res = await prisma.company.update({
      where: { id: companyId, createdBy: user.id },
      data: { watched, watchedAt: watched ? new Date() : null },
    });
    return { success: true, data: res as unknown as Company };
  } catch (error) {
    const msg = "Failed to update watch status.";
    return handleError(error, msg);
  }
};
