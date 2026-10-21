import { Metadata } from "next";

import { getJobSourceList, getStatusList } from "@/actions/job.actions";
import JobsContainer from "@/components/myjobs/JobsContainer";
import { getAllCompanies } from "@/actions/company.actions";
import { getAllJobTitles } from "@/actions/jobtitle.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllTags } from "@/actions/tag.actions";
import { getTargets } from "@/actions/seasons.actions";
import { getAvailabilityBlocks } from "@/actions/availability.actions";
import { SeasonsBar } from "@/components/seasons/SeasonsBar";
import type { AvailabilityBlock } from "@/models/availability.model";

export const metadata: Metadata = {
  title: "My Jobs | JobSync",
};

async function MyJobs() {
  const [statuses, companies, titles, locations, sources, tags, targets, blocks] =
    await Promise.all([
      getStatusList(),
      getAllCompanies(),
      getAllJobTitles(),
      getAllJobLocations(),
      getJobSourceList(),
      getAllTags(),
      getTargets(),
      getAvailabilityBlocks(),
    ]);
  return (
    <div className="col-span-3">
      <SeasonsBar
        compact
        targets={targets.success ? targets.data : []}
        blocks={(blocks.success ? blocks.data : []) as AvailabilityBlock[]}
      />
      <JobsContainer
        companies={companies}
        titles={titles}
        locations={locations}
        sources={sources}
        statuses={statuses}
        tags={tags ?? []}
      />
    </div>
  );
}

export default MyJobs;
