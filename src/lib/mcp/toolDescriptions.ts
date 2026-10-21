// Tool descriptions are prompt surface, not documentation: the agent routes
// between tools on this text alone. Kept out of route.ts so tests can assert
// against the exact strings the server registers.
export const MCP_TOOL_DESCRIPTIONS = {
  add_job:
    "Add a job application to JobSync. Resolves or creates company, job title, location, and source by name. Returns a transparency report of what was matched vs. created.",
  find_job:
    "Look up whether a job posting is already saved in JobSync, by URL. Call this before add_job when re-running a search. With no URL to look up, use add_job's upsert instead of skipping dedupe.",
  update_job:
    "Correct or enrich a job previously added through MCP. Only the fields you supply change. Supplying a fuller jobDescription re-classifies the posting; use this instead of re-adding with allowDuplicate.",
  add_jobs_batch:
    "Add several jobs in one call. Same per-item behaviour as add_job (including upsert); returns one labelled result per item. Use this for scheduled runs instead of N sequential add_job calls.",
  get_experience_bank:
    "Read the user's experience bank: their contact header and every entry (education, experience, projects, leadership, awards, certifications, skills lines) with its bullets and ids. This is the only source of truth for what the user has done. Call it before writing any resume, letter or suggestion.",
  list_resumes:
    "List the user's resume documents: base versions (one per target role, e.g. PM, SWE, Cloud, BA, AI Perf, Strat) and job-specific variants, with their status (draft, approved, submitted).",
  get_resume:
    "Read one resume document in the same shape save_resume_variant and save_resume_base accept, so you can revise it by editing what you read. Bullets show their bank sourceId, and sourceText when the wording differs from the bank.",
  get_job:
    "Read a saved job in full, including the job description text, the role period, and any resumes and cover letters already prepared for it.",
  search_jobs:
    "Find saved jobs by company, title or description text, or list the most recent ones. Use this to get a jobId when the user names a company.",
  save_resume_variant:
    "Create or revise a job-specific resume variant derived from a base version. Every bullet must cite the bank bullet it is written from, on the same entry. You may reword to sharpen impact and match the job's language, but never add a fact, number, tool or scope the bank does not support; propose missing material with suggest_bank_additions instead. The result is a draft the user reviews and approves in JobSync; no PDF exists until they do.",
  save_resume_base:
    "Create or revise a base version (the per-role starting point variants are derived from). Same provenance rules as save_resume_variant. Saved as a draft for the user's approval.",
  suggest_bank_additions:
    "Propose new bullets for existing bank entries, or whole new entries, for the user to accept or reject in JobSync. Use this when the user tells you about experience the bank lacks, or when a job asks for something they may have done but the bank does not record. Accepted items enter the bank; until then they cannot be cited.",
  save_cover_letter:
    "Create or revise a cover letter draft for a job. Same honesty rule as resumes: only claims the experience bank supports. The user approves it in JobSync before any PDF exists.",
  list_documents:
    "List files in the user's document vault (transcripts, certificates, portfolios and so on), optionally for one job. Metadata only; file contents are not readable through this tool.",
  list_targets:
    "List the companies and kinds of role the user means to apply to, with known application windows (suggested or confirmed), the saved jobs that match each, and when matching jobs were first seen in past years. Call it before researching windows so you only fill what is missing or stale.",
  save_target_windows:
    "Save application windows you researched for a target (creating the target by name if needed). Each window is one intake with open and close dates, the role period if known, whether it is estimated from earlier years, and a source. They are saved as suggestions; the user confirms them in JobSync before they count. Never present an estimate as announced.",
  get_job_stages:
    "Read a job's interview rounds and other stages, with the user's own notes, any prep notes and debriefs, interviewers, the valid stage type labels, and debriefs from earlier applications to the same company. Call it before preparing the user for a round or debriefing one.",
  add_stage:
    "Record a new round on a job when the user tells you they got one (an online assessment, an interview, an offer). Uses the user's existing stage types only, and by default makes it the current stage, which moves the job's status.",
  save_stage_notes:
    "Write preparation notes before a round, or a debrief after it, on one stage. The debrief records what actually happened as the user tells it and checks it against the prep. Does not touch the user's own notes.",
  save_job_requirements:
    "Record what a job actually requires and how well the experience bank covers each requirement, with the bank bullets that support it. Do this whenever you read a job description to tailor for it, and pass the base version the role maps to. These build the gaps view on each base version.",
  get_base_gaps:
    "Read the gap data for one base version: requirements across its analysed jobs with how often each appears and how well it is covered, outcomes of applications sent with its variants, bullets without a measurable result, and the current gap report. Includes caveats when the numbers are too small to trust.",
  save_gap_report:
    "Save your written review of a base version's gaps: a short summary and a few concrete suggestions, each tied to the gap data. Replaces the previous report. Base versions only; job variants have no gap report.",
} as const;

export type McpToolName = keyof typeof MCP_TOOL_DESCRIPTIONS;
