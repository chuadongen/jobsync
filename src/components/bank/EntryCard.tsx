"use client";
import { useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import {
  createBankBullet,
  deleteBankBullet,
  deleteBankEntry,
  getBankEntryUsage,
  reorderBankBullets,
  setBankBulletArchived,
  setBankEntryArchived,
  updateBankBullet,
} from "@/actions/bank.actions";
import { toastActionResult, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatDateRange } from "@/lib/resume/dates";
import { splitTags, type BankBullet, type BankEntry } from "@/models/bank.model";

type EntryCardProps = {
  entry: BankEntry;
  onEdit: () => void;
  onChanged: () => void;
};

function BulletEditor({
  initial,
  initialTags,
  onSave,
  onCancel,
  pending,
}: {
  initial: string;
  initialTags: string;
  onSave: (text: string, tags: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [text, setText] = useState(initial);
  const [tags, setTags] = useState(initialTags);
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2">
      <Textarea
        autoFocus
        value={text}
        rows={2}
        aria-label="Bullet text"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(text, tags);
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="flex items-center gap-2">
        <Input
          value={tags}
          placeholder="Tags, comma separated"
          aria-label="Bullet tags"
          className="h-8 text-xs"
          onChange={(e) => setTags(e.target.value)}
        />
        <Button size="sm" disabled={pending || text.trim().length < 3} onClick={() => onSave(text, tags)}>
          <Check className="mr-1 h-3.5 w-3.5" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Cancel</span>
        </Button>
      </div>
    </div>
  );
}

export function EntryCard({ entry, onEdit, onChanged }: EntryCardProps) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deleteState, setDeleteState] = useState<{ open: boolean; usage: number }>({
    open: false,
    usage: 0,
  });
  const [isPending, startTransition] = useTransition();

  const dates = formatDateRange(entry.startDate, entry.endDate);
  const isSkill = entry.type === "skill";

  const saveBullet = (bullet: BankBullet | null, text: string, tags: string) =>
    startTransition(async () => {
      const result = bullet
        ? await updateBankBullet({ id: bullet.id, entryId: entry.id, text, tags })
        : await createBankBullet({ entryId: entry.id, text, tags });
      toastActionResult(result, {
        success: bullet ? "Bullet updated" : "Bullet added",
        onSuccess: () => {
          setEditingId(null);
          onChanged();
        },
      });
    });

  const moveBullet = (index: number, delta: number) =>
    startTransition(async () => {
      const ids = entry.bullets.map((b) => b.id);
      const target = index + delta;
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      const result = await reorderBankBullets(entry.id, ids);
      if (result.success) onChanged();
      else toastError(result.message);
    });

  const toggleBulletArchive = (bullet: BankBullet) =>
    startTransition(async () => {
      const result = await setBankBulletArchived(bullet.id, !bullet.archived);
      toastActionResult(result, {
        success: bullet.archived ? "Bullet restored" : "Bullet archived",
        onSuccess: onChanged,
      });
    });

  const removeBullet = (bullet: BankBullet) =>
    startTransition(async () => {
      const result = await deleteBankBullet(bullet.id);
      toastActionResult(result, { success: "Bullet deleted", onSuccess: onChanged });
    });

  const toggleEntryArchive = () =>
    startTransition(async () => {
      const result = await setBankEntryArchived(entry.id, !entry.archived);
      toastActionResult(result, {
        success: entry.archived ? "Entry restored" : "Entry archived. It stays on resumes that already use it.",
        onSuccess: onChanged,
      });
    });

  const askDelete = () =>
    startTransition(async () => {
      const result = await getBankEntryUsage(entry.id);
      setDeleteState({ open: true, usage: result.success ? result.data : 0 });
    });

  const confirmDelete = () =>
    startTransition(async () => {
      const result = await deleteBankEntry(entry.id);
      toastActionResult(result, { success: "Entry deleted", onSuccess: onChanged });
    });

  return (
    <Card className={cn(entry.archived && "opacity-60")} data-testid="bank-entry">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="font-semibold">{entry.organisation}</h3>
              {entry.title && <span className="text-muted-foreground">{entry.title}</span>}
              {entry.archived && <Badge variant="outline">Archived</Badge>}
            </div>
            {(dates || entry.location) && (
              <p className="text-sm text-muted-foreground">
                {[dates, entry.location].filter(Boolean).join(" · ")}
              </p>
            )}
            {entry.details && (
              <p className="mt-1 whitespace-pre-wrap text-sm">{entry.details}</p>
            )}
            {splitTags(entry.tags).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {splitTags(entry.tags).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`Actions for ${entry.organisation}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit entry
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleEntryArchive}>
                {entry.archived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={askDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {entry.notes && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium">Notes for Claude:</span> {entry.notes}
          </p>
        )}

        {!isSkill && (
          <ul className="space-y-1.5">
            {entry.bullets.map((bullet, index) =>
              editingId === bullet.id ? (
                <li key={bullet.id}>
                  <BulletEditor
                    initial={bullet.text}
                    initialTags={splitTags(bullet.tags).join(", ")}
                    pending={isPending}
                    onSave={(text, tags) => saveBullet(bullet, text, tags)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li
                  key={bullet.id}
                  className={cn(
                    "group flex items-start gap-2 text-sm",
                    bullet.archived && "text-muted-foreground line-through",
                  )}
                >
                  <span className="mt-0.5 select-none">•</span>
                  <span className="flex-1">
                    {bullet.text}
                    {splitTags(bullet.tags).map((tag) => (
                      <Badge key={tag} variant="outline" className="ml-1.5 px-1 py-0 text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                  <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Move up" onClick={() => moveBullet(index, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Move down" onClick={() => moveBullet(index, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Edit bullet" onClick={() => setEditingId(bullet.id)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={bullet.archived ? "Restore bullet" : "Archive bullet"} onClick={() => toggleBulletArchive(bullet)}>
                      {bullet.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" aria-label="Delete bullet" onClick={() => removeBullet(bullet)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </span>
                </li>
              ),
            )}
            {editingId === "new" ? (
              <li>
                <BulletEditor
                  initial=""
                  initialTags=""
                  pending={isPending}
                  onSave={(text, tags) => saveBullet(null, text, tags)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  onClick={() => setEditingId("new")}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add bullet
                </Button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
      <DeleteAlertDialog
        pageTitle="entry"
        open={deleteState.open}
        onOpenChange={(open) => setDeleteState((s) => ({ ...s, open }))}
        onDelete={confirmDelete}
        alertDescription={
          deleteState.usage > 0
            ? `It is on ${deleteState.usage} resume${deleteState.usage === 1 ? "" : "s"}, and deleting it removes it from them too. Submitted resumes keep their frozen copy. Archiving keeps it everywhere it is used while hiding it from new resumes.`
            : "This removes the entry and its bullets. It is not used on any resume."
        }
      />
    </Card>
  );
}
