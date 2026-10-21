"use client";
import { useEffect, useState, useTransition } from "react";
import { ClipboardCopy, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/Markdown";
import { setStagePrep } from "@/actions/jobStage.actions";
import { copyClaudePrompt } from "@/lib/claudePrompt";
import { toastActionResult } from "@/lib/toast";
import type { JobStage } from "@/models/jobStage.model";

type Field = "prepNotes" | "debrief";

const COPY: Record<Field, { label: string; empty: string; button: string; prompt: (s: JobStage) => string }> = {
  prepNotes: {
    label: "PREP WITH CLAUDE",
    empty: "No prep yet. Ask Claude to prepare you for this round; its notes land here.",
    button: "Prep with Claude",
    prompt: (s) =>
      `Using my JobSync tools, help me prepare for the "${s.StageType.label}" round (stage ${s.id}) of job ${s.jobId}. Read get_job_stages, get_job and the resume I sent, then save prep notes on that stage with save_stage_notes and go through them with me.`,
  },
  debrief: {
    label: "DEBRIEF",
    empty: "After the round, tell Claude what actually happened. It checks it against the prep and records it here.",
    button: "Debrief with Claude",
    prompt: (s) =>
      `Using my JobSync tools, debrief the "${s.StageType.label}" round (stage ${s.id}) of job ${s.jobId}. Read get_job_stages, ask me what actually happened, then save a debrief with save_stage_notes that checks it against the prep notes: what came up, what the prep missed, and what to do differently next time.`,
  },
};

function PrepField({ stage, field, onChanged }: { stage: JobStage; field: Field; onChanged: () => void }) {
  const value = stage[field] ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, startTransition] = useTransition();
  const copy = COPY[field];

  useEffect(() => {
    setDraft(stage[field] ?? "");
    setEditing(false);
  }, [stage.id, stage[field]]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () =>
    startTransition(async () => {
      const res = await setStagePrep(stage.id, field, draft);
      toastActionResult(res, {
        success: "Saved",
        onSuccess: () => {
          setEditing(false);
          onChanged();
        },
      });
    });

  return (
    <div data-testid={`stage-${field}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground">
          {field === "prepNotes" && <Sparkles className="h-3 w-3 text-violet-500" />}
          {copy.label}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 cursor-pointer text-xs"
            onClick={() => copyClaudePrompt(copy.prompt(stage))}
          >
            <ClipboardCopy className="mr-1 h-3.5 w-3.5" /> {copy.button}
          </Button>
          {!editing && value && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              aria-label={`Edit ${field === "prepNotes" ? "prep notes" : "debrief"}`}
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-2 min-h-40 font-mono text-xs"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" className="cursor-pointer" disabled={saving || draft === value} onClick={save}>
              Save Changes
            </Button>
          </div>
        </>
      ) : value ? (
        <div className="mt-2 max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-3">
          <Markdown text={value} />
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">{copy.empty}</p>
      )}
    </div>
  );
}

// Rounds you prepare for: everything past the application itself.
export function stageHasPrep(stage: JobStage) {
  const status = stage.StageType.Status?.value;
  return !!status && !["new", "draft", "applied"].includes(status);
}

export function StagePrep({ stage, onChanged }: { stage: JobStage; onChanged: () => void }) {
  return (
    <div className="space-y-4 border-t pt-4">
      <PrepField stage={stage} field="prepNotes" onChanged={onChanged} />
      <PrepField stage={stage} field="debrief" onChanged={onChanged} />
    </div>
  );
}
