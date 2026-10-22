// What a recruiter sees: the attachment name and the PDF's title. Internal
// names like "PM · Shopee Product Manager Intern" stay inside JobSync.
export function outgoingName(fullName: string | null | undefined, kind: "Resume" | "Cover Letter") {
  const name = fullName?.trim();
  return name ? `${name} - ${kind}` : kind;
}
