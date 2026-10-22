"use client";
import { useState, useTransition } from "react";
import { Check, Pencil, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { acceptBankSuggestion, rejectBankSuggestion } from "@/actions/bank.actions";
import { toastActionResult } from "@/lib/toast";
import { entryTypeLabel, type BankSuggestion } from "@/models/bank.model";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";

function SuggestionCard({
  suggestion,
  onDecided,
}: {
  suggestion: BankSuggestion;
  onDecided: () => void;
}) {
  const { payload } = suggestion;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(payload.kind === "bullet" ? payload.text : "");
  const [isPending, startTransition] = useTransition();

  const accept = () =>
    startTransition(async () => {
      const edited =
        payload.kind === "bullet" && editing ? { ...payload, text } : undefined;
      const result = await acceptBankSuggestion(suggestion.id, edited);
      toastActionResult(result, { success: "Added to your bank", onSuccess: onDecided });
    });

  const reject = () =>
    startTransition(async () => {
      const result = await rejectBankSuggestion(suggestion.id);
      toastActionResult(result, { success: "Suggestion dismissed", onSuccess: onDecided });
    });

  return (
    <Card data-testid="bank-suggestion">
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">
            {payload.kind === "bullet" ? "New bullet" : `New ${entryTypeLabel(payload.entry.type)} entry`}
          </Badge>
          {suggestion.entry && (
            <span className="text-muted-foreground">
              on {suggestion.entry.organisation}
              {suggestion.entry.title ? `, ${suggestion.entry.title}` : ""}
            </span>
          )}
          {suggestion.createdVia && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" /> via {suggestion.createdVia}
            </span>
          )}
        </div>

        {payload.kind === "bullet" ? (
          editing ? (
            <Textarea value={text} rows={2} aria-label="Suggested bullet" onChange={(e) => setText(e.target.value)} />
          ) : (
            <p className="text-sm">• {payload.text}</p>
          )
        ) : (
          <div className="text-sm">
            <p className="font-semibold">
              {payload.entry.organisation}
              {payload.entry.title ? <span className="font-normal text-muted-foreground"> · {payload.entry.title}</span> : null}
            </p>
            {(payload.entry.startDate || payload.entry.endDate) && (
              <p className="text-muted-foreground">
                {[payload.entry.startDate, payload.entry.endDate].filter(Boolean).join(" – ")}
              </p>
            )}
            {payload.entry.details && <p className="mt-1">{payload.entry.details}</p>}
            <ul className="mt-1 space-y-1">
              {payload.bullets.map((b, i) => (
                <li key={i}>• {b.text}</li>
              ))}
            </ul>
          </div>
        )}

        {suggestion.rationale && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium">Why:</span> {suggestion.rationale}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {payload.kind === "bullet" && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit first
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={isPending} onClick={reject}>
            <X className="mr-1 h-3.5 w-3.5" /> Dismiss
          </Button>
          <Button size="sm" disabled={isPending} onClick={accept} data-testid="accept-suggestion-btn">
            <Check className="mr-1 h-3.5 w-3.5" /> Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuggestionsPanel({
  suggestions,
  onChanged,
}: {
  suggestions: BankSuggestion[];
  onChanged: () => void;
}) {
  if (suggestions.length === 0) {
    return (
      <JobTabEmptyState
        icon={Sparkles}
        title="No suggestions waiting"
        description="When you tell Claude about something you did, it proposes bank additions here. Nothing joins your bank until you accept it."
      />
    );
  }
  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} onDecided={onChanged} />
      ))}
    </div>
  );
}
