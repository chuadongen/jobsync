"use client";
import { AlertTriangle, ClipboardCopy, Hash, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/Markdown";
import { copyClaudePrompt } from "@/lib/claudePrompt";
import { cn } from "@/lib/utils";
import {
  COVERAGE_LABELS,
  MIN_JOBS_FOR_COVERAGE,
  MIN_SENT_FOR_RESULTS,
  type BaseGaps,
  type Coverage,
} from "@/models/gaps.model";

const COVERAGE_CLASS: Record<Coverage, string> = {
  strong: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  weak: "border-amber-500/50 text-amber-700 dark:text-amber-300",
  none: "border-red-500/50 text-red-700 dark:text-red-300",
};

function RoughGuide({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

function Funnel({ label, value, of }: { label: string; value: number; of: number }) {
  const share = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-sm" title={`${label}: ${value} of ${of}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="h-2.5 rounded-r bg-muted/60">
        <span className="block h-2.5 rounded-r bg-primary/80" style={{ width: `${share}%` }} />
      </span>
      <span className="text-right tabular-nums">
        {value} <span className="text-xs text-muted-foreground">({share}%)</span>
      </span>
    </div>
  );
}

export function BaseGapsPanel({ gaps }: { gaps: BaseGaps }) {
  const { base, analysedJobs, coverage, results, missingNumbers, report } = gaps;
  const weakOrMissing = coverage.filter((c) => c.coverage !== "strong");
  const prompt = `Using my JobSync tools, review the gaps for my "${base.name}" base version (id ${base.id}). Read get_base_gaps and get_experience_bank, then save a gap report with save_gap_report and walk me through it. Respect the caveats about small numbers.`;

  return (
    <div className="space-y-4" data-testid="base-gaps">
      {/* Claude's report first: it is the summary of everything below. */}
      <Card className="border-violet-500/30">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" /> Claude&apos;s review
            </CardTitle>
            <CardDescription>
              {report
                ? `Written ${new Date(report.updatedAt).toLocaleDateString("en-SG", { dateStyle: "medium" })}${report.createdVia ? ` via ${report.createdVia}` : ""}.`
                : "No review yet."}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => copyClaudePrompt(prompt)}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" /> {report ? "Ask for a fresh review" : "Ask Claude for a review"}
          </Button>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="space-y-4">
              <Markdown text={report.summary} />
              <ol className="space-y-3">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="rounded-md border p-3">
                    <p className="font-medium">
                      {i + 1}. {s.title}
                    </p>
                    <Markdown text={s.detail} className="mt-1" />
                    {s.evidence && <p className="mt-1.5 text-xs text-muted-foreground">Based on: {s.evidence}</p>}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Copy the prompt into Claude. It reads the numbers below and your bank, then writes concrete suggestions
              here.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 @5xl/main:grid-cols-2">
        {/* Requirement coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What {base.name} roles ask for</CardTitle>
            <CardDescription>
              From {analysedJobs} analysed job description{analysedJobs === 1 ? "" : "s"}. Claude records these each time
              it tailors a resume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysedJobs === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet. When Claude tailors a variant from this base, it records the job&apos;s requirements and how
                well your bank covers each.
              </p>
            ) : (
              <>
                {analysedJobs < MIN_JOBS_FOR_COVERAGE && (
                  <RoughGuide>
                    Indicative until about {MIN_JOBS_FOR_COVERAGE} jobs: one unusual posting can tilt the counts.
                  </RoughGuide>
                )}
                {weakOrMissing.length > 0 && (
                  <p className="text-sm">
                    <span className="font-medium">{weakOrMissing.length}</span> of {coverage.length} requirements are weak
                    or missing in your bank.
                  </p>
                )}
                <ul className="divide-y rounded-md border">
                  {coverage.slice(0, 20).map((c) => (
                    <li key={c.label} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          In {c.mentions} of {analysedJobs}
                          {c.required > 0 && c.required < c.mentions ? `, required in ${c.required}` : ""}
                          {c.required === c.mentions ? ", always required" : ""}
                        </p>
                        {c.evidence.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={c.evidence.map((e) => e.text).join("\n")}>
                            Backed by: {c.evidence[0].text}
                            {c.evidence.length > 1 ? ` (+${c.evidence.length - 1})` : ""}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("shrink-0", COVERAGE_CLASS[c.coverage])}>
                        {COVERAGE_LABELS[c.coverage]}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {coverage.length > 20 && (
                  <p className="text-xs text-muted-foreground">And {coverage.length - 20} less frequent requirements.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it has done</CardTitle>
              <CardDescription>Applications sent with a variant of this base.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.sent === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No applications sent with this base yet. Results appear once you mark a variant as sent.
                </p>
              ) : (
                <>
                  {results.sent < MIN_SENT_FOR_RESULTS && (
                    <RoughGuide>
                      {results.sent} sent so far: a rough guide, not market feedback. One recruiter&apos;s call can swing
                      these.
                    </RoughGuide>
                  )}
                  <Funnel label="Sent" value={results.sent} of={results.sent} />
                  <Funnel label="Past the screen" value={results.reachedAssessment} of={results.sent} />
                  <Funnel label="Interviewed" value={results.reachedInterview} of={results.sent} />
                  <Funnel label="Offers" value={results.offers} of={results.sent} />
                  <p className="text-xs text-muted-foreground">
                    {results.waiting} still waiting · {results.screenedOut} closed without getting past the resume screen
                  </p>
                  {results.stoppedAt.applied + results.stoppedAt.assessment + results.stoppedAt.interview > 0 && (
                    <p className="text-sm">
                      Where closed applications stopped:{" "}
                      {[
                        results.stoppedAt.applied && `${results.stoppedAt.applied} at the resume screen`,
                        results.stoppedAt.assessment && `${results.stoppedAt.assessment} at an assessment`,
                        results.stoppedAt.interview && `${results.stoppedAt.interview} at interview`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      . {results.stoppedAt.applied > results.stoppedAt.assessment + results.stoppedAt.interview
                        ? "Most stop at the screen, which points at the resume itself."
                        : "Most get past the resume, so practice for assessments and interviews pays more."}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Missing numbers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4" /> Bullets without a number
              </CardTitle>
              <CardDescription>A measured result is the cheapest upgrade to a bullet.</CardDescription>
            </CardHeader>
            <CardContent>
              {missingNumbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every bullet in this base states a quantity.</p>
              ) : (
                <ul className="space-y-2">
                  {missingNumbers.map((m) => (
                    <li key={`${m.sourceId}-${m.text}`} className="flex gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>
                        <span className="font-medium">{m.entry}:</span> {m.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {missingNumbers.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Add the real figure to the bullet in the Experience Bank (users, time saved, team size), then update
                  this base.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
