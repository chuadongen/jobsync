import { z } from "zod";
import prisma from "@/lib/db";
import { sectionForEntryType } from "@/models/bank.model";
import {
  DEFAULT_SECTION_ORDER,
  RESUME_SECTIONS,
  type RenderedItem,
  type RenderedResume,
  type ResumeDocDetail,
  type ResumeHeaderData,
  type ResumeSectionKey,
} from "@/models/resume.model";
import { getResumeHeader } from "./bank";

// Core resume-document logic shared by the server actions and the MCP tools.
//
// The rule this module exists to enforce: every bullet on a resume names the
// bank bullet it was written from, and that bullet belongs to the same bank
// entry the item prints. Wording may change; provenance may not.

const SECTION_KEYS = Object.keys(RESUME_SECTIONS) as [
  ResumeSectionKey,
  ...ResumeSectionKey[],
];

export const DocContentSchema = z.object({
  sectionOrder: z.array(z.enum(SECTION_KEYS)).max(SECTION_KEYS.length).optional(),
  rationale: z.string().trim().max(10_000).optional().nullable(),
  items: z
    .array(
      z.object({
        entryId: z.string().min(1),
        titleOverride: z.string().trim().max(200).optional().nullable(),
        detailsOverride: z.string().trim().max(2000).optional().nullable(),
        bullets: z
          .array(
            z.object({
              sourceId: z.string().min(1),
              text: z.string().trim().min(3).max(600),
            }),
          )
          .max(12),
      }),
    )
    .max(60),
});

export type DocContent = z.input<typeof DocContentSchema>;

const DOC_DETAIL_INCLUDE = {
  base: { select: { id: true, name: true } },
  job: {
    select: {
      id: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
    },
  },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      entry: true,
      bullets: {
        orderBy: { sortOrder: "asc" as const },
        include: { source: { select: { text: true } } },
      },
    },
  },
};

type DocWithItems = NonNullable<Awaited<ReturnType<typeof loadDoc>>>;

async function loadDoc(userId: string, docId: string) {
  return prisma.resumeDoc.findFirst({
    where: { id: docId, userId },
    include: DOC_DETAIL_INCLUDE,
  });
}

async function requireDoc(userId: string, docId: string) {
  const doc = await loadDoc(userId, docId);
  if (!doc) throw new Error("Resume not found");
  return doc;
}

export function parseSectionOrder(raw: string | null | undefined): ResumeSectionKey[] {
  try {
    const parsed = z.array(z.enum(SECTION_KEYS)).parse(JSON.parse(raw ?? "[]"));
    // Sections added later still print, after the ones the doc ordered.
    const rest = DEFAULT_SECTION_ORDER.filter((k) => !parsed.includes(k));
    return [...new Set(parsed), ...rest];
  } catch {
    return [...DEFAULT_SECTION_ORDER];
  }
}

const EMPTY_HEADER: ResumeHeaderData = {
  fullName: "",
  location: null,
  email: null,
  phone: null,
  links: [],
};

export function renderDoc(
  doc: DocWithItems,
  header: ResumeHeaderData | null,
): RenderedResume {
  const bySection = new Map<ResumeSectionKey, RenderedItem[]>();
  for (const item of doc.items) {
    const key = sectionForEntryType(item.entry.type);
    if (!key) continue;
    const list = bySection.get(key) ?? [];
    list.push({
      id: item.id,
      entryId: item.entryId,
      organisation: item.entry.organisation,
      title: item.titleOverride ?? item.entry.title,
      location: item.entry.location,
      startDate: item.entry.startDate,
      endDate: item.entry.endDate,
      details: item.detailsOverride ?? item.entry.details,
      url: item.entry.url,
      bullets: item.bullets.map((b) => ({
        id: b.id,
        sourceId: b.sourceId,
        text: b.text,
        sourceText: b.source.text,
      })),
    });
    bySection.set(key, list);
  }

  const sections = parseSectionOrder(doc.sectionOrder)
    .filter((key) => (bySection.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      heading: RESUME_SECTIONS[key],
      items: bySection.get(key)!,
    }));

  return { header: header ?? EMPTY_HEADER, sections };
}

