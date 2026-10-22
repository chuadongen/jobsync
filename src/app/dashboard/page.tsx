import { Metadata } from "next";
import { requireUser } from "@/actions/shared";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboard } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const data = await getDashboard(user.id, now);
  return <DashboardView data={data} now={now} />;
}
