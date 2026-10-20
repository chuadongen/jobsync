import { z } from "zod";
import { BANK_ENTRY_TYPE_VALUES } from "./bank.model";
import { DOCUMENT_CATEGORY_VALUES } from "./document.model";
import { RESUME_SECTIONS } from "./resume.model";

// Raw input shapes for the resume tools. The SDK turns these into the JSON
// schema Claude sees, so the .describe() text is prompt surface: it is where
// the rules about provenance and approval reach the model.

const SECTION_KEYS = Object.keys(RESUME_SECTIONS) as [string, ...string[]];

const itemsField = z
  .array(
    z.object({
      entryId: z.string().describe("Bank entry id, from get_experience_bank."),
      titleOverride: z
        .string()
        .optional()
        .describe("Optional replacement for the printed role/degree line, e.g. a clearer title for this audience."),
      detailsOverride: z
        .string()
        .optional()
        .describe("Optional replacement for the printed details line(s) such as GPA, coursework or a skills list."),
      bullets: z
        .array(
          z.object({
            sourceId: z
              .string()
              .describe("Id of the bank bullet this line is written from. It must belong to the same entry."),
            text: z
              .string()
              .describe("The wording to print. Reword for impact and keywords, but never add facts, numbers, tools or scope the source bullet and entry notes do not support."),
          }),
        )
        .describe("Bullets in print order. Usually 2 to 4 per role on a one-page resume."),
    }),
  )
  .describe("Entries in print order within their sections. Section membership comes from each entry's type.");

const sectionOrderField = z
  .array(z.enum(SECTION_KEYS))
  .optional()
  .describe(`Section print order. Keys: ${SECTION_KEYS.join(", ")}. Omit to keep the current order.`);

export const McpGetBankInputShape = {
  includeArchived: z
    .boolean()
    .optional()
    .describe("Include entries and bullets the user archived. Default false."),
};

export const McpListResumesInputShape = {
  kind: z.enum(["base", "variant"]).optional().describe("Only bases or only variants."),
  jobId: z.string().optional().describe("Only resumes tailored to this job."),
};

export const McpGetResumeInputShape = {
  resumeId: z.string().describe("Resume id from list_resumes or a save result."),
};

export const McpGetJobInputShape = {
  jobId: z.string().describe("Job id."),
};

export const McpSearchJobsInputShape = {
  query: z
    .string()
    .optional()
    .describe("Matches company, job title or description text. Omit to list recent jobs."),
  limit: z.number().int().min(1).max(50).optional().describe("Default 15."),
};

export const McpSaveVariantInputShape = {
  variantId: z
    .string()
    .optional()
    .describe("Pass to revise an existing draft variant instead of creating a new one. Submitted variants cannot be changed."),
  baseId: z
    .string()
    .optional()
    .describe("Base version to derive from. Required when creating; pick the base whose targetRole fits the job best."),
  jobId: z.string().optional().describe("Job this variant targets. Required when creating."),
  name: z.string().optional().describe("Optional name. Defaults to '<base> · <company> <title>'."),
  rationale: z
    .string()
    .describe("Markdown shown to the user during review: what you emphasised and cut, which JD requirements each choice answers, and any gaps the bank could not cover."),
  sectionOrder: sectionOrderField,
  items: itemsField,
};

export const McpSaveBaseInputShape = {
  baseId: z.string().optional().describe("Pass to revise an existing base; omit to create a new one."),
  name: z.string().optional().describe("Short label such as 'PM' or 'SWE'. Required when creating."),
  targetRole: z
    .string()
    .optional()
    .describe("The kind of role this base aims at, used later to pick a base for a job."),
  rationale: z.string().optional().describe("Markdown note for the user on how this base is angled."),
  sectionOrder: sectionOrderField,
  items: itemsField,
};

const bulletSuggestion = z.object({
  text: z.string(),
  tags: z.array(z.string()).optional(),
});

export const McpSuggestBankInputShape = {
  suggestions: z
    .array(
      z.object({
        kind: z.enum(["bullet", "entry"]),
        entryId: z
          .string()
          .optional()
          .describe("For kind 'bullet': the existing entry the bullet belongs to."),
        text: z.string().optional().describe("For kind 'bullet': the bullet text."),
        tags: z.array(z.string()).optional().describe("For kind 'bullet': lower-case topic tags."),
        entry: z
          .object({
            type: z.enum(BANK_ENTRY_TYPE_VALUES),
            organisation: z.string(),
            title: z.string().optional(),
            location: z.string().optional(),
            startDate: z.string().optional().describe("As printed, e.g. 'Aug 2025'."),
            endDate: z.string().optional().describe("As printed, or 'Present'."),
            url: z.string().optional(),
            details: z.string().optional(),
            notes: z.string().optional().describe("Private context the user gave you; never printed."),
            tags: z.array(z.string()).optional(),
          })
          .optional()
          .describe("For kind 'entry': the new entry."),
        bullets: z.array(bulletSuggestion).optional().describe("For kind 'entry': its bullets."),
        rationale: z.string().optional().describe("Why this belongs in the bank."),
      }),
    )
    .min(1)
    .max(25)
    .describe("Proposed additions. Nothing enters the bank until the user accepts it in the app."),
};

export const McpSaveCoverLetterInputShape = {
  letterId: z.string().optional().describe("Pass to revise an existing draft letter."),
  jobId: z.string().optional().describe("Job the letter is for. Required when creating."),
  title: z.string().describe("Short title, e.g. 'Shopee Product Intern'."),
  content: z
    .string()
    .describe("Plain text with blank lines between paragraphs; **bold** is the only markup. No address block: the app prints the user's contact header. Same rule as resumes: no claims the bank does not support."),
};

export const McpListDocumentsInputShape = {
  category: z.enum(DOCUMENT_CATEGORY_VALUES).optional(),
  jobId: z.string().optional(),
};
