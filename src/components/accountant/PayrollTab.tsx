import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Receipt, Banknote, Shield } from "lucide-react";
import { EmployeeList } from "./EmployeeList";
import { PayrollRunView } from "./PayrollRunView";
import { DividendManager } from "./DividendManager";
import { AutoEnrolmentPanel } from "./AutoEnrolmentPanel";

interface PayrollTabProps {
  clientUserId: string;
  taxYear: number;
}

export function PayrollTab({ clientUserId, taxYear }: PayrollTabProps) {
  const [activeSection, setActiveSection] = useState("employees");

  return (
    <div className="space-y-4">
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList>
          <TabsTrigger value="employees" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="payruns" className="gap-1.5 text-xs">
            <Receipt className="w-3.5 h-3.5" />
            Pay Runs
          </TabsTrigger>
          <TabsTrigger value="dividends" className="gap-1.5 text-xs">
            <Banknote className="w-3.5 h-3.5" />
            Dividends
          </TabsTrigger>
          <TabsTrigger value="auto-enrolment" className="gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" />
            Auto-Enrolment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeeList clientUserId={clientUserId} />
        </TabsContent>

        <TabsContent value="payruns">
          <PayrollRunView clientUserId={clientUserId} taxYear={taxYear} />
        </TabsContent>

        <TabsContent value="dividends">
          <DividendManager clientUserId={clientUserId} taxYear={taxYear} />
        </TabsContent>

        <TabsContent value="auto-enrolment">
          <AutoEnrolmentPanel clientUserId={clientUserId} taxYear={taxYear} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
