import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const filingBadgeStyles: Record<string, string> = {
  CT1: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Form 11": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  VAT3: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

interface CalendarEntry {
  quarter: string;
  months: string;
  filings: { type: string; detail: string }[];
}

const annualSchedule: CalendarEntry[] = [
  {
    quarter: "Q1",
    months: "Jan – Mar",
    filings: [
      { type: "VAT3", detail: "Jan–Feb return due 19 Mar" },
    ],
  },
  {
    quarter: "Q2",
    months: "Apr – Jun",
    filings: [
      { type: "VAT3", detail: "Mar–Apr return due 19 May" },
      { type: "VAT3", detail: "May–Jun return due 19 Jul" },
    ],
  },
  {
    quarter: "Q3",
    months: "Jul – Sep",
    filings: [
      { type: "VAT3", detail: "Jul–Aug return due 19 Sep" },
      { type: "CT1", detail: "CT1 due 21 Sep (Dec year-end)" },
    ],
  },
  {
    quarter: "Q4",
    months: "Oct – Dec",
    filings: [
      { type: "Form 11", detail: "Form 11 due 31 Oct" },
      { type: "VAT3", detail: "Sep–Oct return due 19 Nov" },
    ],
  },
];

export function RevenueCalendar() {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-bold text-lg mb-5">Revenue Calendar</h3>

        <div className="space-y-4">
          {annualSchedule.map((q) => (
            <div key={q.quarter}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{q.quarter}</span>
                <span className="text-xs text-muted-foreground">{q.months}</span>
              </div>
              <div className="space-y-1.5 pl-2 border-l-2 border-border">
                {q.filings.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 pl-3">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${filingBadgeStyles[f.type] ?? ""}`}>
                      {f.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{f.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
