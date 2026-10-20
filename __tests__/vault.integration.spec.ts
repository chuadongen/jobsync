// @vitest-environment node
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { migrate, setupTempDatabase } from "./helpers/testDb";

const tmp = setupTempDatabase();

const { default: prisma } = await import("@/lib/db");
const documents = await import("@/lib/files/documents");
const availability = await import("@/lib/availability");
const { buildBackupZip } = await import("@/lib/files/backup");
const { safeSegment, resolveDataPath } = await import("@/lib/files/storage");

let userId: string;
let jobId: string;
const pdfBytes = new TextEncoder().encode("%PDF-1.4 fake");

beforeAll(async () => {
  await migrate(prisma);
  const user = await prisma.user.create({
    data: { name: "Me", email: "me@example.com", password: "x" },
  });
  userId = user.id;
  const status = await prisma.jobStatus.create({ data: { label: "Applied", value: "applied" } });
  const company = await prisma.company.create({
    data: { label: "ByteDance", value: "bytedance", createdBy: userId },
  });
  const title = await prisma.jobTitle.create({
    data: { label: "PM Intern", value: "pm intern", createdBy: userId },
  });
  const job = await prisma.job.create({
    data: {
      userId,
      description: "Role",
      jobType: "IN",
      createdAt: new Date("2026-03-01"),
      appliedDate: new Date("2026-03-05"),
      startDate: new Date("2026-05-11"),
      endDate: new Date("2026-08-07"),
      statusId: status.id,
      companyId: company.id,
      jobTitleId: title.id,
    },
  });
  jobId = job.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe("file storage", () => {
  it("sanitises names that would escape a folder", () => {
    expect(safeSegment("../../etc/passwd")).toBe("etc passwd");
    expect(safeSegment("   ")).toBe("untitled");
    expect(() => resolveDataPath("../outside.txt")).toThrow("escapes");
  });
});

describe("documents", () => {
  it("files a standalone document in the vault under its category", async () => {
    const doc = await documents.createDocument(userId, {
      title: "SMU transcript",
      category: "transcript",
      fileName: "Transcript Y1.pdf",
      bytes: pdfBytes,
    });
    expect(doc.filePath).toBe(path.join("vault", "transcript", "Transcript Y1.pdf"));
    expect(fs.existsSync(path.join(process.env.DATA_DIR!, doc.filePath))).toBe(true);
  });

  it("files a job document in that application's folder", async () => {
    const doc = await documents.createDocument(userId, {
      title: "Portfolio",
      category: "portfolio",
      jobId,
      fileName: "portfolio.pdf",
      bytes: pdfBytes,
    });
    expect(doc.filePath).toBe(
      path.join("applications", "2026", "ByteDance - PM Intern", "portfolio.pdf"),
    );
  });

  it("rejects file types outside the allow-list", async () => {
    await expect(
      documents.createDocument(userId, {
        title: "Script",
        category: "other",
        fileName: "run.sh",
        bytes: pdfBytes,
      }),
    ).rejects.toThrow("not accepted");
  });

  it("removes the file with the record", async () => {
    const doc = await documents.createDocument(userId, {
      title: "Cert",
      category: "certificate",
      fileName: "aws.pdf",
      bytes: pdfBytes,
    });
    await documents.deleteDocument(userId, doc.id);
    expect(fs.existsSync(path.join(process.env.DATA_DIR!, doc.filePath))).toBe(false);
  });
});

describe("availability", () => {
  it("flags a role that runs into a block, counting the overlapping days", async () => {
    await availability.saveBlock(userId, {
      title: "Exchange at HKUST",
      kind: "potential",
      startDate: "2026-08-01",
      endDate: "2026-12-20",
    });
    await availability.saveBlock(userId, {
      title: "Family trip",
      kind: "absolute",
      startDate: "2026-12-22",
      endDate: "2026-12-30",
    });

    const rows = await availability.jobClashes(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].clashes).toEqual([
      expect.objectContaining({ title: "Exchange at HKUST", kind: "potential", days: 7 }),
    ]);
  });

  it("refuses an end date before the start", async () => {
    await expect(
      availability.saveBlock(userId, {
        title: "Backwards",
        kind: "absolute",
        startDate: "2026-05-01",
        endDate: "2026-04-01",
      }),
    ).rejects.toThrow("end date");
  });
});

describe("backup", () => {
  it("zips a database snapshot with every stored file", async () => {
    const zip = await JSZip.loadAsync(await buildBackupZip());
    const names = Object.keys(zip.files);
    expect(names).toContain("jobsync.db");
    expect(names).toContain("vault/transcript/Transcript Y1.pdf");
    expect(names).toContain("applications/2026/ByteDance - PM Intern/portfolio.pdf");
    const db = await zip.file("jobsync.db")!.async("uint8array");
    expect(new TextDecoder().decode(db.subarray(0, 15))).toBe("SQLite format 3");
  });
});
