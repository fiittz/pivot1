import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientCard } from "@/components/accountant/ClientCard";
import {
  useAccountantClients,
  useAccountantClientCounts,
} from "@/hooks/accountant/useAccountantClients";
import { Plus, Search, Users, UserCheck, Clock, Archive } from "lucide-react";
import type { ClientStatus } from "@/types/accountant";

type FilterTab = "all" | ClientStatus;

const ClientList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const statusFilter = activeFilter === "all" ? undefined : activeFilter;
  const { data: clients = [], isLoading } = useAccountantClients({
    status: statusFilter,
    search: search || undefined,
  });
  const { data: counts } = useAccountantClientCounts();

  const filterTabs: { key: FilterTab; label: string; count: number; icon: React.ElementType }[] = [
    { key: "all", label: "All", count: counts?.total || 0, icon: Users },
    { key: "active", label: "Active", count: counts?.active || 0, icon: UserCheck },
    { key: "pending_invite", label: "Pending", count: counts?.pending || 0, icon: Clock },
    { key: "archived", label: "Archived", count: counts?.archived || 0, icon: Archive },
  ];

  return (
    <AccountantLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Clients</h2>
            <p className="text-muted-foreground mt-1">
              Manage your client relationships and invitations.
            </p>
          </div>
          <Button
            onClick={() => navigate("/accountant/clients/invite")}
            className="h-10 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Invite Client
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span
                  className={`text-xs ${isActive ? "text-foreground" : "text-muted-foreground/70"}`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or business..."
            className="pl-9 h-10 bg-transparent border-border"
          />
        </div>

        {/* Client list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {search || activeFilter !== "all" ? "No clients found" : "No clients yet"}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {search || activeFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Invite your first client to get started."}
              </p>
              {!search && activeFilter === "all" && (
                <Button
                  onClick={() => navigate("/accountant/clients/invite")}
                  variant="outline"
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Invite Client
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onClick={
                  client.client_user_id
                    ? () => navigate(`/accountant/clients/${client.client_user_id}`)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </AccountantLayout>
  );
};

export default ClientList;
