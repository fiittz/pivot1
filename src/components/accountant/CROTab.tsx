import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, AlertCircle } from "lucide-react";
import { CROCompanyCard } from "./CROCompanyCard";
import { CROFilingHistory } from "./CROFilingHistory";
import { CROAnnualAccountsView } from "./CROAnnualAccountsView";
import { useCROCompany, useSyncCROCompany } from "@/hooks/accountant/useCRO";

interface CROTabProps {
  clientUserId: string;
}

export function CROTab({ clientUserId }: CROTabProps) {
  const { data: company, isLoading } = useCROCompany(clientUserId);
  const syncMutation = useSyncCROCompany();
  const [croNumber, setCroNumber] = useState("");

  const handleLookUp = () => {
    const trimmed = croNumber.trim();
    if (!trimmed) return;
    syncMutation.mutate({ company_num: trimmed, user_id: clientUserId });
  };

  return (
    <div className="space-y-6">
      <CROCompanyCard clientUserId={clientUserId} />

      {company ? (
        <>
          <CROFilingHistory croCompanyId={company.id} />
          <CROAnnualAccountsView croCompanyId={company.id} clientUserId={clientUserId} />
        </>
      ) : (
        !isLoading && (
          <div className="border rounded-lg p-8">
            <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-sm font-semibold mb-1">Link a CRO Company</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Enter a CRO company number to look up and link company details, filing history,
                and annual accounts for this client.
              </p>
              <div className="flex w-full gap-2">
                <Input
                  placeholder="e.g. 123456"
                  value={croNumber}
                  onChange={(e) => setCroNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLookUp();
                  }}
                />
                <Button
                  onClick={handleLookUp}
                  disabled={!croNumber.trim() || syncMutation.isPending}
                >
                  <Search className="h-4 w-4 mr-1" />
                  Look Up
                </Button>
              </div>
              {syncMutation.isError && (
                <div className="flex items-center gap-1 mt-3 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {syncMutation.error?.message ?? "Failed to look up company"}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
