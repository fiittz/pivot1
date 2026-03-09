import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import { useCROFilings } from "@/hooks/accountant/useCRO";

interface CROFilingHistoryProps {
  croCompanyId: string;
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

function filingStatusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">Unknown</Badge>;
  const lower = status.toLowerCase();
  if (lower === "registered")
    return <Badge className="bg-green-100 text-green-700 border-green-200">{status}</Badge>;
  if (lower === "pending")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{status}</Badge>;
  if (lower === "rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-200">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export function CROFilingHistory({ croCompanyId }: CROFilingHistoryProps) {
  const { data: filings, isLoading } = useCROFilings(croCompanyId);

  const sortedFilings = [...(filings ?? [])].sort((a, b) => {
    const dateA = a.sub_received_date ? new Date(a.sub_received_date).getTime() : 0;
    const dateB = b.sub_received_date ? new Date(b.sub_received_date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Filing History
          {!isLoading && sortedFilings.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({sortedFilings.length} filing{sortedFilings.length !== 1 ? "s" : ""})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading filings...</div>
        ) : sortedFilings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">No filings found</p>
            <p className="text-xs mt-1">CRO filing history will appear here after syncing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Received</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts Year End</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilings.map((filing) => (
                  <TableRow key={filing.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(filing.sub_received_date)}
                    </TableCell>
                    <TableCell>{filing.sub_type_desc}</TableCell>
                    <TableCell>{filing.doc_type_desc ?? "\u2014"}</TableCell>
                    <TableCell>{filingStatusBadge(filing.sub_status_desc)}</TableCell>
                    <TableCell>{formatDate(filing.acc_year_to_date)}</TableCell>
                    <TableCell className="text-right">{filing.num_pages ?? "\u2014"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
