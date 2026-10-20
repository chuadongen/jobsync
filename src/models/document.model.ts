export const DOCUMENT_CATEGORIES = {
  transcript: "Transcript",
  certificate: "Certificate",
  resume: "Resume",
  "cover-letter": "Cover Letter",
  portfolio: "Portfolio",
  recommendation: "Recommendation Letter",
  other: "Other",
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export const DOCUMENT_CATEGORY_VALUES = Object.keys(DOCUMENT_CATEGORIES) as [
  DocumentCategory,
  ...DocumentCategory[],
];

export function documentCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORIES[category as DocumentCategory] ?? category;
}

export interface VaultDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  uploadedAt: Date;
  jobId: string | null;
  job?: {
    id: string;
    JobTitle: { label: string };
    Company: { label: string };
  } | null;
}
