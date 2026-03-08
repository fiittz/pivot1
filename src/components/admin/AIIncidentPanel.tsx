import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Circle, Clock, Plus, Shield, Search, Loader2 } from "lucide-react";
import { useAIIncidents, type AIIncident } from "@/hooks/useAIIncidents";

const AI_SYSTEMS = [
  "Transaction Auto-Categorisation",
  "Transaction Auto-Matching",
  "Receipt OCR & Extraction",
  "Email Triage & Routing",
  "Vendor Intelligence Lookup",
  "Chat Assistant",
  "Anomaly Detection",
  "Vendor Matching (Rule-based)",
];

const SEVERITY_CONFIG = {
  critical: { color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400", icon: AlertTriangle },
  high: { color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400", icon: AlertTriangle },
  medium: { color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", icon: Clock },
  low: { color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", icon: Circle },
};

const STATUS_CONFIG = {
  open: { color: "bg-red-100 text-red-700", label: "Open" },
  investigating: { color: "bg-amber-100 text-amber-700", label: "Investigating" },
  resolved: { color: "bg-green-100 text-green-700", label: "Resolved" },
  closed: { color: "bg-muted text-muted-foreground", label: "Closed" },
};

export default function AIIncidentPanel() {
  const { incidents, createIncident, updateIncident, resolveIncident, deleteIncident, openCount } = useAIIncidents();
  const [showCreate, setShowCreate] = useState(false);
  const [showResolve, setShowResolve] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create form state
  const [newSystem, setNewSystem] = useState(AI_SYSTEMS[0]);
  const [newSeverity, setNewSeverity] = useState<AIIncident["severity"]>("medium");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImpact, setNewImpact] = useState("");
  const [newReportedBy, setNewReportedBy] = useState("System");

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createIncident({
      system: newSystem,
      severity: newSeverity,
      title: newTitle,
      description: newDescription,
      impact: newImpact,
      reportedBy: newReportedBy,
    });
    setShowCreate(false);
    setNewTitle("");
    setNewDescription("");
    setNewImpact("");
  };

  const handleResolve = (id: string) => {
    if (!resolution.trim()) return;
    resolveIncident(id, resolution);
    setShowResolve(null);
    setResolution("");
  };

  const filtered = incidents.filter((inc) => {
    if (statusFilter !== "all" && inc.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return inc.title.toLowerCase().includes(q) || inc.system.toLowerCase().includes(q) || inc.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Incidents</p>
            <p className="text-2xl font-bold mt-1">{incidents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Open</p>
            <p className={`text-2xl font-bold mt-1 ${openCount > 0 ? "text-red-600" : "text-green-600"}`}>{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Resolved</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{incidents.filter((i) => i.status === "resolved" || i.status === "closed").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Critical</p>
            <p className="text-2xl font-bold mt-1">{incidents.filter((i) => i.severity === "critical" && i.status !== "resolved" && i.status !== "closed").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Report Incident
        </Button>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search incidents..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
            <SelectItem value="open" className="text-xs">Open</SelectItem>
            <SelectItem value="investigating" className="text-xs">Investigating</SelectItem>
            <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
            <SelectItem value="closed" className="text-xs">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* EU AI Act notice */}
      <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">EU AI Act — Article 62: Serious Incident Reporting</p>
          <p className="mt-1">
            Providers of high-risk AI systems must report serious incidents to the relevant market surveillance authority.
            Balnce's AI systems are classified as <strong>Limited Risk</strong> — formal reporting to authorities is not mandatory,
            but maintaining an internal incident log is best practice for demonstrating compliance.
          </p>
          <p className="mt-1">
            For serious incidents (critical severity), consider notifying the Data Protection Commission if personal data is affected.
          </p>
        </div>
      </div>

      {/* Incident list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-3" />
            <p className="text-sm font-medium">No incidents{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}</p>
            <p className="text-xs text-muted-foreground mt-1">All AI systems are operating normally.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inc) => {
            const sevConfig = SEVERITY_CONFIG[inc.severity];
            const statConfig = STATUS_CONFIG[inc.status];
            const SevIcon = sevConfig.icon;

            return (
              <Card key={inc.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <SevIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${inc.severity === "critical" || inc.severity === "high" ? "text-red-500" : "text-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{inc.title}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sevConfig.color}`}>{inc.severity}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statConfig.color}`}>{statConfig.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{inc.system} &middot; {new Date(inc.timestamp).toLocaleDateString("en-IE")} &middot; Reported by {inc.reportedBy}</p>
                      {inc.description && <p className="text-xs mt-2">{inc.description}</p>}
                      {inc.impact && <p className="text-xs text-muted-foreground mt-1"><strong>Impact:</strong> {inc.impact}</p>}
                      {inc.resolution && (
                        <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-700 dark:text-green-400"><strong>Resolution:</strong> {inc.resolution}</p>
                          {inc.resolvedAt && <p className="text-[10px] text-green-600 mt-0.5">Resolved {new Date(inc.resolvedAt).toLocaleDateString("en-IE")}</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {(inc.status === "open" || inc.status === "investigating") && (
                        <>
                          {inc.status === "open" && (
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => updateIncident(inc.id, { status: "investigating" })}>
                              Investigate
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => { setShowResolve(inc.id); setResolution(""); }}>
                            Resolve
                          </Button>
                        </>
                      )}
                      {inc.status === "resolved" && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => updateIncident(inc.id, { status: "closed" })}>
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report AI Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">AI System</label>
              <Select value={newSystem} onValueChange={setNewSystem}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_SYSTEMS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Severity</label>
              <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as AIIncident["severity"])}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical" className="text-xs">Critical — System down or data loss</SelectItem>
                  <SelectItem value="high" className="text-xs">High — Major incorrect decisions</SelectItem>
                  <SelectItem value="medium" className="text-xs">Medium — Minor errors or degraded accuracy</SelectItem>
                  <SelectItem value="low" className="text-xs">Low — Cosmetic or minor issues</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Title</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Brief summary of the incident" className="text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Description</label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="What happened? Include transaction IDs or user impact if relevant." className="text-xs" rows={3} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Impact</label>
              <Input value={newImpact} onChange={(e) => setNewImpact(e.target.value)} placeholder="e.g. 5 transactions miscategorised, 1 user affected" className="text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Reported By</label>
              <Input value={newReportedBy} onChange={(e) => setNewReportedBy(e.target.value)} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim()}>Report Incident</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={!!showResolve} onOpenChange={() => setShowResolve(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium mb-1 block">Resolution</label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe what was done to resolve this incident..." className="text-xs" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolve(null)}>Cancel</Button>
            <Button onClick={() => showResolve && handleResolve(showResolve)} disabled={!resolution.trim()}>Mark Resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
