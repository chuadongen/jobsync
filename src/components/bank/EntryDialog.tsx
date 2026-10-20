"use client";
import { useEffect, useState, useTransition } from "react";
import { Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBankEntry, updateBankEntry } from "@/actions/bank.actions";
import { toastActionResult } from "@/lib/toast";
import {
  BANK_ENTRY_TYPES,
  splitTags,
  type BankEntry,
  type BankEntryType,
} from "@/models/bank.model";

type EntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: BankEntry | null;
  defaultType?: BankEntryType;
  onSaved: () => void;
};

// Field labels change with the entry type so each one reads naturally:
// a degree is not a "role", and a skills line has no dates.
const LABELS: Record<BankEntryType, { organisation: string; title?: string; details?: string }> = {
  education: { organisation: "School", title: "Degree or qualification", details: "Details (GPA, honours, coursework)" },
  experience: { organisation: "Organisation", title: "Role", details: "Details (optional extra line)" },
  project: { organisation: "Project name", title: "Your role", details: "Details (stack, link text)" },
  leadership: { organisation: "Organisation", title: "Position", details: "Details" },
  award: { organisation: "Award or competition", title: "Placing or recognition", details: "Details" },
  certification: { organisation: "Certification", title: "Issuer", details: "Details (credential ID)" },
  skill: { organisation: "Label (e.g. Technical)", details: "Skills, comma separated" },
};

const empty = (type: BankEntryType) => ({
  type,
  organisation: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  url: "",
  details: "",
  notes: "",
  tags: "",
});

export function EntryDialog({
  open,
  onOpenChange,
  entry,
  defaultType = "experience",
  onSaved,
}: EntryDialogProps) {
  const [form, setForm] = useState(empty(defaultType));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setForm(
      entry
        ? {
            type: entry.type,
            organisation: entry.organisation,
            title: entry.title ?? "",
            location: entry.location ?? "",
            startDate: entry.startDate ?? "",
            endDate: entry.endDate ?? "",
            url: entry.url ?? "",
            details: entry.details ?? "",
            notes: entry.notes ?? "",
            tags: splitTags(entry.tags).join(", "),
          }
        : empty(defaultType),
    );
  }, [open, entry, defaultType]);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const labels = LABELS[form.type];
  const isSkill = form.type === "skill";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = { ...form, ...(entry ? { id: entry.id } : {}) };
      const result = entry ? await updateBankEntry(payload) : await createBankEntry(payload);
      toastActionResult(result, {
        success: entry ? "Entry updated" : "Entry added to your bank",
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
        },
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "Add to your experience bank"}</DialogTitle>
          <DialogDescription>
            Record everything here, even what no single resume would use. Bullets are added on the entry once it is saved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-type">Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type")(v)}>
              <SelectTrigger id="entry-type" aria-label="Entry type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BANK_ENTRY_TYPES).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-organisation">{labels.organisation}</Label>
            <Input
              id="entry-organisation"
              value={form.organisation}
              onChange={(e) => set("organisation")(e.target.value)}
              required
            />
          </div>
          {labels.title && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-title">{labels.title}</Label>
              <Input id="entry-title" value={form.title} onChange={(e) => set("title")(e.target.value)} />
            </div>
          )}
          {!isSkill && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-location">Location</Label>
              <Input
                id="entry-location"
                value={form.location}
                placeholder="Singapore"
                onChange={(e) => set("location")(e.target.value)}
              />
            </div>
          )}
          {!isSkill && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-start">Start</Label>
                <Input
                  id="entry-start"
                  value={form.startDate}
                  placeholder="Aug 2025"
                  onChange={(e) => set("startDate")(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-end">End</Label>
                <Input
                  id="entry-end"
                  value={form.endDate}
                  placeholder="Present"
                  onChange={(e) => set("endDate")(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="entry-details">{labels.details}</Label>
            <Textarea
              id="entry-details"
              value={form.details}
              rows={isSkill ? 2 : 2}
              onChange={(e) => set("details")(e.target.value)}
            />
          </div>
          {!isSkill && (
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="entry-url">Link</Label>
              <Input id="entry-url" value={form.url} onChange={(e) => set("url")(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="entry-notes">Private notes for Claude</Label>
            <Textarea
              id="entry-notes"
              value={form.notes}
              rows={3}
              placeholder="Context, numbers and stories behind this entry. Never printed, but Claude may use it to word bullets honestly."
              onChange={(e) => set("notes")(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="entry-tags">Tags</Label>
            <Input
              id="entry-tags"
              value={form.tags}
              placeholder="pm, swe, cloud, leadership"
              onChange={(e) => set("tags")(e.target.value)}
            />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="save-entry-btn">
              Save
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
