// @vitest-environment node
import fs from "fs";
import { migrate, setupTempDatabase } from "./helpers/testDb";

const tmp = setupTempDatabase();
process.env.MCP_ENABLED = "true";

const { default: prisma } = await import("@/lib/db");
const { generateToken } = await import("@/lib/mcp/tokens");
const seasons = await import("@/lib/seasons");
const gaps = await import("@/lib/resume/gaps");
const stages = await import("@/lib/stages");
const bank = await import("@/lib/resume/bank");
const docs = await import("@/lib/resume/docs");
const { windowPhase, jobMatchesTarget, nextIntakeName } = await import("@/models/seasons.model");
const { furthestStage, hasNumber } = await import("@/models/gaps.model");
const { POST } = await import("@/app/api/mcp/route");

let userId: string;
let otherId: string;
let token: string;
const statusIds: Record<string, string> = {};
const typeIds: Record<string, string> = {};

async function makeJob(owner: string, company: string, title: string, status = "applied") {
  const co = await prisma.company.create({ data: { label: company, value: `${company}-${owner}-${Math.random()}`, createdBy: owner } });
  const jt = await prisma.jobTitle.create({ data: { label: title, value: `${title}-${owner}-${Math.random()}`, createdBy: owner } });
  return prisma.job.create({
    data: {
      userId: owner,
      description: "<p>JD</p>",
      jobType: "IN",
      createdAt: new Date("2026-09-10"),
      statusId: statusIds[status],
      companyId: co.id,
      jobTitleId: jt.id,
    },
  });
}

async function rpc(name: string, args: unknown) {
  const res = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  const body = await res.json();
  return body.result.content[0].text as string;
}

