import type { AccountantClient } from "@/types/accountant";

export type DeadlineStatus = "upcoming" | "due_soon" | "overdue";
export type DeadlineType = "ct1" | "form11" | "vat";

export interface AccountantDeadline {
  clientId: string;
  clientName: string;
  filingType: DeadlineType;
  label: string;
  dueDate: Date;
  status: DeadlineStatus;
  daysLabel: string;
}

/**
 * CT1 due date: 9 months + 21 days after accounting year-end.
 * yearEndMonth is 1-indexed (1=Jan, 12=Dec). Defaults to December if null.
 */
export function computeCT1Deadline(
  yearEndMonth: number | null,
  referenceDate: Date,
): Date {
  const month = yearEndMonth ?? 12; // default December
  const refYear = referenceDate.getFullYear();

  // Year-end is last day of the year-end month in the current (or previous) tax cycle
  // Determine which year-end is most relevant: if we're past the deadline for this year's year-end, use next year
  const yearEndYear = month <= referenceDate.getMonth() + 1 ? refYear : refYear - 1;

  // 9 months after year-end month → add 9 to the month, day 21
  const deadlineMonth = month - 1 + 9; // 0-indexed + 9
  const deadlineDate = new Date(yearEndYear + Math.floor(deadlineMonth / 12), deadlineMonth % 12, 21);

  // If this deadline is more than 30 days in the past, advance to next cycle
  const daysDiff = Math.ceil((deadlineDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < -30) {
    return new Date(deadlineDate.getFullYear() + 1, deadlineDate.getMonth(), 21);
  }

  return deadlineDate;
}

/**
 * Form 11 due date: October 31 of taxYear+1.
 * (e.g., tax year 2025 → due 31 Oct 2026)
 */
export function computeForm11Deadline(taxYear: number): Date {
  return new Date(taxYear + 1, 9, 31); // month 9 = October
}

/**
 * Next N VAT3 bi-monthly deadlines from referenceDate.
 * Irish VAT3 periods: Jan–Feb, Mar–Apr, May–Jun, Jul–Aug, Sep–Oct, Nov–Dec
 * Due on the 19th of the month after period end.
 */
export function computeNextVATDeadlines(
  referenceDate: Date,
  count: number = 2,
): { label: string; dueDate: Date }[] {
  const year = referenceDate.getFullYear();

  // All six periods for the current year + first period of next year for wrap-around
  const periods = [
    { label: "Jan–Feb", dueMonth: 2, dueYear: year },     // Mar 19
    { label: "Mar–Apr", dueMonth: 4, dueYear: year },     // May 19
    { label: "May–Jun", dueMonth: 6, dueYear: year },     // Jul 19
    { label: "Jul–Aug", dueMonth: 8, dueYear: year },     // Sep 19
    { label: "Sep–Oct", dueMonth: 10, dueYear: year },    // Nov 19
    { label: "Nov–Dec", dueMonth: 0, dueYear: year + 1 }, // Jan 19 next year
    // Wrap-around: next year periods
    { label: "Jan–Feb", dueMonth: 2, dueYear: year + 1 },
    { label: "Mar–Apr", dueMonth: 4, dueYear: year + 1 },
  ];

  const results: { label: string; dueDate: Date }[] = [];
  for (const p of periods) {
    if (results.length >= count) break;
    const due = new Date(p.dueYear, p.dueMonth, 19);
    const days = Math.ceil((due.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    // Include if not more than 30 days overdue
    if (days >= -30) {
      results.push({ label: `VAT3 (${p.label})`, dueDate: due });
    }
  }

  return results;
}

export function getDeadlineStatus(dueDate: Date, now: Date): DeadlineStatus {
  const days = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "upcoming";
}

export function getDaysLabel(dueDate: Date, now: Date): string {
  const days = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

export function getStatusClasses(status: DeadlineStatus): string {
  switch (status) {
    case "overdue":
      return "bg-destructive text-destructive-foreground";
    case "due_soon":
      return "bg-yellow-500 text-white";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export interface BuildDeadlinesOptions {
  includeVAT?: boolean;
  maxItems?: number;
}

/**
 * Build all upcoming deadlines for a set of clients, sorted by date.
 * Uses year_end_month from each client to compute per-client CT1 deadlines.
 */
export function buildClientDeadlines(
  clients: Pick<AccountantClient, "id" | "client_name" | "year_end_month">[],
  now: Date,
  options: BuildDeadlinesOptions = {},
): AccountantDeadline[] {
  const { includeVAT = true, maxItems = 8 } = options;
  const currentYear = now.getFullYear();
  const taxYear = now.getMonth() >= 10 ? currentYear : currentYear - 1;

  const all: AccountantDeadline[] = [];

  for (const client of clients) {
    // CT1 per-client based on their year-end
    const ct1Date = computeCT1Deadline(client.year_end_month, now);
    const ct1Status = getDeadlineStatus(ct1Date, now);
    all.push({
      clientId: client.id,
      clientName: client.client_name,
      filingType: "ct1",
      label: "CT1 Corporation Tax",
      dueDate: ct1Date,
      status: ct1Status,
      daysLabel: getDaysLabel(ct1Date, now),
    });

    // Form 11 — same for all clients
    const form11Date = computeForm11Deadline(taxYear);
    const form11Status = getDeadlineStatus(form11Date, now);
    all.push({
      clientId: client.id,
      clientName: client.client_name,
      filingType: "form11",
      label: "Form 11 Income Tax",
      dueDate: form11Date,
      status: form11Status,
      daysLabel: getDaysLabel(form11Date, now),
    });

    // VAT
    if (includeVAT) {
      const vatDeadlines = computeNextVATDeadlines(now, 2);
      for (const vat of vatDeadlines) {
        const vatStatus = getDeadlineStatus(vat.dueDate, now);
        all.push({
          clientId: client.id,
          clientName: client.client_name,
          filingType: "vat",
          label: vat.label,
          dueDate: vat.dueDate,
          status: vatStatus,
          daysLabel: getDaysLabel(vat.dueDate, now),
        });
      }
    }
  }

  // Sort: overdue first, then by date ascending
  const statusOrder: Record<DeadlineStatus, number> = { overdue: 0, due_soon: 1, upcoming: 2 };
  all.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  // Deduplicate: for shared deadlines (Form 11, VAT) only show once with first client
  const seen = new Set<string>();
  const deduped: AccountantDeadline[] = [];
  for (const d of all) {
    // CT1 is per-client (different year-ends), so always include
    if (d.filingType === "ct1") {
      deduped.push(d);
      continue;
    }
    // Form 11 / VAT: dedupe by label+date combo
    const key = `${d.label}-${d.dueDate.getTime()}`;
    if (!seen.has(key)) {
      seen.add(key);
      // Show as practice-wide (no specific client)
      deduped.push({ ...d, clientName: "All clients" });
    }
  }

  return deduped.slice(0, maxItems);
}
