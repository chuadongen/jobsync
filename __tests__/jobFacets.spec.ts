import {
  EMPTY_JOB_FACETS,
  countJobFacets,
  hasJobFacets,
  normalizeJobFacets,
  parseJobFacets,
  writeJobFacets,
} from "@/lib/jobs/jobFacets";

describe("jobFacets", () => {
  describe("parseJobFacets", () => {
    it("returns empty facets for a bare URL", () => {
      expect(parseJobFacets(new URLSearchParams())).toEqual(EMPTY_JOB_FACETS);
    });

    it("reads every facet param", () => {
      const params = new URLSearchParams(
        "status=applied,interview&type=IN,C&workplace=REMOTE",
      );
      expect(parseJobFacets(params)).toEqual({
        statuses: ["applied", "interview"],
        jobTypes: ["IN", "C"],
        workplaces: ["REMOTE"],
      });
    });

    it("drops unknown and duplicate values", () => {
      const params = new URLSearchParams(
        "status=bogus,applied,applied&type=fulltime&workplace=REMOTE,REMOTE",
      );
      expect(parseJobFacets(params)).toEqual({
        ...EMPTY_JOB_FACETS,
        statuses: ["applied"],
        workplaces: ["REMOTE"],
      });
    });

    it("reads comma lists that were percent-encoded", () => {
      const params = new URLSearchParams("status=applied%2Cinterview");
      expect(parseJobFacets(params).statuses).toEqual(["applied", "interview"]);
    });
  });

  describe("normalizeJobFacets", () => {
    it("orders values canonically so equal picks compare equal", () => {
      const a = normalizeJobFacets({ statuses: ["interview", "applied"] });
      const b = normalizeJobFacets({ statuses: ["applied", "interview"] });
      expect(a).toEqual(b);
    });

    it("fills missing keys from empty", () => {
      expect(normalizeJobFacets(undefined)).toEqual(EMPTY_JOB_FACETS);
    });
  });

  describe("writeJobFacets", () => {
    it("keeps unrelated params and removes cleared facets", () => {
      const before = new URLSearchParams(
        "company=google&applied=true&status=draft",
      );
      const after = writeJobFacets(before, {
        ...EMPTY_JOB_FACETS,
        workplaces: ["HYBRID"],
      });
      expect(after.get("company")).toBe("google");
      expect(after.get("applied")).toBe("true");
      expect(after.get("workplace")).toBe("HYBRID");
      expect(after.has("status")).toBe(false);
      expect(before.get("status")).toBe("draft");
    });

    it("round-trips through parseJobFacets", () => {
      const facets = {
        statuses: ["applied", "offer"],
        jobTypes: ["PT"],
        workplaces: ["REMOTE", "ONSITE"],
      };
      const params = writeJobFacets(new URLSearchParams(), facets);
      expect(parseJobFacets(params)).toEqual(facets);
    });
  });

  describe("countJobFacets", () => {
    it("counts every picked value", () => {
      expect(
        countJobFacets({
          statuses: ["applied", "interview"],
          jobTypes: ["FT"],
          workplaces: ["REMOTE"],
        }),
      ).toBe(4);
      expect(hasJobFacets(EMPTY_JOB_FACETS)).toBe(false);
    });
  });
});
