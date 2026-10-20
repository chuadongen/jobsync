import { z } from "zod";
import prisma from "@/lib/db";
import {
  BANK_ENTRY_TYPE_VALUES,
  ResumeHeaderFormSchema,
  splitTags,
} from "@/models/bank.model";
import { RESUME_SECTIONS } from "@/models/resume.model";
import { createBankBullet, createBankEntry, getResumeHeader, saveResumeHeader } from "./bank";
import { createBase, parseSectionOrder } from "./docs";

// A portable copy of the experience bank and base versions. Entries and
// bullets carry file-local keys so bases can point at them; on import those
// keys are mapped to the new database ids. Export uses the ids as keys, so a
// file round-trips into another JobSync.

const SECTION_KEYS = Object.keys(RESUME_SECTIONS) as [string, ...string[]];

export const PortableBankSchema = z.object({
  version: z.literal(1),
  header: ResumeHeaderFormSchema.nullable().optional(),
  entries: z
    .array(
      z.object({
        key: z.string().min(1),
        type: z.enum(BANK_ENTRY_TYPE_VALUES),
        organisation: z.string().min(1),
        title: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        details: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        tags: z.array(z.string()).default([]),
        archived: z.boolean().optional(),
        bullets: z
          .array(
            z.object({
              key: z.string().min(1),
              text: z.string().min(3),
              tags: z.array(z.string()).default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  bases: z
    .array(
      z.object({
        name: z.string().min(1),
        targetRole: z.string().nullable().optional(),
        sectionOrder: z.array(z.enum(SECTION_KEYS)).optional(),
        items: z.array(
          z.object({
            entry: z.string(),
            titleOverride: z.string().nullable().optional(),
            detailsOverride: z.string().nullable().optional(),
            // A bullet key, or { key, text } to print it reworded
            bullets: z
              .array(z.union([z.string(), z.object({ key: z.string(), text: z.string() })]))
              .default([]),
          }),
        ),
      }),
    )
    .default([]),
});

export type PortableBank = z.infer<typeof PortableBankSchema>;

export async function exportBank(userId: string): Promise<PortableBank> {
  const [header, entries, bases] = await Promise.all([
    getResumeHeader(userId),
    prisma.bankEntry.findMany({
      where: { userId },
      include: { bullets: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { startSort: "desc" }],
    }),
    prisma.resumeDoc.findMany({
      where: { userId, kind: "base" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { bullets: { orderBy: { sortOrder: "asc" } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    version: 1,
    header,
    entries: entries.map((e) => ({
      key: e.id,
      type: e.type as PortableBank["entries"][number]["type"],
      organisation: e.organisation,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      url: e.url,
      details: e.details,
      notes: e.notes,
      tags: splitTags(e.tags),
      archived: e.archived,
      bullets: e.bullets.map((b) => ({ key: b.id, text: b.text, tags: splitTags(b.tags) })),
    })),
    bases: bases.map((b) => ({
      name: b.name,
      targetRole: b.targetRole,
      sectionOrder: parseSectionOrder(b.sectionOrder),
      items: b.items.map((item) => ({
        entry: item.entryId,
        titleOverride: item.titleOverride,
        detailsOverride: item.detailsOverride,
        bullets: item.bullets.map((bullet) => ({ key: bullet.sourceId, text: bullet.text })),
      })),
    })),
  };
}

// Appends; it never merges with or replaces what is already in the bank.
// Every reference is checked before anything is written.
export async function importBank(userId: string, raw: unknown) {
  const data = PortableBankSchema.parse(raw);

  const entryKeys = new Set(data.entries.map((e) => e.key));
  const bulletOwner = new Map<string, string>();
  for (const entry of data.entries) {
    for (const bullet of entry.bullets) {
      if (bulletOwner.has(bullet.key)) throw new Error(`Bullet key "${bullet.key}" is used twice`);
      bulletOwner.set(bullet.key, entry.key);
    }
  }
  if (entryKeys.size !== data.entries.length) throw new Error("Entry keys must be unique");
  for (const base of data.bases) {
    for (const item of base.items) {
      if (!entryKeys.has(item.entry)) {
        throw new Error(`Base "${base.name}" refers to unknown entry "${item.entry}"`);
      }
      for (const ref of item.bullets) {
        const key = typeof ref === "string" ? ref : ref.key;
        if (bulletOwner.get(key) !== item.entry) {
          throw new Error(`Base "${base.name}" uses bullet "${key}" outside entry "${item.entry}"`);
        }
      }
    }
  }

  if (data.header) await saveResumeHeader(userId, data.header);

  const entryIds = new Map<string, string>();
  const bulletIds = new Map<string, string>();
  for (const [sortOrder, entry] of data.entries.entries()) {
    const created = await createBankEntry(userId, {
      type: entry.type,
      organisation: entry.organisation,
      title: entry.title,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      url: entry.url,
      details: entry.details,
      notes: entry.notes,
      tags: entry.tags,
    });
    await prisma.bankEntry.update({
      where: { id: created.id },
      data: { sortOrder, archived: entry.archived ?? false },
    });
    entryIds.set(entry.key, created.id);
    for (const bullet of entry.bullets) {
      const b = await createBankBullet(userId, {
        entryId: created.id,
        text: bullet.text,
        tags: bullet.tags,
      });
      bulletIds.set(bullet.key, b.id);
    }
  }

  const textOf = new Map(data.entries.flatMap((e) => e.bullets.map((b) => [b.key, b.text] as const)));
  for (const base of data.bases) {
    await createBase(
      userId,
      { name: base.name, targetRole: base.targetRole, sectionOrder: base.sectionOrder as any },
      {
        items: base.items.map((item) => ({
          entryId: entryIds.get(item.entry)!,
          titleOverride: item.titleOverride,
          detailsOverride: item.detailsOverride,
          bullets: item.bullets.map((ref) =>
            typeof ref === "string"
              ? { sourceId: bulletIds.get(ref)!, text: textOf.get(ref)! }
              : { sourceId: bulletIds.get(ref.key)!, text: ref.text },
          ),
        })),
      },
    );
  }

  return {
    entries: data.entries.length,
    bullets: bulletIds.size,
    bases: data.bases.length,
    header: Boolean(data.header),
  };
}
