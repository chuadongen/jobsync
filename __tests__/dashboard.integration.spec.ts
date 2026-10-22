// @vitest-environment node
import fs from "fs";
import { migrate, setupTempDatabase } from "./helpers/testDb";

const tmp = setupTempDatabase();

const { default: prisma } = await import("@/lib/db");
const { getDashboard } = await import("@/lib/dashboard");

const NOW = new Date("2026-10-20T04:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
let userId: string;
let otherId: string;

async function status(value: string) {
  return prisma.jobStatus.upsert({ where: { value }, update: {}, create: { label: value, value } });
}

async function job(owner: string, company: string, statusValue: string, extra: Record<string, unknown> = {}) {
  const st = await status(statusValue);
  const co = await prisma.company.create({ data: { label: company, value: `${company}-${owner}`, createdBy: owner } });
  const jt = await prisma.jobTitle.create({ data: { label: "Intern", value: `intern-${company}-${owner}`, createdBy: owner } });
  return prisma.job.create({
    data: { userId: owner, description: "", jobType: "IN", createdAt: day(-1), statusId: st.id, companyId: co.id, jobTitleId: jt.id, ...extra },
  });
}

beforeAll(async () => {
  await migrate(prisma);
  userId = (await prisma.user.create({ data: { name: "a", email: "a@t.com", password: "x" } })).id;
  otherId = (await prisma.user.create({ data: { name: "b", email: "b@t.com", password: "x" } })).id;

  const applied = await job(userId, "Shopee", "applied", { applied: true, appliedDate: day(-3), startDate: day(200), endDate: day(280) });
  await job(userId, "GovTech", "draft", { dueDate: day(5) });
  await job(userId, "Old", "draft", { dueDate: day(30) });
  await job(userId, "Gone", "rejected", { applied: true, appliedDate: day(-60), startDate: day(200), endDate: day(280) });
  await job(otherId, "Theirs", "applied", { dueDate: day(2) });

  const stageType = await prisma.jobStageType.create({
    data: { label: "Interview", value: "interview", statusId: (await status("interview")).id, createdBy: userId },
  });
  await prisma.jobStage.create({ data: { jobId: applied.id, stageTypeId: stageType.id, occurredAt: day(3) } });
  await prisma.jobStage.create({ data: { jobId: applied.id, stageTypeId: stageType.id, occurredAt: day(40) } });

  await prisma.task.create({ data: { userId, title: "Ask for testimonial", status: "in-progress", dueDate: day(1) } });
  await prisma.task.create({ data: { userId, title: "Done already", status: "complete", dueDate: day(1) } });

  await prisma.availabilityBlock.create({
    data: { userId, title: "Exchange", kind: "absolute", startDate: day(190), endDate: day(210) },
  });
  await prisma.resumeDoc.create({ data: { userId, name: "PM", kind: "base", sectionOrder: "[]", status: "draft", createdVia: "Claude Desktop" } });
  await prisma.resumeDoc.create({ data: { userId, name: "SWE", kind: "base", sectionOrder: "[]", status: "approved" } });
  await prisma.coverLetter.create({ data: { userId, title: "Letter", content: "x".repeat(30), status: "draft" } });
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe("getDashboard", () => {
  it("counts only this user's jobs and treats closed statuses as not open", async () => {
    const data = await getDashboard(userId, NOW);
    expect(data.counts.total).toBe(4);
    expect(data.counts.open).toBe(3);
    expect(data.counts.appliedLast30).toBe(1);
    expect(data.pipeline.map((p) => [p.value, p.count])).toEqual([
      ["draft", 2],
      ["applied", 1],
      ["rejected", 1],
    ]);
  });

  it("lists the next two weeks in date order: interview, closing date and open task", async () => {
    const data = await getDashboard(userId, NOW);
    expect(data.upcoming.map((u) => [u.kind, u.title])).toEqual([
      ["task", "Ask for testimonial"],
      ["stage", "Interview"],
      ["deadline", "Application closes"],
    ]);
    expect(data.counts.interviewsSoon).toBe(1);
  });

  it("surfaces drafts awaiting approval, flagging Claude's, and clashes on open jobs only", async () => {
    const data = await getDashboard(userId, NOW);
    expect(data.counts.awaitingApproval).toBe(2);
    expect(data.drafts.find((d) => d.title === "PM")?.fromClaude).toBe(true);
    expect(data.drafts.find((d) => d.title === "Letter")?.fromClaude).toBe(false);
    expect(data.clashes.map((c) => c.job.Company.label)).toEqual(["Shopee"]);
  });
});
