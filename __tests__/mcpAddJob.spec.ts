import { handleAddJob } from "@/lib/mcp/tools/addJob";
import { createJobFromNames } from "@/lib/jobs/createJobFromNames";
import { updateJobFromNames } from "@/lib/jobs/updateJobFromNames";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

vi.mock("@/lib/jobs/createJobFromNames", () => ({
  createJobFromNames: vi.fn(),
}));

vi.mock("@/lib/jobs/updateJobFromNames", () => ({
  updateJobFromNames: vi.fn(),
}));

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
const fullDescription = words(200);

const baseInput = {
  company: "Acme",
  jobTitle: "Engineer",
  jobDescription: fullDescription,
};

function mockCreated(completeness: string) {
  (createJobFromNames as any).mockResolvedValue({
    created: true,
    jobId: "job-1",
    resolutions: [],
    descriptionCompleteness: completeness,
    message: "Created Acme; Created Engineer. Job created (id: job-1).",
  });
}

describe("handleAddJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
  });

  it("creates the job with the token as provenance and reports it", async () => {
    mockCreated("full");

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");

    expect(createJobFromNames).toHaveBeenCalledWith(
      expect.objectContaining({ ...baseInput, createdVia: "my-token" }),
      "user-1",
    );
    expect(result.content[0].text).toBe(
      "Created Acme; Created Engineer. Job created (id: job-1).",
    );
  });

  it("passes dueDate to createJobFromNames unchanged, leaving an omitted one to its default", async () => {
    mockCreated("full");
    const dueDate = new Date("2030-02-01T00:00:00Z");

    await handleAddJob({ ...baseInput, dueDate } as any, "user-1", "my-token");
    await handleAddJob(baseInput as any, "user-1", "my-token");

    const calls = (createJobFromNames as any).mock.calls;
    expect(calls[0][0].dueDate).toBe(dueDate);
    expect(calls[1][0].dueDate).toBeUndefined();
  });

  it("returns the duplicate message and points at upsert", async () => {
    (createJobFromNames as any).mockResolvedValue({
      created: false,
      duplicateOf: { id: "job-9", title: "Engineer", company: "Acme" },
      resolutions: [],
      message: 'Duplicate detected — existing job "Engineer" at "Acme" (id: job-9).',
    });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain("Duplicate detected");
    expect(text).toContain("upsert: true");
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 5000 });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(createJobFromNames).not.toHaveBeenCalled();
  });
});

describe("handleAddJob upsert routing", () => {
  const duplicateResult = {
    created: false,
    duplicateOf: { id: "job-9", title: "Engineer", company: "Acme" },
    resolutions: [],
    message: 'Duplicate detected — existing job "Engineer" at "Acme" (id: job-9).',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
  });

  it("updates the existing job instead of duplicating when upsert is true", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated. Fields changed: description.",
    });

    const result = await handleAddJob(
      { ...baseInput, upsert: true } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(updateJobFromNames).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-9", jobDescription: fullDescription }),
      "user-1",
    );
    expect(text).toContain("Job job-9 updated");
    expect(text).not.toContain("Duplicate detected");
  });

  it("does not pass add-only fields through to the update", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: false,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated.",
    });

    await handleAddJob(
      { ...baseInput, upsert: true, allowDuplicate: false } as any,
      "user-1",
      "my-token",
    );

    const passed = (updateJobFromNames as any).mock.calls[0][0];
    expect(passed).not.toHaveProperty("upsert");
    expect(passed).not.toHaveProperty("allowDuplicate");
    expect(passed).not.toHaveProperty("createdVia");
  });

  it("reports the duplicate normally when upsert is not set", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");

    expect(updateJobFromNames).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Duplicate detected");
  });

  it("explains when the duplicate is a web-app job that MCP cannot update", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: false,
      jobId: "job-9",
      descriptionChanged: false,
      descriptionCompleteness: null,
      resolutions: [],
      message: "Job not found, not owned by this token's user, or not eligible",
    });

    const result = await handleAddJob(
      { ...baseInput, upsert: true } as any,
      "user-1",
      "my-token",
    );

    expect(result.content[0].text).toContain("not eligible");
  });
});
