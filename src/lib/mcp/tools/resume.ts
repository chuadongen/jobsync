import prisma from "@/lib/db";
import * as bank from "@/lib/resume/bank";
import * as docs from "@/lib/resume/docs";
import * as letters from "@/lib/resume/letters";
import { listDocuments } from "@/lib/files/documents";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { splitTags } from "@/models/bank.model";
import type { ResumeSectionKey } from "@/models/resume.model";

// Handlers for the resume tools. They read and write drafts only: approving
// and submitting are deliberately absent, so nothing Claude writes can become
// a file without the user signing off in the app.

type ToolResult = { content: Array<{ type: "text"; text: string }> };

const text = (value: string): ToolResult => ({ content: [{ type: "text", text: value }] });
const json = (value: unknown) => text(JSON.stringify(value, null, 1));

function appUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

// Every handler goes through here: one rate-limit check and one error shape.
async function guarded(userId: string, fn: () => Promise<ToolResult>): Promise<ToolResult> {
  const rate = checkMcpRateLimit(userId);
  if (!rate.allowed) {
    return text(`Rate limit exceeded. Try again in ${Math.ceil(rate.resetIn / 1000)}s.`);
  }
  try {
    return await fn();
  } catch (error: any) {
    return text(`Error: ${error?.message ?? "Unknown error"}`);
  }
}

const stripHtml = (html: string) =>
  html
    .replace(/<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function handleGetExperienceBank(input: { includeArchived?: boolean }, userId: string) {
  return guarded(userId, async () => {
    const [header, entries] = await Promise.all([
      bank.getResumeHeader(userId),
      bank.listBankEntries(userId, { includeArchived: input.includeArchived }),
    ]);
    return json({
      header,
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        organisation: e.organisation,
        title: e.title,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        details: e.details,
        notes: e.notes,
        tags: splitTags(e.tags),
        ...(e.archived ? { archived: true } : {}),
        bullets: e.bullets.map((b) => ({
          id: b.id,
          text: b.text,
          tags: splitTags(b.tags),
          ...(b.archived ? { archived: true } : {}),
        })),
      })),
    });
  });
}

export function handleListResumes(
  input: { kind?: "base" | "variant"; jobId?: string },
  userId: string,
) {
  return guarded(userId, async () => {
    const rows = await docs.listDocs(userId, input);
    return json(
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        status: r.status,
        targetRole: r.targetRole,
        base: r.base?.name ?? null,
        job: r.job ? `${r.job.JobTitle.label} at ${r.job.Company.label}` : null,
        jobId: r.jobId,
        items: r._count.items,
        updatedAt: r.updatedAt,
      })),
    );
  });
}

// Returned in the same shape save_resume_* accepts, so Claude can revise a
// resume by editing what it read.
export function handleGetResume(input: { resumeId: string }, userId: string) {
  return guarded(userId, async () => {
    const doc = await docs.getDocDetail(userId, input.resumeId);
    if (!doc) return text("Resume not found.");
    return json({
      id: doc.id,
      kind: doc.kind,
      name: doc.name,
      status: doc.status,
      targetRole: doc.targetRole,
      baseId: doc.baseId,
      jobId: doc.jobId,
      rationale: doc.rationale,
      sectionOrder: doc.sectionOrder,
      items: doc.rendered.sections.flatMap((section) =>
        section.items.map((item) => ({
          section: section.key,
          entryId: item.entryId,
          organisation: item.organisation,
          title: item.title,
          details: item.details,
          bullets: item.bullets.map((b) => ({
            sourceId: b.sourceId,
            text: b.text,
            ...(b.text !== b.sourceText ? { sourceText: b.sourceText } : {}),
          })),
        })),
      ),
    });
  });
}

export function handleGetJob(input: { jobId: string }, userId: string) {
  return guarded(userId, async () => {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, userId },
      select: {
        id: true,
        description: true,
        jobUrl: true,
        jobType: true,
        workplaceType: true,
        salaryRange: true,
        appliedDate: true,
        dueDate: true,
        startDate: true,
        endDate: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Location: { select: { label: true } },
        Status: { select: { label: true } },
        tags: { select: { label: true } },
        resumeDocs: { select: { id: true, name: true, status: true } },
        coverLetters: { select: { id: true, title: true, status: true } },
      },
    });
    if (!job) return text("Job not found.");
    return json({
      ...job,
      title: job.JobTitle.label,
      company: job.Company.label,
      location: job.Location?.label ?? null,
      status: job.Status.label,
      tags: job.tags.map((t) => t.label),
      description: stripHtml(job.description),
      JobTitle: undefined,
      Company: undefined,
      Location: undefined,
      Status: undefined,
    });
  });
}

