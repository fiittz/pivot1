import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Search, Plus, ChevronDown, Loader2 } from "lucide-react";
import { useProspects, useUpdateProspectStage } from "@/hooks/admin/useCrmProspects";
import type { CrmProspect, CrmStage, CrmPriority } from "@/types/crm";
import { STAGE_LABELS, STAGE_ORDER, PRIORITY_LABELS, PRIORITY_COLORS } from "@/types/crm";
import ProspectDetailDialog from "./ProspectDetailDialog";
import AddProspectDialog from "./AddProspectDialog";
import { toast } from "sonner";

const PRIORITY_ORDER: CrmPriority[] = ["top", "high", "medium", "low"];

export default function PipelineTab() {
  const { data: prospects, isLoading } = useProspects();
  const updateStage = useUpdateProspectStage();
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [selectedProspect, setSelectedProspect] = useState<CrmProspect | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!prospects) return [];
    let result = [...prospects];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.area?.toLowerCase().includes(q)) ||
          (p.email?.toLowerCase().includes(q)) ||
          (p.phone?.includes(q))
      );
    }

    if (filterPriority !== "all") {
      result = result.filter((p) => p.priority === filterPriority);
    }
    if (filterStage !== "all") {
      result = result.filter((p) => p.stage === filterStage);
    }

    // Sort: priority order, then name
    result.sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.priority);
      const pb = PRIORITY_ORDER.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [prospects, search, filterPriority, filterStage]);

  const stageCounts = useMemo(() => {
    if (!prospects) return {};
    const counts: Record<string, number> = {};
    for (const p of prospects) {
      counts[p.stage] = (counts[p.stage] || 0) + 1;
    }
    return counts;
  }, [prospects]);

  const handleStageChange = (prospect: CrmProspect, newStage: CrmStage) => {
    updateStage.mutate(
      { prospectId: prospect.id, oldStage: prospect.stage, newStage },
      { onSuccess: () => toast.success(`${prospect.name} → ${STAGE_LABELS[newStage]}`) }
    );
  };

  const openDetail = (p: CrmProspect) => {
    setSelectedProspect(p);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card
          className={`cursor-pointer transition-colors hover:border-primary ${filterStage === "all" ? "border-primary bg-primary/5" : ""}`}
          onClick={() => setFilterStage("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{prospects?.length ?? 0}</div>
          </CardContent>
        </Card>
        {(["new_lead", "contacted", "demo_booked", "pilot", "closed_won"] as CrmStage[]).map((s) => (
          <Card
            key={s}
            className={`cursor-pointer transition-colors hover:border-primary ${filterStage === s ? "border-primary bg-primary/5" : ""}`}
            onClick={() => setFilterStage(filterStage === s ? "all" : s)}
          >
            <CardHeader className="space-y-0 pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{STAGE_LABELS[s]}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{stageCounts[s] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, area, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Prospect
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Priority</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Area</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead className="w-[160px]">Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No prospects found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(p)}>
                  <TableCell>
                    <Badge className={`text-xs ${PRIORITY_COLORS[p.priority]}`}>
                      {PRIORITY_LABELS[p.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{p.area}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm font-mono">{p.phone}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{p.email}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-between">
                          {STAGE_LABELS[p.stage]}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {STAGE_ORDER.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStageChange(p, s)}
                            className={p.stage === s ? "font-bold" : ""}
                          >
                            {STAGE_LABELS[s]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {prospects?.length ?? 0} prospects
      </p>

      <ProspectDetailDialog
        prospect={selectedProspect}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <AddProspectDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
