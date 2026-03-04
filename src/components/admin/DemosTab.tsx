import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, ExternalLink, Loader2, Clock, Users } from "lucide-react";
import { useTodaysDemos, useDemoBookings } from "@/hooks/admin/useDemoBookings";
import { useProspects } from "@/hooks/admin/useCrmProspects";
import type { DemoBooking } from "@/types/crm";
import type { CrmProspect } from "@/types/crm";
import ProspectDetailDialog from "./ProspectDetailDialog";

function DemoRow({
  demo,
  prospect,
  onProspectClick,
}: {
  demo: DemoBooking;
  prospect: CrmProspect | undefined;
  onProspectClick: (p: CrmProspect) => void;
}) {
  const time = new Date(demo.scheduled_at).toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(demo.scheduled_at).toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[50px]">
          <div className="text-sm font-bold">{time}</div>
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{demo.invitee_name}</span>
            {demo.confirmed && (
              <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Confirmed
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{demo.invitee_email}</div>
          {prospect && (
            <button
              className="text-xs text-blue-500 hover:underline mt-0.5"
              onClick={() => onProspectClick(prospect)}
            >
              View in Pipeline
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {demo.meeting_url && (
          <a href={demo.meeting_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <ExternalLink className="h-3 w-3 mr-1" /> Join
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function DemosTab() {
  const { data: todaysDemos, isLoading: todayLoading } = useTodaysDemos();
  const { data: upcomingDemos, isLoading: upcomingLoading } = useDemoBookings();
  const { data: prospects } = useProspects();
  const [selectedProspect, setSelectedProspect] = useState<CrmProspect | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const findProspect = (email: string) =>
    prospects?.find((p) => p.email?.toLowerCase() === email.toLowerCase());

  const handleProspectClick = (p: CrmProspect) => {
    setSelectedProspect(p);
    setDetailOpen(true);
  };

  // Filter upcoming to exclude today's demos
  const futureOnly = upcomingDemos?.filter((d) => {
    const demoDate = new Date(d.scheduled_at).toDateString();
    const today = new Date().toDateString();
    return demoDate !== today;
  });

  const isLoading = todayLoading || upcomingLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const confirmedToday = todaysDemos?.filter((d) => d.confirmed).length ?? 0;
  const totalToday = todaysDemos?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today</CardTitle>
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{totalToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Confirmed</CardTitle>
            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{confirmedToday}/{totalToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">This Week</CardTitle>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{(upcomingDemos?.length ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Unconfirmed</CardTitle>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">
              {upcomingDemos?.filter((d) => !d.confirmed).length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Demos */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Today's Demos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {totalToday === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No demos today</p>
          ) : (
            <div className="divide-y">
              {todaysDemos?.map((d) => (
                <DemoRow
                  key={d.id}
                  demo={d}
                  prospect={findProspect(d.invitee_email)}
                  onProspectClick={handleProspectClick}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Upcoming Demos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {!futureOnly || futureOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No upcoming demos</p>
          ) : (
            <div className="divide-y">
              {futureOnly.map((d) => (
                <DemoRow
                  key={d.id}
                  demo={d}
                  prospect={findProspect(d.invitee_email)}
                  onProspectClick={handleProspectClick}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProspectDetailDialog
        prospect={selectedProspect}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
