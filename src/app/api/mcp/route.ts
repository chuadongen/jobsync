import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveMcpToken } from "@/lib/mcp/auth";
import { MCP_TOOL_DESCRIPTIONS, type McpToolName } from "@/lib/mcp/toolDescriptions";
import {
  McpAddJobInputShape,
  McpAddJobSchema,
  McpFindJobInputShape,
  McpFindJobSchema,
  McpUpdateJobInputShape,
  McpUpdateJobSchema,
  McpAddJobsBatchInputShape,
  McpAddJobsBatchSchema,
} from "@/models/mcp.schema";
import {
  McpGetBankInputShape,
  McpGetJobInputShape,
  McpGetResumeInputShape,
  McpListDocumentsInputShape,
  McpListResumesInputShape,
  McpSaveBaseInputShape,
  McpSaveCoverLetterInputShape,
  McpSaveVariantInputShape,
  McpSearchJobsInputShape,
  McpSuggestBankInputShape,
} from "@/models/mcpResume.schema";
import { handleAddJob } from "@/lib/mcp/tools/addJob";
import { handleFindJob } from "@/lib/mcp/tools/findJob";
import { handleUpdateJob } from "@/lib/mcp/tools/updateJob";
import { handleAddJobsBatch } from "@/lib/mcp/tools/addJobsBatch";
import * as resumeTools from "@/lib/mcp/tools/resume";
import * as planningTools from "@/lib/mcp/tools/planning";
import {
  McpAddStageInputShape,
  McpGetBaseGapsInputShape,
  McpGetJobStagesInputShape,
  McpListTargetsInputShape,
  McpSaveGapReportInputShape,
  McpSaveJobRequirementsInputShape,
  McpSaveStageNotesInputShape,
  McpSaveTargetWindowsInputShape,
} from "@/models/mcpPlanning.schema";

// Sent to the client on connect. Claude reads it before choosing tools, so it
// carries the working rules rather than leaving them to each description.
const SERVER_INSTRUCTIONS = `JobSync is the user's job application tracker and resume crafter.

Ground rules:
- The experience bank (get_experience_bank) is the only source of truth about the user. Every resume bullet cites the bank bullet it is written from.
- Rewording to sharpen impact and mirror the job's language is expected. Inventing facts, numbers, tools or scope is not. When a job wants something the bank lacks, ask the user and record their answer with suggest_bank_additions.
- Everything you save is a draft. The user approves resumes and letters in JobSync; no PDF exists before that. Do not tell the user a resume is ready to send.

Tailoring a resume for a job:
1. get_job (or search_jobs, then add_job if the posting is not saved yet).
2. list_resumes to pick the base whose targetRole fits; get_resume to read it.
3. get_experience_bank for the full material.
4. save_job_requirements with the posting's real requirements, your honest read of how well the bank covers each, and the base you chose.
5. save_resume_variant with the tailored items and a rationale that maps choices to the job's requirements and names any gaps.
6. Give the user the review link from the result.

Keep variants to one page: typically 3 to 4 experience or project entries with 2 to 4 bullets each.

Application seasons: list_targets first, research only what is missing or stale, and save findings with save_target_windows, always with a source. Say plainly when dates are estimated from earlier years.

Interview rounds: get_job_stages before preparing (it includes debriefs from earlier rounds at the same company). Save preparation with save_stage_notes as prepNotes. After the round, ask the user what actually happened, then save a debrief that checks the prep against reality. If the user reports a round JobSync does not have yet, add it with add_stage.

Base version gaps: get_base_gaps, then save_gap_report with suggestions that follow from the data. Respect its caveats: with few applications, outcome numbers are not market feedback.`;

type ToolResult = { content: Array<{ type: "text"; text: string }> };
const deny = (scope: string): ToolResult => ({
  content: [{ type: "text", text: `Insufficient scope. Required: ${scope}` }],
});
const invalid = (error: z.ZodError): ToolResult => ({
  content: [
    {
      type: "text",
      text: `Validation error: ${error.issues.map((i) => i.message).join("; ")}`,
    },
  ],
});

function isMcpEnabled(): boolean {
  const env = process.env.MCP_ENABLED;
  if (env === "true") return true;
  if (env === "false") return false;
  // Default: on in dev, off in production
  return process.env.NODE_ENV !== "production";
}

