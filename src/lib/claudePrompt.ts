import { toastError, toastSuccess } from "@/lib/toast";

// Work with Claude runs on the user's own subscription through the MCP
// server, so the app's part is handing over a prompt that names the ids.
export async function copyClaudePrompt(prompt: string) {
  try {
    await navigator.clipboard.writeText(prompt);
    toastSuccess("Prompt copied. Paste it into Claude.");
  } catch {
    toastError("Could not copy the prompt to the clipboard.");
  }
}

export const RESEARCH_WINDOWS_PROMPT =
  "Using my JobSync tools, research application windows for my targets. Start with list_targets, look up when applications open and close for the next intake (and the role dates), and save them with save_target_windows with a source for each. Mark anything inferred from earlier years as estimated, and tell me which ones you could not find.";
