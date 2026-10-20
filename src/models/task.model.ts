export const TASK_STATUSES = {
  "in-progress": "In Progress",
  "complete": "Complete",
  "needs-attention": "Needs Attention",
  "cancelled": "Cancelled",
} as const;

export type TaskStatus = keyof typeof TASK_STATUSES;

export type TaskGroupBy =
  | "none"
  | "createdDate"
  | "dueDate"
  | "updatedDate";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: number;
  percentComplete: number;
  dueDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
