// @vitest-environment node
import fs from "fs";
import path from "path";
import { migrate, setupTempDatabase } from "./helpers/testDb";

const tmp = setupTempDatabase();

// Imported after the env is pointed at the temp database.
const { default: prisma } = await import("@/lib/db");
const bank = await import("@/lib/resume/bank");
const docs = await import("@/lib/resume/docs");
const letters = await import("@/lib/resume/letters");
const { submitResume } = await import("@/lib/resume/submit");

let userId: string;
let otherUserId: string;

async function makeUser(email: string) {
  const user = await prisma.user.create({
    data: { name: email, email, password: "x" },
  });
  return user.id;
}

async function makeJob(owner: string, company = "Shopee", title = "Product Intern") {
  const status = await prisma.jobStatus.upsert({
    where: { value: "draft" },
    update: {},
    create: { label: "Draft", value: "draft" },
  });
  const co = await prisma.company.create({
    data: { label: company, value: `${company.toLowerCase()}-${owner}`, createdBy: owner },
  });
  const jt = await prisma.jobTitle.create({
    data: { label: title, value: `${title.toLowerCase()}-${owner}`, createdBy: owner },
  });
  return prisma.job.create({
    data: {
      userId: owner,
      description: "<p>Own the roadmap for seller tools.</p>",
      jobType: "IN",
      createdAt: new Date("2026-10-01"),
      statusId: status.id,
      companyId: co.id,
      jobTitleId: jt.id,
    },
  });
}

async function makeEntry(owner: string, organisation: string, type = "experience") {
  const entry = await bank.createBankEntry(owner, {
    type: type as any,
    organisation,
    title: "Software Engineer Intern",
    startDate: "Mar 2022",
    endDate: "Aug 2022",
  });
  const b1 = await bank.createBankBullet(owner, {
    entryId: entry.id,
    text: "Automated AWS deployments with Terraform",
    tags: ["aws", "devops"],
  });
  const b2 = await bank.createBankBullet(owner, {
    entryId: entry.id,
    text: "Built internal web apps with product stakeholders",
  });
  return { entry, b1, b2 };
}