beforeAll(async () => {
  await migrate(prisma);
  userId = (await prisma.user.create({ data: { name: "Me", email: "me@t.com", password: "x" } })).id;
  otherId = (await prisma.user.create({ data: { name: "Them", email: "them@t.com", password: "x" } })).id;
  for (const v of ["draft", "applied", "interview", "offer", "rejected"]) {
    statusIds[v] = (await prisma.jobStatus.create({ data: { label: v, value: v } })).id;
  }
  for (const [label, status, sortOrder] of [
    ["Applied", "applied", 2],
    ["Online Assessment", "interview", 3],
    ["1st Screening Interview", "interview", 6],
    ["Offer", "offer", 10],
  ] as const) {
    typeIds[label] = (
      await prisma.jobStageType.create({
        data: { label, value: label.toLowerCase(), statusId: statusIds[status], sortOrder, createdBy: userId },
      })
    ).id;
  }
  const t = generateToken();
  token = t.plaintext;
  await prisma.mcpAccessToken.create({
    data: {
      userId,
      name: "Claude Desktop",
      tokenHash: t.hash,
      tokenPrefix: t.prefix,
      scopes: JSON.stringify(["jobs:write", "resume:write"]),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe("seasons", () => {
  it("matches jobs by fuzzy company name and optional title keyword", () => {
    expect(jobMatchesTarget({ company: "Shopee", keyword: null }, { company: "Shopee Singapore", title: "PM Intern" })).toBe(true);
    expect(jobMatchesTarget({ company: "Shopee", keyword: "Product" }, { company: "Shopee", title: "SWE Intern" })).toBe(false);
    expect(jobMatchesTarget({ company: null, keyword: "analyst" }, { company: "McKinsey", title: "Business Analyst" })).toBe(true);
    expect(jobMatchesTarget({ company: null, keyword: null }, { company: "X", title: "Y" })).toBe(false);
  });

  it("works out where a window stands", () => {
    const now = new Date("2026-10-21");
    expect(windowPhase({ opensAt: new Date("2026-11-10"), closesAt: null }, now)).toBe("soon");
    expect(windowPhase({ opensAt: new Date("2027-01-10"), closesAt: null }, now)).toBe("upcoming");
    expect(windowPhase({ opensAt: new Date("2026-10-01"), closesAt: new Date("2026-11-30") }, now)).toBe("open");
    expect(windowPhase({ opensAt: new Date("2026-10-01"), closesAt: new Date("2026-10-31") }, now)).toBe("closing");
    expect(windowPhase({ opensAt: new Date("2026-08-01"), closesAt: new Date("2026-10-15") }, now)).toBe("closed");
  });

  it("queues Claude's research as suggestions, replacing an earlier pending one for the same intake", async () => {
    await makeJob(userId, "GovTech", "Software Engineer Intern");
    const first = await seasons.suggestWindows(
      userId,
      { target: { name: "GovTech SWE", company: "GovTech" }, windows: [{ intake: "Summer 2027", opensAt: new Date("2026-10-01"), source: "a" }] },
      "Claude",
    );
    await seasons.suggestWindows(
      userId,
      { target: { name: "GovTech SWE" }, windows: [{ intake: "Summer 2027", opensAt: new Date("2026-10-05"), source: "b" }] },
      "Claude",
    );
    const [target] = await seasons.listTargets(userId);
    expect(target.id).toBe(first.targetId);
    expect(target.windows).toHaveLength(1);
    expect(target.windows[0]).toMatchObject({ status: "suggested", source: "b" });
    expect(target.jobs.map((j) => j.company)).toEqual(["GovTech"]);
    expect(target.observed).toEqual([{ year: 2026, firstSeen: new Date("2026-09-10") }]);
  });

  it("confirming a suggestion replaces the old window for that intake and leaves other intakes", async () => {
    const [target] = await seasons.listTargets(userId);
    await seasons.saveWindow(userId, target.id, { intake: "Summer 2027", opensAt: new Date("2026-09-01") });
    await seasons.saveWindow(userId, target.id, { intake: "Off-cycle", opensAt: new Date("2026-08-01") });
    const suggestion = (await seasons.listTargets(userId))[0].windows.find((w) => w.status === "suggested")!;
    await seasons.confirmWindow(userId, suggestion.id);
    const windows = (await seasons.listTargets(userId))[0].windows;
    expect(windows.map((w) => [w.intake, w.status, w.source])).toEqual([
      ["Off-cycle", "confirmed", null],
      ["Summer 2027", "confirmed", "b"],
    ]);
  });

  it("rejects backwards dates and other users' targets", async () => {
    const [target] = await seasons.listTargets(userId);
    await expect(
      seasons.saveWindow(userId, target.id, { intake: "X", opensAt: new Date("2026-10-01"), closesAt: new Date("2026-09-01") }),
    ).rejects.toThrow(/cannot close before/);
    await expect(seasons.saveWindow(otherId, target.id, { intake: "X", opensAt: new Date("2026-10-01") })).rejects.toThrow(
      "Target not found",
    );
    await expect(seasons.saveTarget(userId, { name: "Nothing to match" })).rejects.toThrow(/company, a title keyword/);
  });

  it("saves windows over MCP as suggestions with a review link", async () => {
    const text = await rpc("save_target_windows", {
      target: { name: "Shopee PM", company: "Shopee", keyword: "Product" },
      windows: [{ intake: "Summer 2027", opensAt: "2026-09-01", closesAt: "2026-11-15", estimated: true, source: "careers page" }],
    });
    expect(text).toMatch(/as suggestions/);
    const listed = JSON.parse(await rpc("list_targets", {}));
    const shopee = listed.find((t: any) => t.name === "Shopee PM");
    expect(shopee.windows[0]).toMatchObject({ status: "suggested", opensAt: "2026-09-01", estimated: true });
  });
});

describe("rollover to next year", () => {
  it("names the next intake", () => {
    expect(nextIntakeName("Summer 2027")).toBe("Summer 2028");
    expect(nextIntakeName("AY2026/27 internship")).toBe("AY2027/28 internship");
    expect(nextIntakeName("Off-cycle Jan 2027")).toBe("Off-cycle Jan 2028");
    expect(nextIntakeName("Graduate programme")).toBe("Graduate programme (next year)");
  });

  it("anchors on when a matching job was first saved if that was before the recorded open", async () => {
    // A Grab job was saved on 10 Sep 2026, before the window's recorded 1 Oct.
    await makeJob(userId, "Grab", "Software Intern");
    const target = await seasons.saveTarget(userId, { name: "Grab SWE", company: "Grab", keyword: "Software" });
    const w = await seasons.saveWindow(userId, target.id, {
      intake: "Summer 2027",
      opensAt: new Date("2026-10-01"),
      closesAt: new Date("2026-10-31"),
      roleStart: new Date("2027-05-17"),
      roleEnd: new Date("2027-08-13"),
    });
    const next = await seasons.rolloverWindow(userId, w.id);
    expect(next).toMatchObject({
      intake: "Summer 2028",
      estimated: true,
      status: "confirmed",
      opensAt: new Date("2027-09-10"),
      // Same length as before: 30 days after opening.
      closesAt: new Date("2027-10-10"),
      roleStart: new Date("2028-05-17"),
    });
    expect(next.source).toMatch(/matching job was saved on 10 Sep 2026/);
    await expect(seasons.rolloverWindow(userId, w.id)).rejects.toThrow("Summer 2028 already has a window");
  });

  it("rolls over only closed, confirmed windows without a successor", async () => {
    const target = await seasons.saveTarget(userId, { name: "Roll target", company: "Rollco" });
    await seasons.saveWindow(userId, target.id, { intake: "Spring 2026", opensAt: new Date("2026-01-01"), closesAt: new Date("2026-02-01") });
    await seasons.saveWindow(userId, target.id, { intake: "Summer 2027", opensAt: new Date("2026-10-01"), closesAt: new Date("2026-12-01") });
    await seasons.suggestWindows(
      userId,
      { target: { id: target.id }, windows: [{ intake: "Winter 2025", opensAt: new Date("2025-01-01"), closesAt: new Date("2025-02-01"), source: "x" }] },
      "Claude",
    );
    const rollable = await seasons.rollableWindows(userId, new Date("2026-10-21"));
    expect(rollable.map((w) => w.intake)).toContain("Spring 2026");
    expect(rollable.map((w) => w.intake)).not.toContain("Winter 2025");
    const before = rollable.length;
    expect(await seasons.rolloverAll(userId, new Date("2026-10-21"))).toBe(before);
    expect(await seasons.rollableWindows(userId, new Date("2026-10-21"))).toEqual([]);
    const intakes = (await seasons.listTargets(userId)).find((t) => t.id === target.id)!.windows.map((w) => w.intake);
    expect(intakes).toEqual(expect.arrayContaining(["Spring 2026", "Spring 2027", "Summer 2027"]));
    expect(intakes).not.toContain("Summer 2028");
  });
});

describe("base gaps", () => {
  let baseId: string;
  let bulletWithNumber: string;
  let bulletWithout: string;
  let jobA: string;
  let jobB: string;

  beforeAll(async () => {
    const entry = await bank.createBankEntry(userId, { type: "experience", organisation: "HDB", title: "Intern" });
    bulletWithNumber = (await bank.createBankBullet(userId, { entryId: entry.id, text: "Cut deploy time by 40% with Terraform" })).id;
    bulletWithout = (await bank.createBankBullet(userId, { entryId: entry.id, text: "Worked with stakeholders on scope" })).id;
    const base = await docs.createBase(userId, { name: "PM" }, {
      items: [
        {
          entryId: entry.id,
          bullets: [
            { sourceId: bulletWithNumber, text: "Cut deploy time by 40% with Terraform" },
            { sourceId: bulletWithout, text: "Worked with stakeholders on scope" },
          ],
        },
      ],
    });
    baseId = base!.id;
    jobA = (await makeJob(userId, "Shopee", "Product Intern")).id;
    jobB = (await makeJob(userId, "Grab", "Product Intern")).id;
  });

  it("detects quantities in digits and words", () => {
    expect(hasNumber("Led a team of five")).toBe(true);
    expect(hasNumber("Grew usage 3x")).toBe(true);
    expect(hasNumber("Worked with stakeholders")).toBe(false);
  });

  it("drops evidence that is not the user's bank bullet", async () => {
    const otherEntry = await bank.createBankEntry(otherId, { type: "experience", organisation: "Theirs" });
    const foreign = (await bank.createBankBullet(otherId, { entryId: otherEntry.id, text: "Not yours at all" })).id;
    const saved = await gaps.saveJobRequirements(userId, {
      jobId: jobA,
      baseId,
      requirements: [
        { label: "SQL", coverage: "weak", evidence: [bulletWithNumber, foreign] },
        { label: "Product metrics", coverage: "none" },
      ],
    });
    expect(JSON.parse(saved.requirements)[0].evidence).toEqual([bulletWithNumber]);
    await expect(gaps.saveJobRequirements(otherId, { jobId: jobA, requirements: [] })).rejects.toThrow("Job not found");
  });

  it("aggregates requirements across jobs, newest assessment winning, most asked first", async () => {
    await gaps.saveJobRequirements(userId, {
      jobId: jobB,
      baseId,
      requirements: [
        { label: "sql", coverage: "strong", evidence: [bulletWithNumber] },
        { label: "Python", coverage: "none", importance: "preferred" },
      ],
    });
    const data = await gaps.getBaseGaps(userId, baseId);
    expect(data.analysedJobs).toBe(2);
    expect(data.coverage[0]).toMatchObject({ label: "sql", mentions: 2, required: 2, coverage: "strong" });
    expect(data.coverage[0].evidence.map((e) => e.id)).toEqual([bulletWithNumber]);
    expect(data.coverage.map((c) => c.label)).toEqual(["sql", "Product metrics", "Python"]);
    expect(data.missingNumbers.map((m) => m.text)).toEqual(["Worked with stakeholders on scope"]);
  });

  it("counts outcomes only for sent variants, by the furthest stage reached", async () => {
    expect(
      furthestStage([
        { label: "Applied", statusValue: "applied" },
        { label: "Online Assessment", statusValue: "interview" },
      ]),
    ).toBe("assessment");

    for (const [jobId, stageLabels, finalStatus] of [
      [jobA, ["Online Assessment", "1st Screening Interview"], "interview"],
      [jobB, [], "rejected"],
    ] as const) {
      const v = await docs.createVariant(userId, { baseId, jobId });
      await docs.approveDoc(userId, v!.id);
      await docs.markDocSubmitted(userId, v!.id, v!.rendered, null);
      for (const label of stageLabels) {
        await prisma.jobStage.create({ data: { jobId, stageTypeId: typeIds[label], occurredAt: new Date() } });
      }
      await prisma.job.update({ where: { id: jobId }, data: { statusId: statusIds[finalStatus] } });
    }
    // An unsent draft variant does not count.
    const third = await makeJob(userId, "Sea", "Product Intern");
    await docs.createVariant(userId, { baseId, jobId: third.id });

    const { results } = await gaps.getBaseGaps(userId, baseId);
    expect(results).toMatchObject({
      sent: 2,
      waiting: 0,
      screenedOut: 1,
      reachedAssessment: 1,
      reachedInterview: 1,
      offers: 0,
      stoppedAt: { applied: 1, assessment: 0, interview: 0, offer: 0 },
    });
  });

  it("saves a gap report on bases only, readable over MCP with caveats", async () => {
    const variant = await prisma.resumeDoc.findFirst({ where: { userId, kind: "variant" } });
    await expect(
      gaps.saveGapReport(userId, { baseId: variant!.id, summary: "x", suggestions: [] }),
    ).rejects.toThrow("Base version not found");

    const saved = await rpc("save_gap_report", {
      baseId,
      summary: "Metrics are the gap.",
      suggestions: [{ title: "Add a number", detail: "Say how many users.", evidence: "2 of 2 postings" }],
    });
    expect(saved).toMatch(/tab=gaps/);
    const data = JSON.parse(await rpc("get_base_gaps", { baseId }));
    expect(data.report.suggestions[0].title).toBe("Add a number");
    expect(data.caveats.join(" ")).toMatch(/rough guide/);
  });
});

describe("stage prep and debrief", () => {
  let jobId: string;

  beforeAll(async () => {
    jobId = (await makeJob(userId, "Stripe", "Software Intern", "applied")).id;
    const earlier = await makeJob(userId, "Stripe", "Data Intern", "rejected");
    await prisma.jobStage.create({
      data: { jobId: earlier.id, stageTypeId: typeIds["1st Screening Interview"], occurredAt: new Date("2025-11-01"), debrief: "They asked about idempotency." },
    });
  });

  it("adds a round by an existing stage type only, making it current", async () => {
    await expect(stages.addStageForJob(userId, { jobId, stage: "Vibe check" })).rejects.toThrow(/Unknown stage "Vibe check". Use one of/);
    const added = await stages.addStageForJob(userId, { jobId, stage: "1st screening interview", occurredAt: new Date("2026-11-02") });
    expect(added).toMatchObject({ stage: "1st Screening Interview", current: true });
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { statusId: true } });
    expect(job!.statusId).toBe(statusIds.interview);
  });

  it("writes prep and debrief without touching the user's own notes", async () => {
    const stage = await prisma.jobStage.findFirst({ where: { jobId } });
    await prisma.jobStage.update({ where: { id: stage!.id }, data: { notes: "My own note" } });
    await stages.saveStagePrep(userId, stage!.id, { prepNotes: "## Questions\n- Why Stripe?" });
    await stages.saveStagePrep(userId, stage!.id, { debrief: "Asked about rate limiting, not idempotency." });
    const after = await prisma.jobStage.findUnique({ where: { id: stage!.id } });
    expect(after).toMatchObject({ notes: "My own note", prepNotes: "## Questions\n- Why Stripe?", debrief: "Asked about rate limiting, not idempotency." });
    await expect(stages.saveStagePrep(otherId, stage!.id, { prepNotes: "x" })).rejects.toThrow("Stage not found");
    await expect(stages.saveStagePrep(userId, stage!.id, {})).rejects.toThrow(/Nothing to save/);
  });

  it("returns the job's rounds with debriefs from earlier applications to the same company", async () => {
    const data = JSON.parse(await rpc("get_job_stages", { jobId }));
    expect(data.stages[0]).toMatchObject({ stage: "1st Screening Interview", userNotes: "My own note" });
    expect(data.sameCompanyHistory).toEqual([
      expect.objectContaining({ job: "Data Intern (2026)", debrief: "They asked about idempotency." }),
    ]);
    expect(data.stageTypes).toContain("Online Assessment");
  });
});