function toDetail(doc: DocWithItems, rendered: RenderedResume): ResumeDocDetail {
  return {
    id: doc.id,
    kind: doc.kind as ResumeDocDetail["kind"],
    name: doc.name,
    status: doc.status as ResumeDocDetail["status"],
    targetRole: doc.targetRole,
    baseId: doc.baseId,
    jobId: doc.jobId,
    updatedAt: doc.updatedAt,
    base: doc.base,
    job: doc.job,
    sectionOrder: parseSectionOrder(doc.sectionOrder),
    rationale: doc.rationale,
    approvedAt: doc.approvedAt,
    submittedAt: doc.submittedAt,
    pdfPath: doc.pdfPath,
    createdVia: doc.createdVia,
    rendered,
    _count: { items: doc.items.length },
  };
}

// A submitted doc renders from its frozen snapshot, so later bank edits or a
// deleted entry can never change what the record says was sent.
export async function getDocDetail(
  userId: string,
  docId: string,
): Promise<ResumeDocDetail | null> {
  const doc = await loadDoc(userId, docId);
  if (!doc) return null;
  if (doc.status === "submitted" && doc.snapshot) {
    try {
      return toDetail(doc, JSON.parse(doc.snapshot) as RenderedResume);
    } catch {
      // Fall through to a live render rather than failing the page.
    }
  }
  return toDetail(doc, renderDoc(doc, await getResumeHeader(userId)));
}

export async function listDocs(
  userId: string,
  filter: { kind?: "base" | "variant"; jobId?: string; baseId?: string } = {},
) {
  return prisma.resumeDoc.findMany({
    where: { userId, ...filter },
    select: {
      id: true,
      kind: true,
      name: true,
      status: true,
      targetRole: true,
      baseId: true,
      jobId: true,
      updatedAt: true,
      createdVia: true,
      base: { select: { id: true, name: true } },
      job: {
        select: {
          id: true,
          JobTitle: { select: { label: true } },
          Company: { select: { label: true } },
        },
      },
      _count: { select: { items: true, variants: true } },
    },
    orderBy: [{ kind: "asc" }, { updatedAt: "desc" }],
  });
}

// Checks every entry and source bullet up front and in one query each, so a
// bad id fails the whole save before anything is written.
async function validateContent(userId: string, content: z.infer<typeof DocContentSchema>) {
  const entryIds = content.items.map((i) => i.entryId);
  if (new Set(entryIds).size !== entryIds.length) {
    throw new Error("An entry can appear on a resume only once");
  }
  const entries = await prisma.bankEntry.findMany({
    where: { userId, id: { in: entryIds } },
    select: { id: true, type: true },
  });
  if (entries.length !== entryIds.length) {
    const known = new Set(entries.map((e) => e.id));
    const missing = entryIds.find((id) => !known.has(id));
    throw new Error(`Bank entry ${missing} not found`);
  }

  const sourceIds = content.items.flatMap((i) => i.bullets.map((b) => b.sourceId));
  const sources = await prisma.bankBullet.findMany({
    where: { id: { in: sourceIds }, entry: { userId } },
    select: { id: true, entryId: true },
  });
  const entryOfSource = new Map(sources.map((s) => [s.id, s.entryId]));
  for (const item of content.items) {
    for (const bullet of item.bullets) {
      const owner = entryOfSource.get(bullet.sourceId);
      if (!owner) {
        throw new Error(`Source bullet ${bullet.sourceId} not found in the bank`);
      }
      if (owner !== item.entryId) {
        throw new Error(
          `Source bullet ${bullet.sourceId} belongs to a different entry than ${item.entryId}`,
        );
      }
    }
  }
}

function assertEditable(doc: { status: string }) {
  if (doc.status === "submitted") {
    throw new Error(
      "This resume was submitted and is frozen. Duplicate it to make changes.",
    );
  }
}

