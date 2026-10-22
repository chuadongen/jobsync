"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyScope } from "./useCompanyScope";

type Props = {
  scope: CompanyScope;
  onScopeChange: (next: CompanyScope) => void;
};

export function CompaniesScopeSelect({ scope, onScopeChange }: Props) {
  return (
    <Select
      value={scope}
      onValueChange={(v) => onScopeChange(v as CompanyScope)}
    >
      <SelectTrigger aria-label="Select company scope" className="h-8 w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="mine">My Companies</SelectItem>
        <SelectItem value="watchlist">Watchlist</SelectItem>
      </SelectContent>
    </Select>
  );
}
