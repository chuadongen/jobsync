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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { saveAvailabilityBlock } from "@/actions/availability.actions";
import { toastActionResult } from "@/lib/toast";
import type { AvailabilityBlock, AvailabilityKind } from "@/models/availability.model";
import { fromInputDate, toInputDate } from "./dates";

type BlockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: AvailabilityBlock | null;
  onSaved: () => void;
};

export function BlockDialog({ open, onOpenChange, block, onSaved }: BlockDialogProps) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AvailabilityKind>("absolute");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle(block?.title ?? "");
    setKind(block?.kind ?? "absolute");
    setStart(block ? toInputDate(block.startDate) : "");
    setEnd(block ? toInputDate(block.endDate) : "");
    setNotes(block?.notes ?? "");
  }, [open, block]);

  const backwards = !!start && !!end && end < start;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveAvailabilityBlock({
        id: block?.id,
        title,
        kind,
        startDate: fromInputDate(start),
        endDate: fromInputDate(end),
        notes,
      });
      toastActionResult(result, {
        success: block ? "Block updated" : "Block added",
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
        },
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{block ? "Edit block" : "Add a time block"}</DialogTitle>
          <DialogDescription>
            A stretch when you cannot work: exchange, a trip, exams. Jobs whose role period runs into it are flagged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-title">Name</Label>
            <Input
              id="block-title"
              required
              value={title}
              placeholder="e.g. Exchange at Fudan"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>How sure is it?</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as AvailabilityKind)} className="grid grid-cols-2 gap-2">
              <Label
                htmlFor="kind-absolute"
                className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm font-normal has-[:checked]:border-primary"
              >
                <RadioGroupItem id="kind-absolute" value="absolute" className="mt-0.5" />
                <span>
                  <span className="font-medium">Confirmed</span>
                  <span className="block text-xs text-muted-foreground">Booked or accepted</span>
                </span>
              </Label>
              <Label
                htmlFor="kind-potential"
                className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm font-normal has-[:checked]:border-primary"
              >
                <RadioGroupItem id="kind-potential" value="potential" className="mt-0.5" />
                <span>
                  <span className="font-medium">Tentative</span>
                  <span className="block text-xs text-muted-foreground">Applied for or planned</span>
                </span>
              </Label>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="block-start">From</Label>
              <Input id="block-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-end">To</Label>
              <Input
                id="block-end"
                type="date"
                required
                min={start || undefined}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {backwards && <p className="text-xs text-red-600">The end date cannot be before the start date.</p>}
          <div className="space-y-2">
            <Label htmlFor="block-notes">Notes</Label>
            <Textarea id="block-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !start || !end || backwards}>
              Save
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
