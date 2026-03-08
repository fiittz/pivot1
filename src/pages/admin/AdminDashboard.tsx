import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WhitelistTab from "@/components/admin/WhitelistTab";
import AccountantsTab from "@/components/admin/AccountantsTab";
import OverviewTab from "@/components/admin/OverviewTab";
import PipelineTab from "@/components/admin/PipelineTab";
import DemosTab from "@/components/admin/DemosTab";
import CalendarTab from "@/components/admin/CalendarTab";
import AIComplianceTab from "@/components/admin/AIComplianceTab";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <img
            src="/enhance-penguin-transparent.png"
            alt="Balnce"
            className="w-10 h-10 object-contain"
          />
          <h1 className="text-2xl font-semibold font-['IBM_Plex_Mono'] tracking-wide">
            Platform Admin
          </h1>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="demos">Demos</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="accountants">Accountants</TabsTrigger>
            <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
            <TabsTrigger value="ai-compliance">AI Compliance</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-6">
            <PipelineTab />
          </TabsContent>
          <TabsContent value="demos" className="mt-6">
            <DemosTab />
          </TabsContent>
          <TabsContent value="calendar" className="mt-6">
            <CalendarTab />
          </TabsContent>
          <TabsContent value="accountants" className="mt-6">
            <AccountantsTab />
          </TabsContent>
          <TabsContent value="whitelist" className="mt-6">
            <WhitelistTab />
          </TabsContent>
          <TabsContent value="ai-compliance" className="mt-6">
            <AIComplianceTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
