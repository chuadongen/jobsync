// Tool descriptions are prompt surface, not documentation: the agent routes
// between add_job / update_job / add_jobs_batch on this text alone. Kept out
// of route.ts so evals/mcp-tools can assert against the exact strings the
// server registers instead of a copy that silently drifts.
export const MCP_TOOL_DESCRIPTIONS = {
  add_job:
    "Add a job application to JobSync. Resolves or creates company, job title, location, and source by name. Returns a transparency report of what was matched vs. created.",
  find_job:
    "Look up whether a job posting is already saved in JobSync, by URL. Call this before add_job when re-running a search. With no URL to look up, use add_job's upsert instead of skipping dedupe.",
  update_job:
    "Correct or enrich a job previously added through MCP. Only the fields you supply change. Supplying a fuller jobDescription re-classifies the posting; use this instead of re-adding with allowDuplicate.",
  add_jobs_batch:
    "Add several jobs in one call. Same per-item behaviour as add_job (including upsert); returns one labelled result per item. Use this for scheduled runs instead of N sequential add_job calls.",
} as const;

export type McpToolName = keyof typeof MCP_TOOL_DESCRIPTIONS;
