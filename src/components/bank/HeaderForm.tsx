"use client";
import { useState, useTransition } from "react";
import { Loader, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveResumeHeader } from "@/actions/bank.actions";
import { toastActionResult } from "@/lib/toast";
import type { ResumeHeaderData } from "@/models/resume.model";

// The contact block printed at the top of every resume and cover letter.
export function HeaderForm({
  header,
  onSaved,
}: {
  header: ResumeHeaderData | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: header?.fullName ?? "",
    location: header?.location ?? "",
    email: header?.email ?? "",
    phone: header?.phone ?? "",
    links: header?.links ?? [],
  });
  const [isPending, startTransition] = useTransition();

  const setLink = (index: number, key: "label" | "url", value: string) =>
    setForm((f) => ({
      ...f,
      links: f.links.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveResumeHeader({
        ...form,
        links: form.links.filter((l) => l.url.trim()),
      });
      toastActionResult(result, { success: "Contact details saved", onSuccess: onSaved });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
        <CardDescription>Printed at the top of every resume and cover letter.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="header-name">Full name</Label>
            <Input id="header-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="header-location">Location</Label>
            <Input id="header-location" value={form.location} placeholder="Singapore" onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="header-phone">Phone</Label>
            <Input id="header-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="header-email">Email</Label>
            <Input id="header-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label>Links</Label>
            {form.links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label="Link label" className="w-32" value={link.label} placeholder="LinkedIn" onChange={(e) => setLink(i, "label", e.target.value)} />
                <Input aria-label="Link URL" value={link.url} placeholder="linkedin.com/in/…" onChange={(e) => setLink(i, "url", e.target.value)} />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove link"
                  onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {form.links.length < 4 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setForm((f) => ({ ...f, links: [...f.links, { label: "", url: "" }] }))}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add link
              </Button>
            )}
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={isPending}>
              Save
              {isPending && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
