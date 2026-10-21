import { Metadata } from "next";
import { getRollableCount, getTargets } from "@/actions/seasons.actions";
import { getAvailabilityBlocks } from "@/actions/availability.actions";
import { SeasonsContainer } from "@/components/seasons/SeasonsContainer";
import type { AvailabilityBlock } from "@/models/availability.model";

export const metadata: Metadata = {
  title: "Application Seasons | JobSync",
};

export default async function SeasonsPage() {
  const [targets, blocks, rollable] = await Promise.all([
    getTargets(true),
    getAvailabilityBlocks(),
    getRollableCount(),
  ]);
  return (
    <SeasonsContainer
      targets={targets.success ? targets.data : []}
      blocks={(blocks.success ? blocks.data : []) as AvailabilityBlock[]}
      rollableCount={rollable.success ? rollable.data : 0}
    />
  );
}
