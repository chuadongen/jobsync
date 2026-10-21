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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveTarget, saveWindow } from "@/actions/seasons.actions";
import { toastActionResult } from "@/lib/toast";
import type { SeasonTarget, SeasonWindow } from "@/models/seasons.model";
import { fromInputDate, toInputDate } from "@/components/availability/dates";

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function TargetDialog({ open, onOpenChange, onSaved, target }: BaseProps & { target: SeasonTarget | null }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [keyword, setKeyword] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? "");
    setCompany(target?.company ?? "");
    setKeyword(target?.keyword ?? "");
    setNotes(target?.notes ?? "");
  }, [open, target]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveTarget({ id: target?.id, name, company, keyword, notes });
      toastActionResult(result, {
        success: target ? "Target updated" : "Target added",
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
          <DialogTitle>{target ? "Edit target" : "Add a target"}</DialogTitle>
          <DialogDescription>
            A company or kind of role you mean to apply to. Saved jobs match it by company name and, if you add one, a
            word in the job title.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-name">Name</Label>
            <Input
              id="target-name"
              required
              value={name}
              placeholder="e.g. GovTech SWE intern"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-company">Company</Label>
              <Input id="target-company" value={company} placeholder="GovTech" onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-keyword">Title keyword</Label>
              <Input id="target-keyword" value={keyword} placeholder="Software" onChange={(e) => setKeyword(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave the company empty for a role type across companies, such as &ldquo;Consulting summer analyst&rdquo;
            with the keyword &ldquo;Analyst&rdquo;.
          </p>
          <div className="space-y-2">
            <Label htmlFor="target-notes">Notes</Label>
            <Textarea id="target-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || (!company.trim() && !keyword.trim())}>
              Save
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WindowDialog({
  open,
  onOpenChange,
  onSaved,
  target,
  window,
}: BaseProps & { target: SeasonTarget | null; window: SeasonWindow | null }) {
  const [intake, setIntake] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [roleStart, setRoleStart] = useState("");
  const [roleEnd, setRoleEnd] = useState("");
  const [estimated, setEstimated] = useState(false);
  const [source, setSource] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setIntake(window?.intake ?? "");
    setOpensAt(window ? toInputDate(window.opensAt) : "");
    setClosesAt(window?.closesAt ? toInputDate(window.closesAt) : "");
    setRoleStart(window?.roleStart ? toInputDate(window.roleStart) : "");
    setRoleEnd(window?.roleEnd ? toInputDate(window.roleEnd) : "");
    setEstimated(window?.estimated ?? false);
    setSource(window?.source ?? "");
  }, [open, window]);

  const closesBeforeOpen = !!opensAt && !!closesAt && closesAt < opensAt;
  const roleBackwards = !!roleStart && !!roleEnd && roleEnd < roleStart;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    startTransition(async () => {
      const result = await saveWindow(target.id, {
        id: window?.id,
        intake,
        opensAt: fromInputDate(opensAt),
        closesAt: closesAt ? fromInputDate(closesAt) : null,
        roleStart: roleStart ? fromInputDate(roleStart) : null,
        roleEnd: roleEnd ? fromInputDate(roleEnd) : null,
        estimated,
        source,
      });
      toastActionResult(result, {
        success: window ? "Window updated" : "Window added",
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
        },
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{window ? "Edit window" : "Add a window"}</DialogTitle>
          <DialogDescription>
            When applications for {target?.name ?? "this target"} open and close for one intake.
            {window?.status === "suggested" && " Saving your edits confirms it."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="window-intake">Intake</Label>
            <Input
              id="window-intake"
              required
              value={intake}
              placeholder="e.g. Summer 2027"
              onChange={(e) => setIntake(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="window-opens">Applications open</Label>
              <Input id="window-opens" type="date" required value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window-closes">Close (if known)</Label>
              <Input
                id="window-closes"
                type="date"
                min={opensAt || undefined}
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window-role-start">Role starts</Label>
              <Input id="window-role-start" type="date" value={roleStart} onChange={(e) => setRoleStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window-role-end">Role ends</Label>
              <Input
                id="window-role-end"
                type="date"
                min={roleStart || undefined}
                value={roleEnd}
                onChange={(e) => setRoleEnd(e.target.value)}
              />
            </div>
          </div>
          {closesBeforeOpen && <p className="text-xs text-red-600">Applications cannot close before they open.</p>}
          {roleBackwards && <p className="text-xs text-red-600">The role cannot end before it starts.</p>}
          <div className="flex items-center gap-2">
            <Switch id="window-estimated" checked={estimated} onCheckedChange={setEstimated} />
            <Label htmlFor="window-estimated" className="text-sm font-normal">
              Estimated from earlier years, not announced
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="window-source">Source</Label>
            <Input
              id="window-source"
              value={source}
              placeholder="Careers page link, or e.g. seniors' advice"
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !intake.trim() || !opensAt || closesBeforeOpen || roleBackwards}>
              Save
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
