import { Metadata } from "next";
import { getTargets } from "@/actions/seasons.actions";
import { getAvailabilityBlocks } from "@/actions/availability.actions";
import { SeasonsContainer } from "@/components/seasons/SeasonsContainer";
import type { AvailabilityBlock } from "@/models/availability.model";

export const metadata: Metadata = {
  title: "Application Seasons | JobSync",
};

export default async function SeasonsPage() {
  const [targets, blocks] = await Promise.all([getTargets(true), getAvailabilityBlocks()]);
  return (
    <SeasonsContainer
      targets={targets.success ? targets.data : []}
      blocks={(blocks.success ? blocks.data : []) as AvailabilityBlock[]}
    />
  );
}
