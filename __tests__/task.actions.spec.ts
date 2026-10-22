import {
  getTasksList,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTaskById,
} from "@/actions/task.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(function() { return mPrismaClient; }) };
});

vi.mock("@/utils/user.utils", () => ({
  getCurrentUser: vi.fn(),
}));

describe("taskActions", () => {
  const mockUser = { id: "user-id" };
  const mockTask = {
    id: "task-id",
    userId: mockUser.id,
    title: "Test Task",
    description: "Test task description",
    status: "in-progress" as const,
    priority: 5,
    percentComplete: 50,
    dueDate: new Date("2099-12-31"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTasksList", () => {
    it("returns the user's tasks ordered by priority by default", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findMany as any).mockResolvedValue([mockTask]);
      (prisma.task.count as any).mockResolvedValue(1);

      const result = await getTasksList();

      expect(result).toEqual({ success: true, data: [mockTask], total: 1 });
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
          { updatedAt: "desc" },
        ],
        skip: 0,
        take: 25,
      });
    });

    it("pages with skip and take", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.task.count as any).mockResolvedValue(0);

      await getTasksList(3, 10);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("filters by status and searches title and description", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.task.count as any).mockResolvedValue(0);

      await getTasksList(1, 25, ["in-progress", "needs-attention"], "resume");

      const where = {
        userId: mockUser.id,
        status: { in: ["in-progress", "needs-attention"] },
        OR: [
          { title: { contains: "resume" } },
          { description: { contains: "resume" } },
        ],
      };
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(prisma.task.count).toHaveBeenCalledWith({ where });
    });

    it("orders by due date when grouping by due date", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.task.count as any).mockResolvedValue(0);

      await getTasksList(1, 25, undefined, undefined, "dueDate");

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { dueDate: "asc" },
            { priority: "desc" },
            { createdAt: "desc" },
          ],
        }),
      );
    });

    it("returns an error when not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const result = await getTasksList();

      expect(result).toEqual({ success: false, message: "Not authenticated" });
    });

    it("handles database errors", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findMany as any).mockRejectedValue(new Error("db down"));

      const result = await getTasksList();

      expect(result).toEqual({ success: false, message: "db down" });
    });
  });

  describe("getTaskById", () => {
    it("returns the task scoped to the user", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);

      const result = await getTaskById("task-id");

      expect(result).toEqual({ success: true, data: mockTask });
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-id", userId: mockUser.id },
      });
    });

    it("returns an error when the task is not found", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findFirst as any).mockResolvedValue(null);

      const result = await getTaskById("missing");

      expect(result).toEqual({ success: false, message: "Task not found" });
    });
  });

  describe("createTask", () => {
    const input = {
      title: "New Task",
      description: "Description",
      status: "in-progress" as const,
      priority: 5,
      percentComplete: 0,
      dueDate: new Date("2099-12-31"),
    };

    it("creates the task for the user", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.create as any).mockResolvedValue({ id: "new", ...input });

      const result = await createTask(input);

      expect(result.success).toBe(true);
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: { ...input, userId: mockUser.id },
      });
    });

    it("rejects invalid input", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);

      const result = await createTask({ ...input, title: "x" });

      expect(result.success).toBe(false);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it("returns an error when not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const result = await createTask(input);

      expect(result).toEqual({ success: false, message: "Not authenticated" });
    });
  });

  describe("updateTask", () => {
    const input = {
      id: "task-id",
      title: "Updated",
      description: "Updated description",
      status: "complete" as const,
      priority: 8,
      percentComplete: 100,
      dueDate: new Date("2099-12-31"),
    };

    it("updates the task scoped to the user", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.update as any).mockResolvedValue({ ...mockTask, ...input });

      const result = await updateTask(input);

      expect(result.success).toBe(true);
      const { id, ...data } = input;
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id, userId: mockUser.id },
        data,
      });
    });

    it("requires a task id", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      const { id: _id, ...noId } = input;

      const result = await updateTask(noId);

      expect(result).toEqual({
        success: false,
        message: "Task ID is required for update",
      });
    });
  });

  describe("updateTaskStatus", () => {
    it("updates only the status", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.update as any).mockResolvedValue({
        ...mockTask,
        status: "complete",
      });

      const result = await updateTaskStatus("task-id", "complete");

      expect(result.success).toBe(true);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-id", userId: mockUser.id },
        data: { status: "complete" },
      });
    });
  });

  describe("deleteTaskById", () => {
    it("deletes an owned task", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.delete as any).mockResolvedValue(mockTask);

      const result = await deleteTaskById("task-id");

      expect(result).toEqual({ success: true });
      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: "task-id", userId: mockUser.id },
      });
    });

    it("returns an error when the task is not found", async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (prisma.task.findFirst as any).mockResolvedValue(null);

      const result = await deleteTaskById("missing");

      expect(result).toEqual({ success: false, message: "Task not found" });
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });
  });
});
