import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, RefreshCw, MapPin, Calendar, AlertCircle } from "lucide-react";
import { useCROCompany, useSyncCROCompany } from "@/hooks/accountant/useCRO";
import { getARStatus } from "@/types/cro";

interface CROCompanyCardProps {
  clientUserId: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">Unknown</Badge>;
  const lower = status.toLowerCase();
  if (lower === "normal")
    return <Badge className="bg-green-100 text-green-700 border-green-200">{status}</Badge>;
  if (lower.includes("strike") || lower.includes("dissolved"))
    return <Badge className="bg-red-100 text-red-700 border-red-200">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function arStatusBadge(nextArDate: string | null) {
  const status = getARStatus(nextArDate);
  const config: Record<string, { label: string; className: string }> = {
    ok: { label: "On Track", className: "bg-green-100 text-green-700 border-green-200" },
    due_soon: { label: "Due Soon", className: "bg-amber-100 text-amber-700 border-amber-200" },
    overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const c = config[status];
  return <Badge className={c.className}>{c.label}</Badge>;
}

function buildAddress(company: {
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  address_line4: string | null;
}): string {
  return [company.address_line1, company.address_line2, company.address_line3, company.address_line4]
    .filter(Boolean)
    .join(", ");
}

export function CROCompanyCard({ clientUserId }: CROCompanyCardProps) {
  const { data: company, isLoading } = useCROCompany(clientUserId);
  const syncMutation = useSyncCROCompany();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            CRO Company Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            CRO Company Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">No CRO company linked</p>
            <p className="text-xs mt-1">Link a CRO number to view company details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const address = buildAddress(company);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          CRO Company Profile
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={syncMutation.isPending}
          onClick={() =>
            syncMutation.mutate({
              company_num: company.company_num,
              user_id: company.user_id ?? undefined,
            })
          }
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sync from CRO
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Company Name</span>
            <p className="font-medium">{company.company_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">CRO Number</span>
            <p className="font-medium">{company.company_num}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="mt-0.5">{statusBadge(company.company_status_desc)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Company Type</span>
            <p className="font-medium">{company.comp_type_desc ?? "\u2014"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Registration Date</span>
            <p className="font-medium">{formatDate(company.company_reg_date)}</p>
          </div>
          {address && (
            <div>
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Registered Address
              </span>
              <p className="font-medium">{address}</p>
            </div>
          )}
          {company.eircode && (
            <div>
              <span className="text-muted-foreground">Eircode</span>
              <p className="font-medium">{company.eircode}</p>
            </div>
          )}
        </div>

        {/* AR Dates */}
        <div className="border-t pt-3">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Annual Return Dates
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Last AR Filed</span>
              <p className="font-medium">{formatDate(company.last_ar_date)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Next AR Due</span>
              <div className="flex items-center gap-2">
                <p className="font-medium">{formatDate(company.next_ar_date)}</p>
                {arStatusBadge(company.next_ar_date)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Last Accounts Date</span>
              <p className="font-medium">{formatDate(company.last_acc_date)}</p>
            </div>
          </div>
        </div>

        {/* Last synced */}
        {company.last_synced_at && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            Last synced: {formatDate(company.last_synced_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
