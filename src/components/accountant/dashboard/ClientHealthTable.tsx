import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientHealthRow } from "@/hooks/accountant/usePracticeKPIs";

const STATUS_STYLES: Record<string, string> = {
  up_to_date: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  up_to_date: "Up to date",
  pending: "Pending",
  overdue: "Needs attention",
};

type SortKey = "clientName" | "uncategorizedCount" | "categorizationRate" | "lastActivity";

interface Props {
  rows: ClientHealthRow[];
}

export function ClientHealthTable({ rows }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("uncategorizedCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    let filtered = rows;
    if (search) {
      const q = search.toLowerCase();
      filtered = rows.filter((r) => r.clientName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "clientName":
          cmp = a.clientName.localeCompare(b.clientName);
          break;
        case "uncategorizedCount":
          cmp = a.uncategorizedCount - b.uncategorizedCount;
          break;
        case "categorizationRate":
          cmp = a.categorizationRate - b.categorizationRate;
          break;
        case "lastActivity":
          cmp = (a.lastActivity || "").localeCompare(b.lastActivity || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Client Health</CardTitle>
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5">
                  <SortHeader label="Client" field="clientName" />
                </th>
                <th className="text-right px-5 py-2.5">
                  <SortHeader label="Uncategorized" field="uncategorizedCount" />
                </th>
                <th className="text-right px-5 py-2.5">
                  <SortHeader label="Cat. Rate" field="categorizationRate" />
                </th>
                <th className="text-right px-5 py-2.5">
                  <SortHeader label="Last Activity" field="lastActivity" />
                </th>
                <th className="text-center px-5 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                </th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.clientId}
                  className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/accountant/clients/${row.clientId}`)}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium">{row.clientName}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">
                    {row.uncategorizedCount}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`tabular-nums font-medium ${row.categorizationRate >= 80 ? "text-green-600" : row.categorizationRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {row.categorizationRate}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                    {row.lastActivity
                      ? new Date(row.lastActivity).toLocaleDateString("en-IE", { day: "numeric", month: "short" })
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[row.filingStatus]}`}>
                      {STATUS_LABELS[row.filingStatus]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {search ? "No clients match your search" : "No clients yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
