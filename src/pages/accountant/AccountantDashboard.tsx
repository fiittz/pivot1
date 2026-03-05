import { useNavigate } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountantClientCounts } from "@/hooks/accountant/useAccountantClients";
import { useAccountantTaskCounts } from "@/hooks/accountant/useClientTasks";
import { useFilingCounts } from "@/hooks/accountant/useFilingRecords";
import { ClientStatusChart } from "@/components/accountant/dashboard/ClientStatusChart";
import { FilingDeadlineTimeline } from "@/components/accountant/dashboard/FilingDeadlineTimeline";
import { TasksDueThisWeek } from "@/components/accountant/dashboard/TasksDueThisWeek";
import { RecentActivityFeed } from "@/components/accountant/dashboard/RecentActivityFeed";
import { RevenueCalendar } from "@/components/accountant/dashboard/RevenueCalendar";
import SmartReviewQueue from "@/components/accountant/SmartReviewQueue";

const AccountantDashboard = () => {
  const navigate = useNavigate();
  const { data: counts } = useAccountantClientCounts();
  const { data: taskCounts } = useAccountantTaskCounts();
  const { data: filingCounts } = useFilingCounts();

  const openTasks = (taskCounts?.todo ?? 0) + (taskCounts?.in_progress ?? 0);
  const pendingFilings = (filingCounts?.draft ?? 0) + (filingCounts?.in_review ?? 0);
  const hasClients = (counts?.total ?? 0) > 0;

  const stats = [
    { label: "Active Clients", value: String(counts?.active || 0) },
    { label: "Pending Invites", value: String(counts?.pending || 0) },
    { label: "Pending Filings", value: String(pendingFilings) },
    { label: "Open Tasks", value: String(openTasks) },
  ];

  return (
    <AccountantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Welcome to your practice</h2>
            <p className="text-muted-foreground mt-1">
              Manage your clients, review filings, and generate ROS-compatible returns.
            </p>
          </div>
          <Button
            onClick={() => navigate("/accountant/clients/invite")}
            className="h-10 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none"
          >
            Invite Client
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="py-4 px-5">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {hasClients ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              <SmartReviewQueue />
              <FilingDeadlineTimeline />
              <TasksDueThisWeek />
              <RecentActivityFeed />
            </div>

            {/* Right column — 1/3 width */}
            <div className="space-y-6">
              <ClientStatusChart />
              <RevenueCalendar />
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Get started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Complete your practice settings (TAIN, contact details)</p>
              <p>2. Invite your first client by email</p>
              <p>3. Review their bookkeeping data and filings</p>
              <p>4. Approve and download ROS-compatible XML files</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountantLayout>
  );
};

export default AccountantDashboard;
