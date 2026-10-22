import prisma from "@/lib/db";
import {
  BankBulletFormSchema,
  BankEntryFormSchema,
  BankSuggestionPayloadSchema,
  ResumeHeaderFormSchema,
  joinTags,
  type BankBulletForm,
  type BankEntryForm,
  type BankSuggestion,
  type BankSuggestionPayload,
  type ResumeHeaderForm,
} from "@/models/bank.model";
import type { ResumeHeaderData } from "@/models/resume.model";
import { parseLooseDate } from "./dates";

// Core bank logic, keyed by userId so both the server actions (session user)
// and the MCP tools (token user) go through the same ownership checks.

export const BANK_ENTRY_INCLUDE = {
  bullets: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
};

// Newest first within a type by default: that is how a resume reads.
const ENTRY_ORDER = [
  { sortOrder: "asc" as const },
  { startSort: "desc" as const },
  { createdAt: "asc" as const },
];

export async function listBankEntries(
  userId: string,
  opts: { includeArchived?: boolean } = {},
) {
  return prisma.bankEntry.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
    include: {
      bullets: {
        where: opts.includeArchived ? {} : { archived: false },
        orderBy: BANK_ENTRY_INCLUDE.bullets.orderBy,
      },
    },
    orderBy: ENTRY_ORDER,
  });
}

export async function assertEntryOwned(userId: string, entryId: string) {
  const entry = await prisma.bankEntry.findFirst({
    where: { id: entryId, userId },
    select: { id: true },
  });
  if (!entry) throw new Error("Bank entry not found");
  return entry;
}

async function assertBulletOwned(userId: string, bulletId: string) {
  const bullet = await prisma.bankBullet.findFirst({
    where: { id: bulletId, entry: { userId } },
    select: { id: true, entryId: true },
  });
  if (!bullet) throw new Error("Bullet not found");
  return bullet;
}

function entryData(form: ReturnType<typeof BankEntryFormSchema.parse>) {
  const { id: _id, tags, ...rest } = form;
  return {
    ...rest,
    tags: joinTags(tags),
    startSort: parseLooseDate(rest.startDate),
  };
}

export async function createBankEntry(userId: string, input: BankEntryForm) {
  const form = BankEntryFormSchema.parse(input);
  return prisma.bankEntry.create({
    data: { ...entryData(form), userId },
    include: BANK_ENTRY_INCLUDE,
  });
}

export async function updateBankEntry(userId: string, input: BankEntryForm) {
  const form = BankEntryFormSchema.parse(input);
  if (!form.id) throw new Error("Entry id is required");
  await assertEntryOwned(userId, form.id);
  return prisma.bankEntry.update({
    where: { id: form.id },
    data: entryData(form),
    include: BANK_ENTRY_INCLUDE,
  });
}

export async function setBankEntryArchived(
  userId: string,
  entryId: string,
  archived: boolean,
) {
  await assertEntryOwned(userId, entryId);
  return prisma.bankEntry.update({
    where: { id: entryId },
    data: { archived },
  });
}

// How many resumes would lose this entry, so the UI can warn before deleting.
export async function countEntryUsage(userId: string, entryId: string) {
  await assertEntryOwned(userId, entryId);
  return prisma.resumeItem.count({ where: { entryId } });
}

export async function deleteBankEntry(userId: string, entryId: string) {
  await assertEntryOwned(userId, entryId);
  await prisma.bankEntry.delete({ where: { id: entryId } });
}

export async function reorderBankEntries(userId: string, orderedIds: string[]) {
  const owned = await prisma.bankEntry.count({
    where: { userId, id: { in: orderedIds } },
  });
  if (owned !== new Set(orderedIds).size) throw new Error("Bank entry not found");
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) =>
      prisma.bankEntry.update({ where: { id }, data: { sortOrder } }),
    ),
  );
}