async function handler(req: Request): Promise<Response> {
  if (!isMcpEnabled()) {
    return new Response("Not Found", { status: 404 });
  }

  const auth = await resolveMcpToken(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { userId, tokenName } = auth;
  const server = new McpServer(
    { name: "jobsync", version: "2.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  // Registers a tool behind a scope check. When `schema` is given the input is
  // re-parsed through it for its transforms (dates, enum folding); otherwise
  // the SDK's validation against the shape is enough.
  function register<Shape extends z.ZodRawShape, Parsed = z.infer<z.ZodObject<Shape>>>(
    name: McpToolName,
    scope: string,
    shape: Shape,
    run: (input: Parsed) => Promise<ToolResult>,
    schema?: z.ZodType<Parsed>,
  ) {
    server.registerTool(
      name,
      { description: MCP_TOOL_DESCRIPTIONS[name], inputSchema: shape },
      (async (raw: unknown) => {
        if (!auth.ok || !auth.scopes.includes(scope)) return deny(scope);
        if (!schema) return run(raw as Parsed);
        const parsed = schema.safeParse(raw);
        return parsed.success ? run(parsed.data) : invalid(parsed.error);
      }) as any,
    );
  }

  register("add_job", "jobs:write", McpAddJobInputShape,
    (input) => handleAddJob(input, userId, tokenName), McpAddJobSchema);
  register("find_job", "jobs:write", McpFindJobInputShape,
    (input) => handleFindJob(input, userId), McpFindJobSchema);
  register("update_job", "jobs:write", McpUpdateJobInputShape,
    (input) => handleUpdateJob(input, userId), McpUpdateJobSchema);
  register("add_jobs_batch", "jobs:write", McpAddJobsBatchInputShape,
    (input) => handleAddJobsBatch(input, userId, tokenName), McpAddJobsBatchSchema);
  register("get_job", "jobs:write", McpGetJobInputShape,
    (input) => resumeTools.handleGetJob(input, userId));
  register("search_jobs", "jobs:write", McpSearchJobsInputShape,
    (input) => resumeTools.handleSearchJobs(input, userId));

  register("get_experience_bank", "resume:write", McpGetBankInputShape,
    (input) => resumeTools.handleGetExperienceBank(input, userId));
  register("list_resumes", "resume:write", McpListResumesInputShape,
    (input) => resumeTools.handleListResumes(input, userId));
  register("get_resume", "resume:write", McpGetResumeInputShape,
    (input) => resumeTools.handleGetResume(input, userId));
  register("save_resume_variant", "resume:write", McpSaveVariantInputShape,
    (input) => resumeTools.handleSaveResumeVariant(input as any, userId, tokenName));
  register("save_resume_base", "resume:write", McpSaveBaseInputShape,
    (input) => resumeTools.handleSaveResumeBase(input as any, userId, tokenName));
  register("suggest_bank_additions", "resume:write", McpSuggestBankInputShape,
    (input) => resumeTools.handleSuggestBankAdditions(input as any, userId, tokenName));
  register("save_cover_letter", "resume:write", McpSaveCoverLetterInputShape,
    (input) => resumeTools.handleSaveCoverLetter(input, userId, tokenName));
  register("list_documents", "resume:write", McpListDocumentsInputShape,
    (input) => resumeTools.handleListDocuments(input, userId));

  register("list_targets", "jobs:write", McpListTargetsInputShape,
    (input) => planningTools.handleListTargets(input, userId));
  register("save_target_windows", "jobs:write", McpSaveTargetWindowsInputShape,
    (input) => planningTools.handleSaveTargetWindows(input as any, userId, tokenName));
  register("get_job_stages", "jobs:write", McpGetJobStagesInputShape,
    (input) => planningTools.handleGetJobStages(input, userId));
  register("add_stage", "jobs:write", McpAddStageInputShape,
    (input) => planningTools.handleAddStage(input, userId));
  register("save_stage_notes", "jobs:write", McpSaveStageNotesInputShape,
    (input) => planningTools.handleSaveStageNotes(input, userId));
  register("save_job_requirements", "resume:write", McpSaveJobRequirementsInputShape,
    (input) => planningTools.handleSaveJobRequirements(input as any, userId, tokenName));
  register("get_base_gaps", "resume:write", McpGetBaseGapsInputShape,
    (input) => planningTools.handleGetBaseGaps(input, userId));
  register("save_gap_report", "resume:write", McpSaveGapReportInputShape,
    (input) => planningTools.handleSaveGapReport(input as any, userId, tokenName));

  // Ready-made starting points in clients that surface MCP prompts.
  server.registerPrompt(
    "tailor_resume",
    {
      description: "Tailor a resume variant for a saved job, for your approval in JobSync.",
      argsSchema: { job: z.string().describe("Job id, or the company and role") },
    },
    ({ job }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Tailor a resume for this job in JobSync: ${job}. Follow the JobSync tailoring steps, keep to one page, and give me the review link.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "add_to_bank",
    {
      description: "Turn something you did into experience bank suggestions.",
      argsSchema: { experience: z.string().describe("What you did, in your own words") },
    },
    ({ experience }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Here is something I did. Ask me anything you need to make it concrete and measurable, then propose it with suggest_bank_additions, matching it to an existing bank entry where it belongs:\n\n${experience}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "research_windows",
    {
      description: "Find when applications open and close for your target companies and roles.",
      argsSchema: { targets: z.string().optional().describe("Companies or roles to focus on; blank for all targets") },
    },
    ({ targets }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Research application windows in JobSync${targets ? ` for: ${targets}` : ""}. Start with list_targets, search the web for when applications open and close for the next intake and the role dates, and save each with save_target_windows including the source. Mark anything inferred from earlier years as estimated, and tell me which ones you could not find.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "prep_interview",
    {
      description: "Prepare for an upcoming round on a saved job.",
      argsSchema: { job: z.string().describe("Job id, or the company and role") },
    },
    ({ job }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help me prepare for my next round for this JobSync job: ${job}. Read get_job_stages, get_job and the resume I sent, then save prep notes on the stage with save_stage_notes and walk me through them.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "debrief_interview",
    {
      description: "Record what actually happened in a round and check it against your prep.",
      argsSchema: { job: z.string().describe("Job id, or the company and role") },
    },
    ({ job }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Debrief my latest round for this JobSync job: ${job}. Read get_job_stages, ask me what happened, then save a debrief with save_stage_notes that compares it with the prep notes.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "review_base_gaps",
    {
      description: "Review where a base resume falls short for its kind of role.",
      argsSchema: { base: z.string().describe("Base version id or name, e.g. PM") },
    },
    ({ base }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review the gaps for my "${base}" base version in JobSync. Use get_base_gaps and get_experience_bank, then save a gap report with save_gap_report and summarise it for me.`,
          },
        },
      ],
    }),
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true, // return plain JSON instead of SSE stream
  });

  await server.connect(transport);
  const response = await transport.handleRequest(req);
  await server.close();

  return response;
}

// GET is for SSE server-push streams — not supported in stateless mode
async function getHandler(): Promise<Response> {
  return new Response("Method Not Allowed", { status: 405 });
}

export { getHandler as GET, handler as POST, handler as DELETE };