async function writeItems(
  tx: any,
  docId: string,
  items: z.infer<typeof DocContentSchema>["items"],
) {
  await tx.resumeItem.deleteMany({ where: { docId } });
  for (const [sortOrder, item] of items.entries()) {
    await tx.resumeItem.create({
      data: {
        docId,
        entryId: item.entryId,
        sortOrder,
        titleOverride: item.titleOverride || null,
        detailsOverride: item.detailsOverride || null,
        bullets: {
          create: item.bullets.map((b, i) => ({
            sourceId: b.sourceId,
            text: b.text,
            sortOrder: i,
          })),
        },
      },
    });
  }
}

// Replaces the doc's content wholesale. Any edit to an approved doc sends it
// back to draft: approval covers exact wording, not "roughly this".
export async function saveDocContent(
  userId: string,
  docId: string,
  input: DocContent,
  opts: { createdVia?: string | null } = {},
) {
  const content = DocContentSchema.parse(input);
  const doc = await requireDoc(userId, docId);
  assertEditable(doc);
  await validateContent(userId, content);

  await prisma.$transaction(async (tx: any) => {
    await writeItems(tx, docId, content.items);
    await tx.resumeDoc.update({
      where: { id: docId },
      data: {
        status: "draft",
        approvedAt: null,
        ...(content.sectionOrder
          ? { sectionOrder: JSON.stringify(content.sectionOrder) }
          : {}),
        ...(content.rationale !== undefined ? { rationale: content.rationale } : {}),
        ...(opts.createdVia ? { createdVia: opts.createdVia } : {}),
      },
    });
  });
  return getDocDetail(userId, docId);
}

const DocMetaSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  targetRole: z.string().trim().max(200).optional().nullable(),
  jobId: z.string().optional().nullable(),
});

export type DocMeta = z.input<typeof DocMetaSchema>;

async function assertJobOwned(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  });
  if (!job) throw new Error("Job not found");
}

export async function updateDocMeta(userId: string, docId: string, input: DocMeta) {
  const meta = DocMetaSchema.parse(input);
  const doc = await requireDoc(userId, docId);
  if (meta.jobId && meta.jobId !== doc.jobId) {
    assertEditable(doc);
    await assertJobOwned(userId, meta.jobId);
  }
  await prisma.resumeDoc.update({
    where: { id: docId },
    data: {
      ...(meta.name !== undefined ? { name: meta.name } : {}),
      ...(meta.targetRole !== undefined ? { targetRole: meta.targetRole || null } : {}),
      ...(meta.jobId !== undefined && doc.kind === "variant"
        ? { jobId: meta.jobId || null }
        : {}),
    },
  });
  return getDocDetail(userId, docId);
}

export async function createBase(
  userId: string,
  input: { name: string; targetRole?: string | null; sectionOrder?: ResumeSectionKey[] },
  content?: DocContent,
  opts: { createdVia?: string | null } = {},
) {
  const name = z.string().trim().min(1).max(120).parse(input.name);
  const doc = await prisma.resumeDoc.create({
    data: {
      userId,
      kind: "base",
      name,
      targetRole: input.targetRole?.trim() || null,
      sectionOrder: JSON.stringify(input.sectionOrder ?? DEFAULT_SECTION_ORDER),
      createdVia: opts.createdVia ?? null,
    },
  });
  if (content) return saveDocContent(userId, doc.id, content, opts);
  return getDocDetail(userId, doc.id);
}

function contentOf(doc: DocWithItems): z.infer<typeof DocContentSchema> {
  return {
    sectionOrder: parseSectionOrder(doc.sectionOrder),
    items: doc.items.map((item) => ({
      entryId: item.entryId,
      titleOverride: item.titleOverride,
      detailsOverride: item.detailsOverride,
      bullets: item.bullets.map((b) => ({ sourceId: b.sourceId, text: b.text })),
    })),
  };
}

