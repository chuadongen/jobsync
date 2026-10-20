// Barrel for the dashboard data functions, split into src/actions/dashboard/.
// Unlike the other action barrels this file and its modules carry no
// "use server": these are plain server-side reads called from the dashboard
// page.

export { getRecentJobs } from "./dashboard/recent";
