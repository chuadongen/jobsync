import { getRecentJobs } from "@/actions/dashboard.actions";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Dashboard() {
  await getRecentJobs();
  return (
    <div className="grid gap-4 @3xl/main:col-span-3">
      <JobsApplied />
    </div>
  );
}
