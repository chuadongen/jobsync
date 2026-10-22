"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type CompanyScope = "mine" | "watchlist";

const SCOPES: CompanyScope[] = ["mine", "watchlist"];

// Owns ?scope= directly rather than hoisting it into AdminTabsContainer,
// which is shared by all the tabs. Safe to have two writers on one query
// string: each only sets its own key and rebuilds from the current params.
export function useCompanyScope() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();

  const raw = queryParams.get("scope") as CompanyScope | null;
  const scope: CompanyScope = raw && SCOPES.includes(raw) ? raw : "mine";

  const setScope = useCallback(
    (next: CompanyScope) => {
      const params = new URLSearchParams(queryParams.toString());
      params.set("scope", next);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, queryParams, router],
  );

  return { scope, setScope };
}
