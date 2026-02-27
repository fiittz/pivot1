import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Mail, Receipt, Building2 } from "lucide-react";
import { usePlatformOverview } from "@/hooks/admin/usePlatformOverview";

interface StatCardProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
}

function StatCard({ title, value, icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? <span className="animate-pulse">...</span> : (value ?? 0)}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewTab() {
  const { data, isLoading } = usePlatformOverview();

  const stats = [
    { title: "Total Users", value: data?.total_users, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
    { title: "Active Accountants", value: data?.active_accountants, icon: <UserCheck className="h-4 w-4 text-muted-foreground" /> },
    { title: "Suspended", value: data?.suspended_accountants, icon: <UserX className="h-4 w-4 text-muted-foreground" /> },
    { title: "Whitelisted Emails", value: data?.whitelisted_emails, icon: <Mail className="h-4 w-4 text-muted-foreground" /> },
    { title: "Total Transactions", value: data?.total_transactions, icon: <Receipt className="h-4 w-4 text-muted-foreground" /> },
    { title: "Businesses with Transactions", value: data?.businesses_with_transactions, icon: <Building2 className="h-4 w-4 text-muted-foreground" /> },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((s) => (
        <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} loading={isLoading} />
      ))}
    </div>
  );
}
