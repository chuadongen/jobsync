"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FolderOpen, MoreVertical, Pencil, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchInput } from "@/components/SearchInput";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import type { JobOption } from "@/components/resumes/JobPicker";
import { deleteDocument } from "@/actions/document.actions";
import { toastActionResult } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_CATEGORIES,
  documentCategoryLabel,
  type DocumentCategory,
  type VaultDocument,
} from "@/models/document.model";
import { DocumentDialog } from "./DocumentDialog";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsContainer({ documents, jobs }: { documents: VaultDocument[]; jobs: JobOption[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [dialog, setDialog] = useState<{ open: boolean; document: VaultDocument | null }>({
    open: false,
    document: null,
  });
  const [deleting, setDeleting] = useState<VaultDocument | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) map.set(d.category, (map.get(d.category) ?? 0) + 1);
    return map;
  }, [documents]);

  const visible = documents.filter((d) => {
    if (category !== "all" && d.category !== category) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [d.title, d.fileName, d.notes, d.job?.Company.label, d.job?.JobTitle.label]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const remove = (doc: VaultDocument) =>
    startTransition(async () => {
      const result = await deleteDocument(doc.id);
      toastActionResult(result, {
        success: "Document deleted",
        onSuccess: () => {
          setDeleting(null);
          router.refresh();
        },
      });
    });

  return (
    <div className="col-span-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Transcripts, certificates and anything else you attach to applications, stored as plain files on your server.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, document: null })} data-testid="upload-document-btn">
          <Upload className="mr-2 h-4 w-4" /> Upload
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search documents..." />
        <div className="flex flex-wrap gap-1">
          {(["all", ...Object.keys(DOCUMENT_CATEGORIES)] as const).map((key) => {
            const count = key === "all" ? documents.length : (counts.get(key) ?? 0);
            if (key !== "all" && count === 0) return null;
            return (
              <Button
                key={key}
                size="sm"
                variant={category === key ? "secondary" : "ghost"}
                onClick={() => setCategory(key as DocumentCategory | "all")}
              >
                {key === "all" ? "All" : documentCategoryLabel(key)}
                <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {documents.length === 0 ? (
        <JobTabEmptyState
          icon={FolderOpen}
          title="No documents yet"
          description="Upload your transcript, certificates and testimonials once, then attach them to any application."
          actionLabel="Upload"
          onAction={() => setDialog({ open: true, document: null })}
        />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden @3xl/main:table-cell">Job</TableHead>
                <TableHead className="hidden @2xl/main:table-cell">Uploaded</TableHead>
                <TableHead className="hidden @2xl/main:table-cell text-right">Size</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {doc.title}
                    </a>
                    <p className="max-w-md truncate text-xs text-muted-foreground" title={doc.filePath}>
                      {doc.filePath}
                    </p>
                    {doc.notes && <p className="max-w-md truncate text-xs text-muted-foreground">{doc.notes}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{documentCategoryLabel(doc.category)}</Badge>
                  </TableCell>
                  <TableCell className="hidden @3xl/main:table-cell">
                    {doc.job ? (
                      <Link
                        href={`/dashboard/myjobs/${doc.job.id}?tab=application`}
                        className="text-sm underline-offset-4 hover:underline"
                      >
                        {doc.job.Company.label} · {doc.job.JobTitle.label}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">Vault</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden @2xl/main:table-cell text-sm">
                    {new Date(doc.uploadedAt).toLocaleDateString("en-SG", { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className={cn("hidden @2xl/main:table-cell text-right text-sm tabular-nums")}>
                    {formatSize(doc.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${doc.title}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`/api/documents/${doc.id}?download=1`}>
                            <Download className="mr-2 h-4 w-4" /> Download
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDialog({ open: true, document: doc })}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleting(doc)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DocumentDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        document={dialog.document}
        jobs={jobs}
        onSaved={() => router.refresh()}
      />
      <DeleteAlertDialog
        pageTitle="document"
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDelete={() => deleting && remove(deleting)}
        alertDescription="This deletes the file from your server as well as the record."
      />
    </div>
  );
}
