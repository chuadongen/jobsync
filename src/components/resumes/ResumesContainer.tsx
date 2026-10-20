"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FileText, Layers, Mail, PlusCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import { getDocStatusBadgeColor } from "@/lib/badge-colors";
import { docStatusLabel } from "@/models/resume.model";
import { CreateBaseDialog, CreateLetterDialog, CreateVariantDialog } from "./CreateResumeDialogs";
import type { JobOption } from "./JobPicker";

const TABS = ["variants", "bases", "letters"] as const;

type JobRef = { id: string; JobTitle: { label: string }; Company: { label: string } } | null;

export type ResumeRow = {
  id: string;
  kind: string;
  name: string;
  status: string;
  targetRole: string | null;
  updatedAt: Date;
  createdVia: string | null;
  base: { id: string; name: string } | null;
  job: JobRef;
  _count: { items: number; variants: number };
};

export type LetterRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: Date;
  createdVia: string | null;
  job: JobRef;
};

function Status({ status }: { status: string }) {
  return <StatusBadge label={docStatusLabel(status)} color={getDocStatusBadgeColor(status)} />;
}

function Via({ createdVia }: { createdVia: string | null }) {
  if (!createdVia) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground" title={`Last written via ${createdVia}`}>
      <Sparkles className="h-3 w-3" /> Claude
    </span>
  );
}

function jobLabel(job: JobRef) {
  return job ? `${job.Company.label} · ${job.JobTitle.label}` : "No job";
}

export function ResumesContainer({
  resumes,
  letters,
  jobs,
}: {
  resumes: ResumeRow[];
  letters: LetterRow[];
  jobs: JobOption[];
}) {
  const [tab, setTab] = useTabQueryParam(TABS, "variants");
  const [dialog, setDialog] = useState<"base" | "variant" | "letter" | null>(null);
  const bases = resumes.filter((r) => r.kind === "base");
  const variants = resumes.filter((r) => r.kind === "variant");
  const awaiting = [...variants, ...bases].filter((r) => r.status === "draft").length +
    letters.filter((l) => l.status === "draft").length;

  return (
    <div className="col-span-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumes &amp; Letters</h1>
          <p className="text-sm text-muted-foreground">
            {awaiting > 0
              ? `${awaiting} draft${awaiting === 1 ? "" : "s"} waiting for your review. Nothing exports until you approve it.`
              : "Nothing waiting for review."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialog("base")}>
            <PlusCircle className="mr-2 h-4 w-4" /> Base version
          </Button>
          <Button variant="outline" disabled={bases.length === 0} onClick={() => setDialog("variant")}>
            <PlusCircle className="mr-2 h-4 w-4" /> Variant
          </Button>
          <Button variant="outline" onClick={() => setDialog("letter")}>
            <PlusCircle className="mr-2 h-4 w-4" /> Cover letter
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="variants">Job variants ({variants.length})</TabsTrigger>
          <TabsTrigger value="bases">Base versions ({bases.length})</TabsTrigger>
          <TabsTrigger value="letters">Cover letters ({letters.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {variants.length === 0 ? (
                <JobTabEmptyState
                  icon={FileText}
                  title="No tailored resumes yet"
                  description="Open a job, press Copy Claude Prompt and paste it into Claude. The tailored draft lands here for your review."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resume</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead className="hidden md:table-cell">From base</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/resumes/${r.id}`} className="text-primary underline-offset-4 hover:underline">
                            {r.name}
                          </Link>
                          <Via createdVia={r.createdVia} />
                        </TableCell>
                        <TableCell>
                          {r.job ? (
                            <Link href={`/dashboard/myjobs/${r.job.id}?tab=application`} className="hover:underline">
                              {jobLabel(r.job)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">No job</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{r.base?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Status status={r.status} />
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bases" className="mt-4">
          {bases.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <JobTabEmptyState
                  icon={Layers}
                  title="No base versions yet"
                  description="Create one base per kind of role you apply for, such as PM, SWE or Strategy."
                  actionLabel="New base version"
                  onAction={() => setDialog("base")}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
              {bases.map((b) => (
                <Link key={b.id} href={`/dashboard/resumes/${b.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{b.name}</CardTitle>
                        <Status status={b.status} />
                      </div>
                      <CardDescription>{b.targetRole || "No target role set"}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {b._count.items} entries · {b._count.variants} variant{b._count.variants === 1 ? "" : "s"}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="letters" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {letters.length === 0 ? (
                <JobTabEmptyState
                  icon={Mail}
                  title="No cover letters yet"
                  description="Ask Claude to draft one for a job, or write your own."
                  actionLabel="New cover letter"
                  onAction={() => setDialog("letter")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Letter</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {letters.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/letters/${l.id}`} className="text-primary underline-offset-4 hover:underline">
                            {l.title}
                          </Link>
                          <Via createdVia={l.createdVia} />
                        </TableCell>
                        <TableCell>{jobLabel(l.job)}</TableCell>
                        <TableCell>
                          <Status status={l.status} />
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {formatDistanceToNow(new Date(l.updatedAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateBaseDialog open={dialog === "base"} onOpenChange={(o) => setDialog(o ? "base" : null)} />
      <CreateVariantDialog
        open={dialog === "variant"}
        onOpenChange={(o) => setDialog(o ? "variant" : null)}
        bases={bases}
        jobs={jobs}
      />
      <CreateLetterDialog open={dialog === "letter"} onOpenChange={(o) => setDialog(o ? "letter" : null)} jobs={jobs} />
    </div>
  );
}
