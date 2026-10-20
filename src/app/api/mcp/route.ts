import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveMcpToken } from "@/lib/mcp/auth";
import { MCP_TOOL_DESCRIPTIONS } from "@/lib/mcp/toolDescriptions";
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
import { handleAddJob } from "@/lib/mcp/tools/addJob";
import { handleFindJob } from "@/lib/mcp/tools/findJob";
import { handleUpdateJob } from "@/lib/mcp/tools/updateJob";
import { handleAddJobsBatch } from "@/lib/mcp/tools/addJobsBatch";

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

  const server = new McpServer({ name: "jobsync", version: "1.0.0" });

  server.tool(
    "add_job",
    MCP_TOOL_DESCRIPTIONS.add_job,
    McpAddJobInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpAddJobSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleAddJob(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "find_job",
    MCP_TOOL_DESCRIPTIONS.find_job,
    McpFindJobInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            { type: "text" as const, text: "Insufficient scope. Required: jobs:write" },
          ],
        };
      }
      const parsed = McpFindJobSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [{ type: "text" as const, text: `Validation error: ${issues}` }],
        };
      }
      return handleFindJob(parsed.data, userId);
    },
  );

  server.tool(
    "update_job",
    MCP_TOOL_DESCRIPTIONS.update_job,
    McpUpdateJobInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            { type: "text" as const, text: "Insufficient scope. Required: jobs:write" },
          ],
        };
      }
      const parsed = McpUpdateJobSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [{ type: "text" as const, text: `Validation error: ${issues}` }],
        };
      }
      return handleUpdateJob(parsed.data, userId);
    },
  );

  server.tool(
    "add_jobs_batch",
    MCP_TOOL_DESCRIPTIONS.add_jobs_batch,
    McpAddJobsBatchInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            { type: "text" as const, text: "Insufficient scope. Required: jobs:write" },
          ],
        };
      }
      const parsed = McpAddJobsBatchSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [{ type: "text" as const, text: `Validation error: ${issues}` }],
        };
      }
      return handleAddJobsBatch(parsed.data, userId, tokenName);
    },
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