export function handleSearchJobs(input: { query?: string; limit?: number }, userId: string) {
  return guarded(userId, async () => {
    const q = input.query?.trim();
    const jobs = await prisma.job.findMany({
      where: {
        userId,
        ...(q
          ? {
              OR: [
                { Company: { label: { contains: q } } },
                { JobTitle: { label: { contains: q } } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        createdAt: true,
        appliedDate: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Status: { select: { label: true } },
        _count: { select: { resumeDocs: true } },
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 15,
    });
    if (jobs.length === 0) {
      return text(q ? `No jobs match "${q}". Use add_job to save the posting first.` : "No jobs saved yet.");
    }
    return json(
      jobs.map((j) => ({
        id: j.id,
        title: j.JobTitle.label,
        company: j.Company.label,
        status: j.Status.label,
        appliedDate: j.appliedDate,
        resumes: j._count.resumeDocs,
      })),
    );
  });
}

type ItemsInput = docs.DocContent["items"];

function reviewNote(doc: { id: string; name: string; status: string }) {
  return (
    `Saved "${doc.name}" (id: ${doc.id}) as a ${doc.status}. ` +
    `It needs the user's approval in JobSync before any PDF exists: ${appUrl(`/dashboard/resumes/${doc.id}`)}`
  );
}

export function handleSaveResumeVariant(
  input: {
    variantId?: string;
    baseId?: string;
    jobId?: string;
    name?: string;
    rationale: string;
    sectionOrder?: string[];
    items: ItemsInput;
  },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    const content: docs.DocContent = {
      items: input.items,
      rationale: input.rationale,
      sectionOrder: input.sectionOrder as ResumeSectionKey[] | undefined,
    };

    if (input.variantId) {
      const existing = await docs.getDocDetail(userId, input.variantId);
      if (!existing || existing.kind !== "variant") return text("Variant not found.");
      const saved = await docs.saveDocContent(userId, existing.id, content, {
        createdVia: tokenName,
      });
      if (input.name) await docs.updateDocMeta(userId, existing.id, { name: input.name });
      return text(reviewNote({ ...saved!, name: input.name ?? saved!.name }));
    }

    if (!input.baseId || !input.jobId) {
      return text("Creating a variant needs both baseId and jobId. Use list_resumes and search_jobs to find them.");
    }
    const saved = await docs.createVariant(
      userId,
      { baseId: input.baseId, jobId: input.jobId, name: input.name },
      content,
      { createdVia: tokenName },
    );
    return text(reviewNote(saved!));
  });
}

export function handleSaveResumeBase(
  input: {
    baseId?: string;
    name?: string;
    targetRole?: string;
    rationale?: string;
    sectionOrder?: string[];
    items: ItemsInput;
  },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    const content: docs.DocContent = {
      items: input.items,
      rationale: input.rationale,
      sectionOrder: input.sectionOrder as ResumeSectionKey[] | undefined,
    };
    if (input.baseId) {
      const existing = await docs.getDocDetail(userId, input.baseId);
      if (!existing || existing.kind !== "base") return text("Base version not found.");
      if (input.name || input.targetRole !== undefined) {
        await docs.updateDocMeta(userId, existing.id, {
          name: input.name,
          targetRole: input.targetRole,
        });
      }
      const saved = await docs.saveDocContent(userId, existing.id, content, {
        createdVia: tokenName,
      });
      return text(reviewNote(saved!));
    }
    if (!input.name) return text("Creating a base version needs a name.");
    const saved = await docs.createBase(
      userId,
      { name: input.name, targetRole: input.targetRole },
      content,
      { createdVia: tokenName },
    );
    return text(reviewNote(saved!));
  });
}

export function handleSuggestBankAdditions(
  input: {
    suggestions: Array<{
      kind: "bullet" | "entry";
      entryId?: string;
      text?: string;
      tags?: string[];
      entry?: Record<string, unknown>;
      bullets?: Array<{ text: string; tags?: string[] }>;
      rationale?: string;
    }>;
  },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    const lines: string[] = [];
    for (const [i, s] of input.suggestions.entries()) {
      try {
        const payload =
          s.kind === "bullet"
            ? { kind: "bullet", text: s.text, tags: s.tags }
            : { kind: "entry", entry: s.entry, bullets: s.bullets ?? [] };
        await bank.createBankSuggestion(userId, {
          entryId: s.entryId,
          payload,
          rationale: s.rationale,
          createdVia: tokenName,
        });
        lines.push(`[${i + 1}] queued`);
      } catch (error: any) {
        lines.push(`[${i + 1}] rejected: ${error?.issues?.[0]?.message ?? error?.message}`);
      }
    }
    return text(
      `${lines.join("\n")}\nQueued suggestions wait for the user to accept them at ${appUrl("/dashboard/bank")}. They are not in the bank yet, so do not cite them as sources.`,
    );
  });
}

export function handleSaveCoverLetter(
  input: { letterId?: string; jobId?: string; title: string; content: string },
  userId: string,
  tokenName: string,
) {
  return guarded(userId, async () => {
    const saved = input.letterId
      ? await letters.updateLetter(userId, input.letterId, {
          title: input.title,
          content: input.content,
          jobId: input.jobId,
        })
      : input.jobId
        ? await letters.createLetter(
            userId,
            { title: input.title, content: input.content, jobId: input.jobId },
            { createdVia: tokenName },
          )
        : null;
    if (!saved) return text("Creating a cover letter needs a jobId.");
    return text(
      `Saved cover letter "${saved.title}" (id: ${saved.id}) as a draft. The user approves it at ${appUrl(`/dashboard/letters/${saved.id}`)}`,
    );
  });
}

export function handleListDocuments(
  input: { category?: string; jobId?: string },
  userId: string,
) {
  return guarded(userId, async () => {
    const rows = await listDocuments(userId, input);
    return json(
      rows.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        fileName: d.fileName,
        job: d.job ? `${d.job.JobTitle.label} at ${d.job.Company.label}` : null,
        notes: d.notes,
        uploadedAt: d.uploadedAt,
      })),
    );
  });
}
