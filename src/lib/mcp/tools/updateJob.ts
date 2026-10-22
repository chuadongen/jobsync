import { z } from "zod";
import { McpUpdateJobSchema } from "@/models/mcp.schema";
import { updateJobFromNames } from "@/lib/jobs/updateJobFromNames";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

export async function handleUpdateJob(
  input: z.infer<typeof McpUpdateJobSchema>,
  userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const rateCheck = checkMcpRateLimit(userId);
  if (!rateCheck.allowed) {
    const resetSec = Math.ceil(rateCheck.resetIn / 1000);
    return {
      content: [{ type: "text", text: `Rate limit exceeded. Try again in ${resetSec}s.` }],
    };
  }

  try {
    const result = await updateJobFromNames(input, userId);
    return { content: [{ type: "text", text: result.message }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
