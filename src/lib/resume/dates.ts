const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// Resume dates are typed as printed ("Aug 2025", "2023", "Mar 2022"), so
// ordering needs a best-effort parse. Anything unreadable sorts as unknown.
export function parseLooseDate(text: string | null | undefined): Date | null {
  if (!text) return null;
  const value = text.trim().toLowerCase();
  if (!value || value === "present" || value === "current") return null;

  const year = value.match(/(19|20)\d{2}/)?.[0];
  if (!year) return null;
  const month = MONTHS.findIndex((m) => value.includes(m));
  return new Date(Date.UTC(Number(year), month === -1 ? 0 : month, 1));
}

export function isPresent(text: string | null | undefined): boolean {
  const value = text?.trim().toLowerCase();
  return value === "present" || value === "current";
}

// "Aug 2025 - Present", "2023", or "" when neither end is known.
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = start?.trim();
  const e = end?.trim();
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s || e || "";
}
