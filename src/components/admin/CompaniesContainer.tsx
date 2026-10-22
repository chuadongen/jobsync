"use client";
import { useState } from "react";
import { Loader } from "lucide-react";
import AddCompany from "./AddCompany";
import CompaniesTable from "./CompaniesTable";
import { Card, CardContent, CardTitle } from "../ui/card";
import { ResponsiveCardHeader } from "../ResponsiveCardHeader";
import Loading from "../Loading";
import { RecordsCount } from "../RecordsCount";
import { SearchInput } from "../SearchInput";
import { getCompanyById } from "@/actions/company.actions";
import { CompaniesScopeSelect } from "./companies-container/CompaniesScopeSelect";
import { useCompaniesList } from "./companies-container/useCompaniesList";
import { useCompanyScope } from "./companies-container/useCompanyScope";

function CompaniesContainer() {
  const { scope, setScope } = useCompanyScope();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCompany, setEditCompany] = useState(null);

  const list = useCompaniesList(scope, searchTerm, true);

  const onEditCompany = async (companyId: string) => {
    const company = await getCompanyById(companyId);
    setEditCompany(company);
    setDialogOpen(true);
  };

  return (
    <div className="col-span-3">
      <Card x-chunk="dashboard-06-chunk-0">
        <ResponsiveCardHeader>
          <div className="flex items-baseline gap-2">
            <CardTitle>Companies</CardTitle>
            {!list.initialLoading && list.companies.length > 0 && (
              <RecordsCount
                count={list.companies.length}
                total={list.total}
                label="companies"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
            <CompaniesScopeSelect scope={scope} onScopeChange={setScope} />
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search companies..."
            />
            <AddCompany
              editCompany={editCompany}
              reloadCompanies={list.reload}
              resetEditCompany={() => setEditCompany(null)}
              dialogOpen={dialogOpen}
              setDialogOpen={setDialogOpen}
            />
          </div>
        </ResponsiveCardHeader>
        <CardContent>
          {list.initialLoading && <Loading />}
          {list.companies.length > 0 && (
            <CompaniesTable
              companies={list.companies}
              reloadCompanies={list.reload}
              editCompany={onEditCompany}
              scope={scope}
            />
          )}
          {list.hasMore && (
            <div ref={list.sentinelRef} className="flex justify-center p-4">
              {list.loadingMore && (
                <Loader className="h-5 w-5 animate-spin text-blue-500" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CompaniesContainer;
