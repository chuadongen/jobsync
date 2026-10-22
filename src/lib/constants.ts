import {
  LayoutDashboard,
  SquareCheckBig,
  BriefcaseBusiness,
  CalendarRange,
  FileText,
  FolderOpen,
  Library,
  Sheet,
  CalendarCheck,
  Target,
} from "lucide-react";

export const APP_CONSTANTS = {
  RECORDS_PER_PAGE: 25,
  MAX_JOB_TAGS: 10,
  // Due date given to a new job when none is supplied, on every creation path
  DEFAULT_JOB_DUE_DAYS: 3,
  RECENT_NUM_JOBS_ACTIVITIES: 10,
  INTERSECTION_OBSERVER_THRESHOLD: 0.1,
  SIDEBAR_STORAGE_KEY: "sidebar-expanded",
  LAST_JOB_LOCATION_STORAGE_KEY: "last-job-location",
  LAST_JOB_SOURCE_STORAGE_KEY: "last-job-source",
  JOBS_VIEW_MODE_STORAGE_KEY: "jobs-view-mode",
  RESUME_PREVIEW_FIT_STORAGE_KEY: "resume-preview-fit",
  SIDEBAR_DOM_ID: "app-sidebar",

  // Paired so the rail width and its matching content offset can't drift.
  SIDEBAR_WIDTH: {
    expanded: { rail: "w-56", contentOffset: "sm:pl-56" },
    collapsed: { rail: "w-14", contentOffset: "sm:pl-14", px: 56 },
  },

  // MCP server settings
  MCP_DUPLICATE_WINDOW_DAYS: 30,
  MCP_TOKEN_EXPIRY_PRESETS: [30, 90, 365] as const,
  MCP_TOKEN_EXPIRY_DEFAULT_DAYS: 90,
  MCP_TOKEN_MAX_PER_USER: 10,
  MCP_RATE_LIMIT_MAX: 100,
  MCP_RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,
  MCP_DEFAULT_STATUS: "draft",
  // Word-count thresholds for job-description completeness. A real posting
  // runs 300+ words; under 40 is a title/salary stub, not something a resume
  // can honestly be tailored against.
  DESCRIPTION_PARTIAL_MIN_WORDS: 40,
  DESCRIPTION_FULL_MIN_WORDS: 150,
  // Batch items are processed sequentially and each consumes one unit of the
  // shared MCP rate-limit budget, so this caps a single call at a tenth of it.
  MCP_BATCH_MAX_ITEMS: 10,

  // Telemetry (OTLP export)
  // Flush cadence. A batch is never serialized in the enqueueing caller's
  // stack — reaching the batch size only arms the timer.
  TELEMETRY_FLUSH_INTERVAL_MS: 5_000,
  // Consecutive-failure backoff, resets to the first entry on any success.
  // A collector down for a day is retried a few dozen times, not 17,000.
  TELEMETRY_BACKOFF_MS: [5_000, 30_000, 60_000],
  // Bounded queue, drops oldest. A dead collector cannot grow memory
  // without limit.
  TELEMETRY_MAX_QUEUE: 1_000,
  TELEMETRY_BATCH_SIZE: 200,
  TELEMETRY_EXPORT_TIMEOUT_MS: 5_000,
  TELEMETRY_MAX_ATTR_CHARS: 32_000,

  // Holds the SQLite database, the document vault and generated PDFs. On the
  // server this is the one directory to back up.
  DATA_DIR: process.env.DATA_DIR ?? (process.env.NODE_ENV !== "production" ? "data" : "/data"),
  MAX_DOCUMENT_SIZE_BYTES: 20 * 1024 * 1024, // 20 MB
} as const;

export const JOB_SOURCES = [
  { label: "LinkedIn", value: "linkedin" },
  { label: "Company Career page", value: "careerpage" },
  { label: "MyCareersFuture", value: "mycareersfuture" },
  { label: "Glints", value: "glints" },
  { label: "SMU OnTRAC", value: "smu ontrac" },
  { label: "NodeFlair", value: "nodeflair" },
  { label: "Indeed", value: "indeed" },
  { label: "Glassdoor", value: "glassdoor" },
  { label: "Job Street", value: "jobstreet" },
  { label: "Referral", value: "referral" },
  { label: "Career Fair", value: "career fair" },
  { label: "Other", value: "other" },
] as const;

// Seeded per user at signup and backfilled by the contacts migration. `value`
// must equal canonicalizeEntityValue(label) or the creatable role picker will
// mint a duplicate instead of matching the seeded row.
export const CONTACT_ROLES = [
  { label: "Recruiter", value: "recruiter" },
  { label: "Hiring Manager", value: "hiring manager" },
  { label: "Interviewer", value: "interviewer" },
  { label: "Referrer", value: "referrer" },
  { label: "Reference", value: "reference" },
] as const;

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1001-5000",
  "5000+",
] as const;

