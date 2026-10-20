"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Library, PlusCircle, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchInput } from "@/components/SearchInput";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import { importBankJson } from "@/actions/bank.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  BANK_ENTRY_TYPES,
  splitTags,
  type BankEntry,
  type BankEntryType,
  type BankSuggestion,
} from "@/models/bank.model";
import type { ResumeHeaderData } from "@/models/resume.model";
import { EntryCard } from "./EntryCard";
import { EntryDialog } from "./EntryDialog";
import { HeaderForm } from "./HeaderForm";
import { SuggestionsPanel } from "./SuggestionsPanel";

const TABS = ["entries", "suggestions", "contact"] as const;

type BankContainerProps = {
  entries: BankEntry[];
  suggestions: BankSuggestion[];
  header: ResumeHeaderData | null;
};

function matches(entry: BankEntry, q: string) {
  const haystack = [
    entry.organisation,
    entry.title,
    entry.details,
    entry.notes,
    entry.tags,
    ...entry.bullets.map((b) => `${b.text} ${b.tags}`),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function BankContainer({ entries, suggestions, header }: BankContainerProps) {
  const router = useRouter();
  const [tab, setTab] = useTabQueryParam(TABS, "entries");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{
    open: boolean;
    entry: BankEntry | null;
    type?: BankEntryType;
  }>({ open: false, entry: null });

  const refresh = () => router.refresh();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, startImport] = useTransition();

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    startImport(async () => {
      const result = await importBankJson(await file.text());
      if (fileInput.current) fileInput.current.value = "";
      if (!result.success) return toastError(result.message);
      const { entries: e, bullets, bases } = result.data;
      toastSuccess(`Imported ${e} entries, ${bullets} bullets and ${bases} base versions`);
      refresh();
    });
  };

  const grouped = useMemo(() => {
    const visible = entries.filter(
      (e) => (showArchived || !e.archived) && (!search.trim() || matches(e, search.trim())),
    );
    return (Object.keys(BANK_ENTRY_TYPES) as BankEntryType[])
      .map((type) => ({ type, entries: visible.filter((e) => e.type === type) }))
      .filter((g) => g.entries.length > 0);
  }, [entries, search, showArchived]);

  const totalBullets = entries.reduce((n, e) => n + e.bullets.length, 0);
  const tagCount = new Set(entries.flatMap((e) => splitTags(e.tags))).size;

  return (
    <div className="col-span-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experience Bank</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} entries · {totalBullets} bullets{tagCount ? ` · ${tagCount} tags` : ""}. Every resume line traces back to a bullet here.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import bank file"
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            disabled={importing}
            title="Add entries and base versions from a JobSync bank file. Existing entries are kept."
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/bank/export" title="Download the bank and base versions as a JSON file">
              <Download className="mr-2 h-4 w-4" /> Export
            </a>
          </Button>
          <Button onClick={() => setDialog({ open: true, entry: null })} data-testid="add-entry-btn">
            <PlusCircle className="mr-2 h-4 w-4" /> Add entry
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="suggestions">
            Suggestions
            {suggestions.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {suggestions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contact">Contact details</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search entries, bullets and tags..." />
            <div className="flex items-center gap-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm">
                Show archived
              </Label>
            </div>
          </div>

          {entries.length === 0 ? (
            <JobTabEmptyState
              icon={Library}
              title="Your bank is empty"
              description="Add your education, roles, projects and awards, or paste your resume into Claude and ask it to suggest bank entries."
              actionLabel="Add entry"
              onAction={() => setDialog({ open: true, entry: null })}
            />
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
          ) : (
            grouped.map(({ type, entries: group }) => (
              <section key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {BANK_ENTRY_TYPES[type].label}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialog({ open: true, entry: null, type })}
                  >
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <div className="grid gap-3 @5xl/main:grid-cols-2">
                  {group.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => setDialog({ open: true, entry })}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4">
          <SuggestionsPanel suggestions={suggestions} onChanged={refresh} />
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <HeaderForm header={header} onSaved={refresh} />
        </TabsContent>
      </Tabs>

      <EntryDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        entry={dialog.entry}
        defaultType={dialog.type}
        onSaved={refresh}
      />
    </div>
  );
}