beforeAll(async () => {
  await migrate(prisma);
  userId = await makeUser("me@example.com");
  otherUserId = await makeUser("other@example.com");
  await bank.saveResumeHeader(userId, {
    fullName: "Chua Dong En",
    email: "me@example.com",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/me" }],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe("bank", () => {
  it("normalises tags and orders entries newest first", async () => {
    const older = await bank.createBankEntry(userId, {
      type: "project",
      organisation: "Older Project",
      startDate: "2021",
      tags: "React, react ,  SQL",
    });
    const newer = await bank.createBankEntry(userId, {
      type: "project",
      organisation: "Newer Project",
      startDate: "Oct 2024",
    });
    expect(older.tags).toBe("react,sql");

    const list = await bank.listBankEntries(userId);
    const names = list.map((e) => e.organisation);
    expect(names.indexOf("Newer Project")).toBeLessThan(names.indexOf("Older Project"));
    expect(newer.startSort?.toISOString()).toBe("2024-10-01T00:00:00.000Z");
  });

  it("refuses another user's entry", async () => {
    const { entry } = await makeEntry(otherUserId, "Their Co");
    await expect(
      bank.createBankBullet(userId, { entryId: entry.id, text: "Sneaky bullet" }),
    ).rejects.toThrow("Bank entry not found");
  });

  it("adds a suggestion to the bank only when accepted, with the user's edits", async () => {
    const { entry } = await makeEntry(userId, "Suggest Co");
    const suggestion = await bank.createBankSuggestion(userId, {
      entryId: entry.id,
      payload: { kind: "bullet", text: "Cut release time by 40%" },
      rationale: "The JD asks for delivery speed",
      createdVia: "claude",
    });
    expect(
      (await prisma.bankBullet.count({ where: { entryId: entry.id } })),
    ).toBe(2);

    await bank.acceptBankSuggestion(userId, suggestion.id, {
      kind: "bullet",
      text: "Cut release time by about a third",
    });

    const bullets = await prisma.bankBullet.findMany({ where: { entryId: entry.id } });
    expect(bullets.map((b) => b.text)).toContain("Cut release time by about a third");
    await expect(bank.acceptBankSuggestion(userId, suggestion.id)).rejects.toThrow(
      "already decided",
    );
  });

  it("creates a whole entry from an accepted entry suggestion", async () => {
    const suggestion = await bank.createBankSuggestion(userId, {
      payload: {
        kind: "entry",
        entry: { type: "leadership", organisation: "Singapore Armed Forces", title: "Platoon Commander" },
        bullets: [{ text: "Led a platoon of 30 through field training" }],
      },
    });
    await bank.acceptBankSuggestion(userId, suggestion.id);
    const entry = await prisma.bankEntry.findFirst({
      where: { userId, organisation: "Singapore Armed Forces" },
      include: { bullets: true },
    });
    expect(entry?.bullets).toHaveLength(1);
  });
});

describe("resume documents", () => {
  it("keeps provenance: a bullet must come from the same entry it prints under", async () => {
    const a = await makeEntry(userId, "HDB");
    const b = await makeEntry(userId, "Ngee Ann Polytechnic");
    const base = await docs.createBase(userId, { name: "SWE", targetRole: "Software engineering" });

    await expect(
      docs.saveDocContent(userId, base!.id, {
        items: [{ entryId: a.entry.id, bullets: [{ sourceId: b.b1.id, text: "Borrowed claim" }] }],
      }),
    ).rejects.toThrow("belongs to a different entry");

    await expect(
      docs.saveDocContent(userId, base!.id, {
        items: [{ entryId: a.entry.id, bullets: [{ sourceId: "made-up", text: "Invented claim" }] }],
      }),
    ).rejects.toThrow("not found in the bank");

    const saved = await docs.saveDocContent(userId, base!.id, {
      items: [
        {
          entryId: a.entry.id,
          bullets: [{ sourceId: a.b1.id, text: "Automated AWS infrastructure with Terraform, cutting setup to minutes" }],
        },
      ],
    });
    const bullet = saved!.rendered.sections[0].items[0].bullets[0];
    expect(bullet.text).toContain("cutting setup");
    expect(bullet.sourceText).toBe("Automated AWS deployments with Terraform");
  });

  it("refuses another user's entry on a resume", async () => {
    const theirs = await makeEntry(otherUserId, "Not Mine");
    const base = await docs.createBase(userId, { name: "BA" });
    await expect(
      docs.saveDocContent(userId, base!.id, {
        items: [{ entryId: theirs.entry.id, bullets: [] }],
      }),
    ).rejects.toThrow("not found");
  });

  it("prints sections in the doc's order and skips empty ones", async () => {
    const exp = await makeEntry(userId, "Exp Co", "experience");
    const edu = await makeEntry(userId, "SMU", "education");
    const base = await docs.createBase(userId, {
      name: "Order test",
      sectionOrder: ["experience", "education"],
    });
    const saved = await docs.saveDocContent(userId, base!.id, {
      items: [
        { entryId: edu.entry.id, bullets: [] },
        { entryId: exp.entry.id, bullets: [{ sourceId: exp.b2.id, text: exp.b2.text }] },
      ],
    });
    expect(saved!.rendered.sections.map((s) => s.key)).toEqual(["experience", "education"]);
    expect(saved!.rendered.header.fullName).toBe("Chua Dong En");
  });

  it("copies a base into a variant for a job and returns approved edits to draft", async () => {
    const e = await makeEntry(userId, "Variant Co");
    const job = await makeJob(userId);
    const base = await docs.createBase(userId, { name: "PM" }, {
      items: [{ entryId: e.entry.id, bullets: [{ sourceId: e.b1.id, text: e.b1.text }] }],
    });

    const variant = await docs.createVariant(userId, { baseId: base!.id, jobId: job.id });
    expect(variant!.name).toBe("PM · Shopee Product Intern");
    expect(variant!.status).toBe("draft");
    expect(variant!.rendered.sections[0].items[0].bullets).toHaveLength(1);

    const approved = await docs.approveDoc(userId, variant!.id);
    expect(approved!.status).toBe("approved");

    const edited = await docs.saveDocContent(userId, variant!.id, {
      items: [{ entryId: e.entry.id, bullets: [{ sourceId: e.b1.id, text: "Tweaked wording here" }] }],
    });
    expect(edited!.status).toBe("draft");
    expect(edited!.approvedAt).toBeNull();
  });

  it("will not approve an empty resume", async () => {
    const base = await docs.createBase(userId, { name: "Empty" });
    await expect(docs.approveDoc(userId, base!.id)).rejects.toThrow("empty");
  });

  it("submits only approved variants, writing the PDF and freezing the content", async () => {
    const e = await makeEntry(userId, "Submit Co");
    const job = await makeJob(userId, "Grab", "Strategy Intern");
    const base = await docs.createBase(userId, { name: "Strat" }, {
      items: [{ entryId: e.entry.id, bullets: [{ sourceId: e.b1.id, text: e.b1.text }] }],
    });
    const variant = await docs.createVariant(userId, { baseId: base!.id, jobId: job.id });

    await expect(submitResume(userId, variant!.id)).rejects.toThrow("Approve");

    await docs.approveDoc(userId, variant!.id);
    const submitted = await submitResume(userId, variant!.id);
    expect(submitted!.status).toBe("submitted");
    expect(submitted!.pdfPath).toBe(
      path.join("applications", "2026", "Grab - Strategy Intern", "Chua Dong En - Resume.pdf"),
    );
    const pdf = fs.readFileSync(path.join(process.env.DATA_DIR!, submitted!.pdfPath!));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(
      fs.existsSync(
        path.join(process.env.DATA_DIR!, "applications", "2026", "Grab - Strategy Intern", "job-description.md"),
      ),
    ).toBe(true);

    // Frozen: later bank edits do not reach the record of what was sent.
    await bank.updateBankEntry(userId, {
      id: e.entry.id,
      type: "experience",
      organisation: "Renamed Co",
    });
    const reread = await docs.getDocDetail(userId, variant!.id);
    expect(reread!.rendered.sections[0].items[0].organisation).toBe("Submit Co");

    await expect(
      docs.saveDocContent(userId, variant!.id, { items: [] }),
    ).rejects.toThrow("frozen");

    const copy = await docs.duplicateDoc(userId, variant!.id);
    expect(copy!.status).toBe("draft");
    expect(copy!.rendered.sections[0].items[0].organisation).toBe("Renamed Co");
  });

  it("never writes over an earlier submitted PDF", async () => {
    const e = await makeEntry(userId, "Twice Co");
    const job = await makeJob(userId, "Sea", "Analyst");
    const base = await docs.createBase(userId, { name: "BA" }, {
      items: [{ entryId: e.entry.id, bullets: [] }],
    });
    const first = await docs.createVariant(userId, { baseId: base!.id, jobId: job.id, name: "Same" });
    const second = await docs.createVariant(userId, { baseId: base!.id, jobId: job.id, name: "Same" });
    for (const v of [first, second]) {
      await docs.approveDoc(userId, v!.id);
    }
    const a = await submitResume(userId, first!.id);
    const b = await submitResume(userId, second!.id);
    expect(a!.pdfPath).not.toBe(b!.pdfPath);
    expect(b!.pdfPath).toMatch(/Chua Dong En - Resume \(2\)\.pdf$/);
  });
});

describe("cover letters", () => {
  it("runs the same draft, approve, edit-reverts lifecycle", async () => {
    const job = await makeJob(userId, "Stripe", "Ops Intern");
    const letter = await letters.createLetter(userId, {
      title: "Stripe Ops",
      content: "Dear team, I would love to join Stripe as an operations intern.",
      jobId: job.id,
    });
    expect(letter.status).toBe("draft");
    await letters.approveLetter(userId, letter.id);
    const edited = await letters.updateLetter(userId, letter.id, {
      title: "Stripe Ops",
      content: "Dear team, I would really love to join Stripe as an operations intern.",
      jobId: job.id,
    });
    expect(edited.status).toBe("draft");
  });

  it("refuses to attach a letter to another user's job", async () => {
    const job = await makeJob(otherUserId, "Theirs", "Role");
    await expect(
      letters.createLetter(userId, {
        title: "Nope",
        content: "This letter should never be attached to that job.",
        jobId: job.id,
      }),
    ).rejects.toThrow("Job not found");
  });
});