export const COMPANY_NOTES_MAX_LENGTH = 5000;

export const JOB_STATUSES = [
  { label: "New", value: "new" },
  { label: "Draft", value: "draft" },
  { label: "Applied", value: "applied" },
  { label: "Interview", value: "interview" },
  { label: "Offer", value: "offer" },
  { label: "Offer Accepted", value: "offer-accepted" },
  { label: "Offer Declined", value: "offer-declined" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
  { label: "Archived", value: "archived" },
  { label: "Withdrawn", value: "withdrawn" },
] as const;

// Seeded per user at signup and backfilled by the stages migration. `value`
// must equal canonicalizeEntityValue(label): the status -> stage-type reverse
// lookup keys on the status LABEL's canonical form, not on status.value, so
// "Offer Accepted" cannot mint a second type beside "offer-accepted".
export const JOB_STAGES = [
  { label: "New", value: "new", status: "new", sortOrder: 0 },
  { label: "Draft", value: "draft", status: "draft", sortOrder: 1 },
  { label: "Applied", value: "applied", status: "applied", sortOrder: 2 },
  // Screening steps common in Singapore intern and graduate pipelines. They
  // sit under Interview so they move the status and can carry interviewers.
  { label: "Online Assessment", value: "online assessment", status: "interview", sortOrder: 3 },
  { label: "HireVue / Video Interview", value: "hirevue / video interview", status: "interview", sortOrder: 4 },
  { label: "Interview", value: "interview", status: "interview", sortOrder: 5 },
  { label: "1st Screening Interview", value: "1st screening interview", status: "interview", sortOrder: 6 },
  { label: "2nd Technical Interview", value: "2nd technical interview", status: "interview", sortOrder: 7 },
  { label: "Assessment Centre", value: "assessment centre", status: "interview", sortOrder: 8 },
  { label: "Final / Onsite Interview", value: "final / onsite interview", status: "interview", sortOrder: 9 },
  { label: "Offer", value: "offer", status: "offer", sortOrder: 10 },
  { label: "Offer Accepted", value: "offer accepted", status: "offer-accepted", sortOrder: 11 },
  { label: "Offer Declined", value: "offer declined", status: "offer-declined", sortOrder: 12 },
  { label: "Rejected", value: "rejected", status: "rejected", sortOrder: 13 },
  { label: "Expired", value: "expired", status: "expired", sortOrder: 14 },
  { label: "Archived", value: "archived", status: "archived", sortOrder: 15 },
  { label: "Withdrawn", value: "withdrawn", status: "withdrawn", sortOrder: 16 },
] as const;

// Statuses whose stage types render greyed at the foot of the Stage History
// list when the job has not reached them (D6). Offer alone: it reads as what a
// job is working toward, and rejected/withdrawn are alternative endings, not
// next steps. Both stay one click away in Add Stage.
export const TERMINAL_STAGE_STATUSES = ["offer"] as const;

// The fixed outcome set a stage may carry (spec's JobStage.outcome).
export const STAGE_OUTCOMES = [
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Passed", value: "passed" },
  { label: "Failed", value: "failed" },
  { label: "No-show", value: "no-show" },
  { label: "Cancelled", value: "cancelled" },
] as const;

// Statuses you can only reach by applying: setting one marks the job applied.
export const APPLIED_STATUS_VALUES: readonly string[] = [
  "applied",
  "interview",
  "offer",
  "offer-accepted",
  "offer-declined",
];

// Zod's z.enum needs a non-empty tuple; JOB_STATUSES is the source of truth.
export const JOB_STATUS_VALUES = JOB_STATUSES.map((s) => s.value) as unknown as [
  string,
  ...string[],
];


export const SIDEBAR_LINKS: {
  icon: typeof LayoutDashboard;
  route: string;
  label: string;
  devOnly?: boolean;
}[] = [
  {
    icon: LayoutDashboard,
    route: "/dashboard",
    label: "Dashboard",
  },
  {
    icon: BriefcaseBusiness,
    route: "/dashboard/myjobs",
    label: "Jobs",
  },
  {
    icon: Target,
    route: "/dashboard/seasons",
    label: "Seasons",
  },
  {
    icon: CalendarCheck,
    route: "/dashboard/interviews",
    label: "Interviews",
  },
  {
    icon: Library,
    route: "/dashboard/bank",
    label: "Experience Bank",
  },
  {
    icon: FileText,
    route: "/dashboard/resumes",
    label: "Resumes",
  },
  {
    icon: FolderOpen,
    route: "/dashboard/documents",
    label: "Documents",
  },
  {
    icon: CalendarRange,
    route: "/dashboard/availability",
    label: "Availability",
  },
  {
    icon: SquareCheckBig,
    route: "/dashboard/tasks",
    label: "Tasks",
  },
  {
    icon: Sheet,
    route: "/dashboard/admin",
    label: "Library",
  },
];
