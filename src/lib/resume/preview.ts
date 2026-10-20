import { sectionForEntryType, type BankEntry } from "@/models/bank.model";
import {
  RESUME_SECTIONS,
  type RenderedResume,
  type ResumeHeaderData,
  type ResumeSectionKey,
} from "@/models/resume.model";

// The editor's working copy of a resume: the same shape saveDocContent takes.
export interface EditableItem {
  entryId: string;
  titleOverride: string | null;
  detailsOverride: string | null;
  bullets: { sourceId: string; text: string }[];
}

export interface EditableContent {
  sectionOrder: ResumeSectionKey[];
  items: EditableItem[];
}

// Mirrors renderDoc on the server so the preview matches the PDF while the
// user edits, without a round trip per keystroke.
export function renderEditable(
  content: EditableContent,
  entries: Map<string, BankEntry>,
  header: ResumeHeaderData,
): RenderedResume {
  const bySection = new Map<ResumeSectionKey, RenderedResume["sections"][number]["items"]>();
  content.items.forEach((item, index) => {
    const entry = entries.get(item.entryId);
    if (!entry) return;
    const key = sectionForEntryType(entry.type);
    if (!key) return;
    const sourceText = new Map(entry.bullets.map((b) => [b.id, b.text]));
    const list = bySection.get(key) ?? [];
    list.push({
      id: `${item.entryId}-${index}`,
      entryId: item.entryId,
      organisation: entry.organisation,
      title: item.titleOverride || entry.title,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      details: item.detailsOverride || entry.details,
      url: entry.url,
      bullets: item.bullets.map((b, i) => ({
        id: `${b.sourceId}-${i}`,
        sourceId: b.sourceId,
        text: b.text,
        sourceText: sourceText.get(b.sourceId) ?? "",
      })),
    });
    bySection.set(key, list);
  });
  return {
    header,
    sections: content.sectionOrder
      .filter((key) => (bySection.get(key)?.length ?? 0) > 0)
      .map((key) => ({ key, heading: RESUME_SECTIONS[key], items: bySection.get(key)! })),
  };
}

// Items grouped by section in print order, keeping each item's index into
// content.items so edits can address it.
export function groupBySection(
  content: EditableContent,
  entries: Map<string, BankEntry>,
): { key: ResumeSectionKey; items: { item: EditableItem; index: number }[] }[] {
  return content.sectionOrder.map((key) => ({
    key,
    items: content.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const entry = entries.get(item.entryId);
        return entry && sectionForEntryType(entry.type) === key;
      }),
  }));
}
