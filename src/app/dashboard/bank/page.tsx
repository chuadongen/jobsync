import { Metadata } from "next";
import {
  getBankEntries,
  getBankSuggestions,
  getResumeHeader,
} from "@/actions/bank.actions";
import { BankContainer } from "@/components/bank/BankContainer";
import type { BankEntry, BankSuggestion } from "@/models/bank.model";

export const metadata: Metadata = {
  title: "Experience Bank | JobSync",
};

export default async function BankPage() {
  const [entries, suggestions, header] = await Promise.all([
    getBankEntries(true),
    getBankSuggestions(),
    getResumeHeader(),
  ]);
  return (
    <BankContainer
      entries={(entries.success ? entries.data : []) as BankEntry[]}
      suggestions={(suggestions.success ? suggestions.data : []) as BankSuggestion[]}
      header={header.success ? header.data : null}
    />
  );
}
