// Date inputs speak "yyyy-mm-dd" in the viewer's own calendar. Parse and print
// in local time so a block entered as 1 Dec stays 1 Dec, matching the role
// dates the job form stores at local midnight.

export function toInputDate(value: Date | string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromInputDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export function formatSpan(start: Date | string, end: Date | string): string {
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
  const weeks = days / 7;
  const length = days < 14 ? `${days} days` : weeks < 9 ? `${Math.round(weeks)} weeks` : `${Math.round(days / 30.4)} months`;
  return `${formatDay(start)} – ${formatDay(end)} · ${length}`;
}