// A variant starts as a copy of its base unless Claude supplies the tailored
// content directly.
export async function createVariant(
  userId: string,
  input: { baseId: string; jobId?: string | null; name?: string | null },
  content?: DocContent,
  opts: { createdVia?: string | null } = {},
) {
  const base = await requireDoc(userId, input.baseId);
  if (base.kind !== "base") throw new Error("Variants are created from a base version");

  let jobLabel: string | null = null;
  if (input.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, userId },
      select: { JobTitle: { select: { label: true } }, Company: { select: { label: true } } },
    });
    if (!job) throw new Error("Job not found");
    jobLabel = `${job.Company.label} ${job.JobTitle.label}`;
  }

  const name =
    input.name?.trim() || (jobLabel ? `${base.name} · ${jobLabel}` : `${base.name} variant`);

  const doc = await prisma.resumeDoc.create({
    data: {
      userId,
      kind: "variant",
      name: name.slice(0, 120),
      baseId: base.id,
      jobId: input.jobId ?? null,
      sectionOrder: base.sectionOrder,
      createdVia: opts.createdVia ?? null,
    },
  });
  return saveDocContent(userId, doc.id, content ?? contentOf(base), opts);
}

// The way to change a submitted resume: a fresh draft with the same content.
export async function duplicateDoc(userId: string, docId: string) {
  const source = await requireDoc(userId, docId);
  const doc = await prisma.resumeDoc.create({
    data: {
      userId,
      kind: source.kind,
      name: `${source.name} (copy)`.slice(0, 120),
      baseId: source.baseId,
      jobId: source.jobId,
      targetRole: source.targetRole,
      sectionOrder: source.sectionOrder,
      rationale: source.rationale,
    },
  });
  const content = contentOf(source);
  // Entries or bullets deleted since a submitted doc was frozen are dropped
  // from the copy instead of failing it.
  const liveEntries = new Set(
    (
      await prisma.bankEntry.findMany({
        where: { userId, id: { in: content.items.map((i) => i.entryId) } },
        select: { id: true },
      })
    ).map((e) => e.id),
  );
  content.items = content.items.filter((i) => liveEntries.has(i.entryId));
  return saveDocContent(userId, doc.id, content);
}

export async function approveDoc(userId: string, docId: string) {
  const doc = await requireDoc(userId, docId);
  if (doc.status !== "draft") throw new Error("Only a draft can be approved");
  if (doc.items.length === 0) throw new Error("An empty resume cannot be approved");
  await prisma.resumeDoc.update({
    where: { id: docId },
    data: { status: "approved", approvedAt: new Date() },
  });
  return getDocDetail(userId, docId);
}

export async function revokeApproval(userId: string, docId: string) {
  const doc = await requireDoc(userId, docId);
  if (doc.status !== "approved") throw new Error("This resume is not approved");
  await prisma.resumeDoc.update({
    where: { id: docId },
    data: { status: "draft", approvedAt: null },
  });
  return getDocDetail(userId, docId);
}

// Freezes the rendered content and records where the sent PDF was written.
// The PDF itself is produced by the caller, which owns the file layout.
export async function markDocSubmitted(
  userId: string,
  docId: string,
  rendered: RenderedResume,
  pdfPath: string | null,
) {
  const doc = await requireDoc(userId, docId);
  if (doc.kind !== "variant") throw new Error("Only a variant is submitted to a job");
  if (doc.status !== "approved") throw new Error("Approve the resume before submitting it");
  await prisma.resumeDoc.update({
    where: { id: docId },
    data: {
      status: "submitted",
      submittedAt: new Date(),
      snapshot: JSON.stringify(rendered),
      pdfPath,
    },
  });
  return getDocDetail(userId, docId);
}

export async function deleteDoc(userId: string, docId: string) {
  const doc = await requireDoc(userId, docId);
  await prisma.resumeDoc.delete({ where: { id: docId } });
  return { pdfPath: doc.pdfPath };
}
