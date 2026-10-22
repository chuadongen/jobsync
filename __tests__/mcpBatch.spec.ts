import { handleAddJobsBatch } from "@/lib/mcp/tools/addJobsBatch";
import { handleAddJob } from "@/lib/mcp/tools/addJob";

vi.mock("@/lib/mcp/tools/addJob", () => ({ handleAddJob: vi.fn() }));

const job = (company: string) => ({
  company,
  jobTitle: "Engineer",
  jobDescription: "x".repeat(60),
});

describe("handleAddJobsBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("processes every item in order and labels each result", async () => {
    (handleAddJob as any)
      .mockResolvedValueOnce({ content: [{ type: "text", text: "first ok" }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "second ok" }] });

    const result = await handleAddJobsBatch(
      { jobs: [job("Acme"), job("Globex")] } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(handleAddJob).toHaveBeenCalledTimes(2);
    expect(text).toContain("[1/2] Acme — Engineer: first ok");
    expect(text).toContain("[2/2] Globex — Engineer: second ok");
    expect(text.indexOf("[1/2]")).toBeLessThan(text.indexOf("[2/2]"));
  });

  it("runs items sequentially, not concurrently", async () => {
    const order: string[] = [];
    (handleAddJob as any).mockImplementation(async (input: any) => {
      order.push(`start-${input.company}`);
      await new Promise((r) => setTimeout(r, 0));
      order.push(`end-${input.company}`);
      return { content: [{ type: "text", text: "ok" }] };
    });

    await handleAddJobsBatch(
      { jobs: [job("Acme"), job("Globex")] } as any,
      "user-1",
      "my-token",
    );

    expect(order).toEqual([
      "start-Acme",
      "end-Acme",
      "start-Globex",
      "end-Globex",
    ]);
  });

  it("continues after a failing item and reports the error inline", async () => {
    (handleAddJob as any)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ content: [{ type: "text", text: "second ok" }] });

    const result = await handleAddJobsBatch(
      { jobs: [job("Acme"), job("Globex")] } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain("[1/2] Acme — Engineer: Error: boom");
    expect(text).toContain("[2/2] Globex — Engineer: second ok");
  });

  it("stops the run when an item hits the rate limit", async () => {
    (handleAddJob as any)
      .mockResolvedValueOnce({ content: [{ type: "text", text: "first ok" }] })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Rate limit exceeded. Try again in 30s." }],
      });

    const result = await handleAddJobsBatch(
      { jobs: [job("A"), job("B"), job("C")] } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(handleAddJob).toHaveBeenCalledTimes(2);
    expect(text).toContain("Rate limit exceeded");
    expect(text).toContain("1 item(s) not attempted");
  });
});

