import { JOB_STATUS_VALUES } from "@/lib/constants";
import { JOB_TYPES, JobFacets, WORKPLACE_TYPES } from "@/models/job.model";

export const EMPTY_JOB_FACETS: JobFacets = {
  statuses: [],
  jobTypes: [],
  workplaces: [],
};

const PARAM = {
  statuses: "status",
  jobTypes: "type",
  workplaces: "workplace",
} as const;

const JOB_TYPE_CODES = Object.keys(JOB_TYPES);
const WORKPLACE_CODES = Object.keys(WORKPLACE_TYPES);

// Filtering the whitelist (not the input) dedupes and fixes the order.
const pick = (values: readonly string[] | undefined, allowed: string[]) =>
  allowed.filter((value) => values?.includes(value));

export function normalizeJobFacets(
  input?: Partial<JobFacets> | null,
): JobFacets {
  return {
    statuses: pick(input?.statuses, JOB_STATUS_VALUES),
    jobTypes: pick(input?.jobTypes, JOB_TYPE_CODES),
    workplaces: pick(input?.workplaces, WORKPLACE_CODES),
  };
}

const readList = (params: URLSearchParams, key: string) =>
  params.get(key)?.split(",") ?? [];

export function parseJobFacets(params: URLSearchParams): JobFacets {
  return normalizeJobFacets({
    statuses: readList(params, PARAM.statuses),
    jobTypes: readList(params, PARAM.jobTypes),
    workplaces: readList(params, PARAM.workplaces),
  });
}

export function writeJobFacets(
  params: URLSearchParams,
  facets: JobFacets,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const setList = (key: string, values: string[]) =>
    values.length ? next.set(key, values.join(",")) : next.delete(key);

  setList(PARAM.statuses, facets.statuses);
  setList(PARAM.jobTypes, facets.jobTypes);
  setList(PARAM.workplaces, facets.workplaces);
  return next;
}

export const countJobFacets = (facets: JobFacets) =>
  facets.statuses.length +
  facets.jobTypes.length +
  facets.workplaces.length;

export const hasJobFacets = (facets: JobFacets) => countJobFacets(facets) > 0;
