// Shared types for base versions, JD variants and cover letters. Every
// approval-gated document moves draft -> approved -> submitted, and only an
// approved or submitted one can be exported.

export const DOC_STATUSES = {
  draft: "Draft",
  approved: "Approved",
  submitted: "Submitted",
} as const;

export type DocStatus = keyof typeof DOC_STATUSES;

export type ResumeDocKind = "base" | "variant";

export function isExportable(status: string): boolean {
  return status === "approved" || status === "submitted";
}

export function docStatusLabel(status: string): string {
  return DOC_STATUSES[status as DocStatus] ?? status;
}

// Print order of a resume. A base sets its own order; a variant inherits it.
export const RESUME_SECTIONS = {
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  leadership: "Leadership & Activities",
  awards: "Awards",
  certifications: "Certifications",
  skills: "Skills & Others",
} as const;

export type ResumeSectionKey = keyof typeof RESUME_SECTIONS;

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  "education",
  "experience",
  "projects",
  "leadership",
  "awards",
  "certifications",
  "skills",
];

export interface ResumeHeaderLink {
  label: string;
  url: string;
}

export interface ResumeHeaderData {
  fullName: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  links: ResumeHeaderLink[];
}

// The fully resolved content of a doc, used by the editor preview, the PDF
// renderer and the frozen snapshot alike.
export interface RenderedBullet {
  id: string;
  sourceId: string;
  text: string;
  // The source wording, so review can show what was changed
  sourceText: string;
}

export interface RenderedItem {
  id: string;
  entryId: string;
  organisation: string;
  title: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  details: string | null;
  url: string | null;
  bullets: RenderedBullet[];
}

export interface RenderedSection {
  key: ResumeSectionKey;
  heading: string;
  items: RenderedItem[];
}

export interface RenderedResume {
  header: ResumeHeaderData;
  sections: RenderedSection[];
}

export interface ResumeDocSummary {
  id: string;
  kind: ResumeDocKind;
  name: string;
  status: DocStatus;
  targetRole: string | null;
  baseId: string | null;
  jobId: string | null;
  updatedAt: Date;
  base?: { id: string; name: string } | null;
  job?: {
    id: string;
    JobTitle: { label: string };
    Company: { label: string };
  } | null;
  _count?: { items: number; variants?: number };
}

export interface ResumeDocDetail extends ResumeDocSummary {
  sectionOrder: ResumeSectionKey[];
  rationale: string | null;
  approvedAt: Date | null;
  submittedAt: Date | null;
  pdfPath: string | null;
  createdVia: string | null;
  rendered: RenderedResume;
}

export interface CoverLetterSummary {
  id: string;
  title: string;
  status: DocStatus;
  jobId: string | null;
  updatedAt: Date;
  job?: {
    id: string;
    JobTitle: { label: string };
    Company: { label: string };
  } | null;
}

export interface CoverLetterDetail extends CoverLetterSummary {
  content: string;
  approvedAt: Date | null;
  submittedAt: Date | null;
  pdfPath: string | null;
  createdVia: string | null;
}
