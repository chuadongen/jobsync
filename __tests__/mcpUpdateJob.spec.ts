import { handleUpdateJob } from "@/lib/mcp/tools/updateJob";
import { updateJobFromNames } from "@/lib/jobs/updateJobFromNames";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

vi.mock("@/lib/jobs/updateJobFromNames", () => ({
  updateJobFromNames: vi.fn(),
}));

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe("handleUpdateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
  });

  it("returns the helper's message on a successful update", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: false,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: statusId.",
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", status: "applied" } as any,
      "user-1",
    );

    expect(result.content[0].text).toBe("Job job-1 updated. Fields changed: statusId.");
  });

  it("returns the helper's message unchanged when the update failed", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: false,
      jobId: "job-x",
      descriptionChanged: false,
      descriptionCompleteness: null,
      resolutions: [],
      message: "Job not found, not owned by this token's user, or not eligible",
    });

    const result = await handleUpdateJob(
      { jobId: "job-x", salaryRange: "$1" } as any,
      "user-1",
    );

    expect(result.content[0].text).toContain("not found");
  });

  it("surfaces resolver errors as an Error: message", async () => {
    (updateJobFromNames as any).mockRejectedValue(
      new Error('Invalid jobType "Freelance". Valid values: Full-time, Part-time, Contract'),
    );

    const result = await handleUpdateJob(
      { jobId: "job-1", jobType: "Freelance" } as any,
      "user-1",
    );

    expect(result.content[0].text).toContain("Invalid jobType");
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 7000 });

    const result = await handleUpdateJob({ jobId: "job-1" } as any, "user-1");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(updateJobFromNames).not.toHaveBeenCalled();
  });
});
