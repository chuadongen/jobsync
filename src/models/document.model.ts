export const DOCUMENT_CATEGORIES = {
  transcript: "Transcript",
  certificate: "Certificate",
  resume: "Resume",
  "cover-letter": "Cover Letter",
  portfolio: "Portfolio",
  recommendation: "Recommendation Letter",
  other: "Other",
} as const;

// What the vault accepts, by extension. Shared so the upload form's file
// picker offers the same list the server enforces.
export const DOCUMENT_FILE_TYPES = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".md": "text/markdown",
} as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = Object.keys(DOCUMENT_FILE_TYPES);

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
  filePath: string;
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
