"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { TaskGroupBy, TaskStatus } from "@/models/task.model";
import { APP_CONSTANTS } from "@/lib/constants";
import { requireUser } from "../shared";

function getTasksOrderBy(groupBy?: TaskGroupBy) {
  switch (groupBy) {
    case "dueDate":
      return [
        { dueDate: "asc" as const },
        { priority: "desc" as const },
        { createdAt: "desc" as const },
      ];
    case "createdDate":
      return [{ createdAt: "desc" as const }, { priority: "desc" as const }];
    case "updatedDate":
      return [
        { updatedAt: "desc" as const },
        { priority: "desc" as const },
        { createdAt: "desc" as const },
      ];
    default:
      return [
        { priority: "desc" as const },
        { createdAt: "desc" as const },
        { updatedAt: "desc" as const },
      ];
  }
}

export const getTasksList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  statusFilter?: TaskStatus[],
  search?: string,
  groupBy?: TaskGroupBy
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const offset = (page - 1) * limit;

    const whereClause: any = {
      userId: user.id,
    };

    if (statusFilter && statusFilter.length > 0) {
      whereClause.status = { in: statusFilter };
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where: whereClause,
        orderBy: getTasksOrderBy(groupBy),
        skip: offset,
        take: limit,
      }),
      prisma.task.count({
        where: whereClause,
      }),
    ]);

    return {
      success: true,
      data,
      total,
    };
  } catch (error) {
    const msg = "Failed to fetch tasks list.";
    return handleError(error, msg);
  }
};

export const getTaskById = async (
  taskId: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
    });

    if (!task) {
      return { success: false, message: "Task not found" };
    }

    return {
      success: true,
      data: task,
    };
  } catch (error) {
    const msg = "Failed to fetch task.";
    return handleError(error, msg);
  }
};
