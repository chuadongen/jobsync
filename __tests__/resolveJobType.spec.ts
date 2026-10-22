import { resolveJobType } from "@/lib/jobs/resolve";

describe("resolveJobType", () => {
  it("resolves a valid key", () => {
    expect(resolveJobType("FT")).toBe("FT");
  });

  it("resolves a valid label", () => {
    expect(resolveJobType("Contract")).toBe("C");
  });

  it("resolves case-insensitively", () => {
    expect(resolveJobType("part-time")).toBe("PT");
  });

  it("resolves a separator variant of a label", () => {
    expect(resolveJobType("Full time")).toBe("FT");
    expect(resolveJobType("parttime")).toBe("PT");
  });

  it("defaults to the first entry, Internship, for empty input", () => {
    expect(resolveJobType(undefined)).toBe("IN");
    expect(resolveJobType("")).toBe("IN");
  });

  it("resolves Internship", () => {
    expect(resolveJobType("internship")).toBe("IN");
  });

  it("throws a helpful message for an invalid value", () => {
    expect(() => resolveJobType("Freelance")).toThrow(
      /Invalid jobType "Freelance"\. Valid values: Internship, Full-time, Part-time, Contract/,
    );
  });
});
