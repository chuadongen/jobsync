// @vitest-environment node
import fs from "fs";
import { migrate, setupTempDatabase } from "./helpers/testDb";

const tmp = setupTempDatabase();

const { default: prisma } = await import("@/lib/db");
const { exportBank, importBank } = await import("@/lib/resume/portable");
const docs = await import("@/lib/resume/docs");

let userId: string;
let otherUserId: string;

const sample = {
  version: 1,
  header: { fullName: "Test Person", location: "Singapore", links: [] },
  entries: [
    {
      key: "hdb",
      type: "experience",
      organisation: "HDB",
      title: "Software Engineer Intern",
      startDate: "Mar 2022",
      endDate: "Aug 2022",
      tags: ["swe"],
      bullets: [
        { key: "hdb-1", text: "Built internal web applications", tags: ["swe"] },
        { key: "hdb-2", text: "Automated AWS deployment with Terraform", tags: ["cloud"] },
      ],
    },
    { key: "skills", type: "skill", organisation: "Technical", details: "React, AWS", bullets: [] },
  ],
  bases: [
    {
      name: "Cloud",
      targetRole: "Cloud internships",
      items: [
        { entry: "hdb", bullets: ["hdb-2", { key: "hdb-1", text: "Shipped internal web apps" }] },
        { entry: "skills", bullets: [] },
      ],
    },
  ],
};

beforeAll(async () => {
  await migrate(prisma);
  for (const email of ["a@test.com", "b@test.com"]) {
    await prisma.user.create({ data: { name: email, email, password: "x" } });
  }
  userId = (await prisma.user.findUniqueOrThrow({ where: { email: "a@test.com" } })).id;
  otherUserId = (await prisma.user.findUniqueOrThrow({ where: { email: "b@test.com" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe("bank import and export", () => {
  it("imports entries, bullets and a base whose bullets keep their provenance", async () => {
    const result = await importBank(userId, sample);
    expect(result).toEqual({ entries: 2, bullets: 2, bases: 1, header: true });

    const [base] = await docs.listDocs(userId, { kind: "base" });
    const detail = await docs.getDocDetail(userId, base.id);
    const hdb = detail!.rendered.sections.find((s) => s.key === "experience")!.items[0];
    expect(hdb.bullets.map((b) => b.text)).toEqual([
      "Automated AWS deployment with Terraform",
      "Shipped internal web apps",
    ]);
    // The reworded bullet still points at its bank original
    expect(hdb.bullets[1].sourceText).toBe("Built internal web applications");
    expect(detail!.status).toBe("draft");
  });

  it("round-trips through export into another account", async () => {
    const exported = await exportBank(userId);
    await importBank(otherUserId, JSON.parse(JSON.stringify(exported)));
    const again = await exportBank(otherUserId);

    const strip = (b: typeof exported) => ({
      header: b.header,
      entries: b.entries.map(({ key, bullets, ...rest }) => ({
        ...rest,
        bullets: bullets.map(({ key: _k, ...bullet }) => bullet),
      })),
      bases: b.bases.map((base) => ({
        ...base,
        items: base.items.map(({ entry, bullets, ...item }) => ({
          ...item,
          bullets: bullets.map((ref) => (typeof ref === "string" ? ref : ref.text)),
        })),
      })),
    });
    expect(strip(again)).toEqual(strip(exported));
  });

  it("rejects a base that borrows a bullet from another entry, writing nothing", async () => {
    const before = await prisma.bankEntry.count({ where: { userId } });
    const bad = structuredClone(sample);
    bad.bases[0].items[1].bullets = ["hdb-1"];
    await expect(importBank(userId, bad)).rejects.toThrow(/outside entry "skills"/);
    expect(await prisma.bankEntry.count({ where: { userId } })).toBe(before);
  });

  it("rejects unknown entries and duplicate keys", async () => {
    const unknown = structuredClone(sample);
    unknown.bases[0].items[0].entry = "nope";
    await expect(importBank(userId, unknown)).rejects.toThrow(/unknown entry "nope"/);

    const dup = structuredClone(sample);
    dup.entries[1].key = "hdb";
    await expect(importBank(userId, dup)).rejects.toThrow(/unique/);
  });
});
