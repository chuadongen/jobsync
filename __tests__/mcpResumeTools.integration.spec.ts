// @vitest-environment node
import fs from "fs";
import { migrate, setupTempDatabase } from "./helpers/testDb";

const tmp = setupTempDatabase();
process.env.MCP_ENABLED = "true";

const { default: prisma } = await import("@/lib/db");
const { generateToken } = await import("@/lib/mcp/tokens");
const bank = await import("@/lib/resume/bank");
const docs = await import("@/lib/resume/docs");
const { POST } = await import("@/app/api/mcp/route");

let token: string;
let userId: string;
let jobId: string;
let entryId: string;
let bulletId: string;
let baseId: string;

async function rpc(method: string, params: unknown, auth = token) {
  const res = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

async function call(name: string, args: unknown) {
  const { body } = await rpc("tools/call", { name, arguments: args });
  return body.result.content[0].text as string;
}

beforeAll(async () => {
  await migrate(prisma);
  const user = await prisma.user.create({
    data: { name: "Me", email: "me@example.com", password: "x" },
  });
  userId = user.id;
  const t = generateToken();
  token = t.plaintext;
  await prisma.mcpAccessToken.create({
    data: {
      userId,
      name: "claude-desktop",
      tokenHash: t.hash,
      tokenPrefix: t.prefix,
      scopes: JSON.stringify(["jobs:write", "resume:write"]),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });

  const status = await prisma.jobStatus.create({ data: { label: "Draft", value: "draft" } });
  const company = await prisma.company.create({
    data: { label: "Shopee", value: "shopee", createdBy: userId },
  });
  const title = await prisma.jobTitle.create({
    data: { label: "Product Manager Intern", value: "product manager intern", createdBy: userId },
  });
  const job = await prisma.job.create({
    data: {
      userId,
      description: "<p>Write <b>PRDs</b> and run sprint ceremonies.</p>",
      jobType: "IN",
      createdAt: new Date(),
      statusId: status.id,
      companyId: company.id,
      jobTitleId: title.id,
    },
  });
  jobId = job.id;

  const entry = await bank.createBankEntry(userId, {
    type: "experience",
    organisation: "Ngee Ann Polytechnic",
    title: "Contract Scrum Master and Developer",
    notes: "Ran 2-week sprints with 4 staff stakeholders",
  });
  entryId = entry.id;
  const bullet = await bank.createBankBullet(userId, {
    entryId,
    text: "Ran sprint ceremonies and stakeholder check-ins before rollout",
    tags: ["pm", "scrum"],
  });
  bulletId = bullet.id;
  const base = await docs.createBase(userId, { name: "PM", targetRole: "Product management" }, {
    items: [{ entryId, bullets: [{ sourceId: bulletId, text: bullet.text }] }],
  });
  baseId = base!.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe("MCP resume tools", () => {
  it("rejects a bad token", async () => {
    const { status } = await rpc("tools/list", {}, "jsync_nope");
    expect(status).toBe(401);
  });

  it("lists the tailoring tools and no approval tool", async () => {
    const { body } = await rpc("tools/list", {});
    const names = body.result.tools.map((t: any) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "get_experience_bank",
        "list_resumes",
        "get_resume",
        "get_job",
        "search_jobs",
        "save_resume_variant",
        "save_resume_base",
        "suggest_bank_additions",
        "save_cover_letter",
        "list_documents",
      ]),
    );
    expect(names.some((n: string) => /approve|submit/.test(n))).toBe(false);
  });

  it("returns the bank with ids Claude can cite", async () => {
    const data = JSON.parse(await call("get_experience_bank", {}));
    expect(data.entries[0]).toMatchObject({
      id: entryId,
      notes: "Ran 2-week sprints with 4 staff stakeholders",
      bullets: [{ id: bulletId, tags: ["pm", "scrum"] }],
    });
  });

  it("returns the job description as plain text", async () => {
    const data = JSON.parse(await call("get_job", { jobId }));
    expect(data.company).toBe("Shopee");
    expect(data.description).toBe("Write PRDs and run sprint ceremonies.");
  });

  it("finds a job by company name", async () => {
    const data = JSON.parse(await call("search_jobs", { query: "Shopee" }));
    expect(data).toEqual([expect.objectContaining({ id: jobId, resumes: 0 })]);
  });

  it("saves a tailored variant as a draft and points at the review page", async () => {
    const result = await call("save_resume_variant", {
      baseId,
      jobId,
      rationale: "Led with Scrum because the JD asks for sprint ceremonies.",
      items: [
        {
          entryId,
          bullets: [
            { sourceId: bulletId, text: "Ran sprint ceremonies and stakeholder check-ins, aligning scope before rollout" },
          ],
        },
      ],
    });
    expect(result).toMatch(/as a draft/);
    expect(result).toMatch(/needs the user's approval/);
    const variant = await prisma.resumeDoc.findFirst({ where: { kind: "variant", jobId } });
    expect(variant).toMatchObject({ status: "draft", createdVia: "claude-desktop" });
  });

  it("refuses a bullet with no bank source", async () => {
    const result = await call("save_resume_variant", {
      baseId,
      jobId,
      rationale: "x",
      items: [{ entryId, bullets: [{ sourceId: "invented", text: "Led a team of 50" }] }],
    });
    expect(result).toMatch(/^Error: .*not found in the bank/);
  });

  it("queues bank suggestions without adding them", async () => {
    const result = await call("suggest_bank_additions", {
      suggestions: [
        { kind: "bullet", entryId, text: "Wrote user stories with acceptance criteria" },
        { kind: "bullet", text: "Missing the entry id" },
      ],
    });
    expect(result).toMatch(/\[1\] queued/);
    expect(result).toMatch(/\[2\] rejected/);
    expect(await prisma.bankSuggestion.count({ where: { status: "pending" } })).toBe(1);
    expect(await prisma.bankBullet.count({ where: { entryId } })).toBe(1);
  });

  it("saves a cover letter draft for the job", async () => {
    const result = await call("save_cover_letter", {
      jobId,
      title: "Shopee PM Intern",
      content: "Dear Shopee team,\n\nI run sprints and talk to stakeholders.",
    });
    expect(result).toMatch(/as a draft/);
  });

  it("enforces token scopes", async () => {
    const t = generateToken();
    await prisma.mcpAccessToken.create({
      data: {
        userId,
        name: "jobs-only",
        tokenHash: t.hash,
        tokenPrefix: t.prefix,
        scopes: JSON.stringify(["jobs:write"]),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const { body } = await rpc(
      "tools/call",
      { name: "get_experience_bank", arguments: {} },
      t.plaintext,
    );
    expect(body.result.content[0].text).toBe("Insufficient scope. Required: resume:write");
  });
});
