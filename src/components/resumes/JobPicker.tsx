"use client";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type JobOption = { id: string; label: string; status: string };

// Searchable, because after a season of applying the list runs long.
export function JobPicker({
  jobs,
  value,
  onChange,
  allowNone = false,
  id,
}: {
  jobs: JobOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = jobs.find((j) => j.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selected?.label ?? (allowNone ? "No job" : "Pick a job")}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search jobs..." />
          <CommandList>
            <CommandEmpty>No job found. Add it on the Jobs page first.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                  No job
                </CommandItem>
              )}
              {jobs.map((job) => (
                <CommandItem
                  key={job.id}
                  value={`${job.label} ${job.id}`}
                  onSelect={() => {
                    onChange(job.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === job.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{job.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{job.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
