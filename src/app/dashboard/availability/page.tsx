import { Metadata } from "next";
import { getAvailabilityBlocks, getRolePeriods } from "@/actions/availability.actions";
import { AvailabilityContainer } from "@/components/availability/AvailabilityContainer";
import type { AvailabilityBlock } from "@/models/availability.model";

export const metadata: Metadata = {
  title: "Availability | JobSync",
};

export default async function AvailabilityPage() {
  const [blocks, roles] = await Promise.all([getAvailabilityBlocks(), getRolePeriods()]);
  return (
    <AvailabilityContainer
      blocks={(blocks.success ? blocks.data : []) as AvailabilityBlock[]}
      roles={roles.success ? roles.data : []}
    />
  );
}