export async function createBankBullet(userId: string, input: BankBulletForm) {
  const form = BankBulletFormSchema.parse(input);
  await assertEntryOwned(userId, form.entryId);
  const last = await prisma.bankBullet.findFirst({
    where: { entryId: form.entryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return prisma.bankBullet.create({
    data: {
      entryId: form.entryId,
      text: form.text,
      tags: joinTags(form.tags),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}

// Changing a bank bullet never rewrites resumes: each resume keeps its own
// wording, and the source link is what lets review show the difference.
export async function updateBankBullet(userId: string, input: BankBulletForm) {
  const form = BankBulletFormSchema.parse(input);
  if (!form.id) throw new Error("Bullet id is required");
  const bullet = await assertBulletOwned(userId, form.id);
  if (bullet.entryId !== form.entryId) {
    throw new Error("A bullet cannot move to another entry");
  }
  return prisma.bankBullet.update({
    where: { id: form.id },
    data: { text: form.text, tags: joinTags(form.tags) },
  });
}

export async function setBankBulletArchived(
  userId: string,
  bulletId: string,
  archived: boolean,
) {
  await assertBulletOwned(userId, bulletId);
  return prisma.bankBullet.update({
    where: { id: bulletId },
    data: { archived },
  });
}

export async function deleteBankBullet(userId: string, bulletId: string) {
  await assertBulletOwned(userId, bulletId);
  await prisma.bankBullet.delete({ where: { id: bulletId } });
}

export async function reorderBankBullets(
  userId: string,
  entryId: string,
  orderedIds: string[],
) {
  await assertEntryOwned(userId, entryId);
  const owned = await prisma.bankBullet.count({
    where: { entryId, id: { in: orderedIds } },
  });
  if (owned !== new Set(orderedIds).size) throw new Error("Bullet not found");
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) =>
      prisma.bankBullet.update({ where: { id }, data: { sortOrder } }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function parseSuggestion(row: any): BankSuggestion {
  let payload: BankSuggestionPayload;
  try {
    payload = BankSuggestionPayloadSchema.parse(JSON.parse(row.payload));
  } catch {
    // A row that no longer parses is shown as an empty bullet rather than
    // breaking the whole list; rejecting it is the only sensible action.
    payload = { kind: "bullet", text: "(unreadable suggestion)" };
  }
  return { ...row, payload };
}

export async function createBankSuggestion(
  userId: string,
  input: {
    entryId?: string | null;
    payload: unknown;
    rationale?: string | null;
    createdVia?: string | null;
  },
) {
  const payload = BankSuggestionPayloadSchema.parse(input.payload);
  if (payload.kind === "bullet") {
    if (!input.entryId) throw new Error("A bullet suggestion needs an entryId");
    await assertEntryOwned(userId, input.entryId);
  }
  const row = await prisma.bankSuggestion.create({
    data: {
      userId,
      entryId: payload.kind === "bullet" ? input.entryId : null,
      payload: JSON.stringify(payload),
      rationale: input.rationale ?? null,
      createdVia: input.createdVia ?? null,
    },
  });
  return parseSuggestion(row);
}

export async function listBankSuggestions(
  userId: string,
  status: "pending" | "accepted" | "rejected" = "pending",
) {
  const rows = await prisma.bankSuggestion.findMany({
    where: { userId, status },
    include: { entry: { select: { id: true, organisation: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(parseSuggestion);
}

export async function countPendingSuggestions(userId: string) {
  return prisma.bankSuggestion.count({ where: { userId, status: "pending" } });
}

async function assertPendingSuggestion(userId: string, id: string) {
  const row = await prisma.bankSuggestion.findFirst({
    where: { id, userId },
  });
  if (!row) throw new Error("Suggestion not found");
  if (row.status !== "pending") throw new Error("Suggestion was already decided");
  return parseSuggestion(row);
}

// The user may edit the payload before accepting; whatever they accept is
// what enters the bank.
export async function acceptBankSuggestion(
  userId: string,
  id: string,
  editedPayload?: unknown,
) {
  const suggestion = await assertPendingSuggestion(userId, id);
  const payload = editedPayload
    ? BankSuggestionPayloadSchema.parse(editedPayload)
    : suggestion.payload;

  if (payload.kind === "bullet") {
    if (!suggestion.entryId) throw new Error("Suggestion has no entry");
    await createBankBullet(userId, {
      entryId: suggestion.entryId,
      text: payload.text,
      tags: payload.tags,
    });
  } else {
    const entry = await createBankEntry(userId, payload.entry);
    for (const bullet of payload.bullets) {
      await createBankBullet(userId, {
        entryId: entry.id,
        text: bullet.text,
        tags: bullet.tags,
      });
    }
  }

  await prisma.bankSuggestion.update({
    where: { id },
    data: {
      status: "accepted",
      decidedAt: new Date(),
      payload: JSON.stringify(payload),
    },
  });
}

export async function rejectBankSuggestion(userId: string, id: string) {
  await assertPendingSuggestion(userId, id);
  await prisma.bankSuggestion.update({
    where: { id },
    data: { status: "rejected", decidedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Resume header
// ---------------------------------------------------------------------------

export async function getResumeHeader(
  userId: string,
): Promise<ResumeHeaderData | null> {
  const row = await prisma.resumeHeader.findUnique({ where: { userId } });
  if (!row) return null;
  let links: ResumeHeaderData["links"] = [];
  try {
    links = JSON.parse(row.links);
  } catch {
    links = [];
  }
  return {
    fullName: row.fullName,
    location: row.location,
    email: row.email,
    phone: row.phone,
    links,
  };
}

export async function saveResumeHeader(userId: string, input: ResumeHeaderForm) {
  const form = ResumeHeaderFormSchema.parse(input);
  const data = { ...form, links: JSON.stringify(form.links) };
  await prisma.resumeHeader.upsert({
    where: { userId },
    update: data,
    create: { ...data, userId },
  });
  return getResumeHeader(userId);
}
