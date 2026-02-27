import { describe, it, expect } from "vitest";
import {
  computeCT1Deadline,
  computeForm11Deadline,
  computeNextVATDeadlines,
  getDeadlineStatus,
  getDaysLabel,
  buildClientDeadlines,
} from "../accountant/deadlineCalculations";

// ══════════════════════════════════════════════════════════════
// computeCT1Deadline
// ══════════════════════════════════════════════════════════════
describe("computeCT1Deadline", () => {
  it("December year-end → Sep 21 (9 months + 21 days)", () => {
    // Dec 2025 year-end → Sep 21, 2026
    const ref = new Date(2026, 0, 15); // Jan 15, 2026
    const result = computeCT1Deadline(12, ref);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8); // September
    expect(result.getDate()).toBe(21);
  });

  it("March year-end → Dec 21", () => {
    // Mar 2026 year-end → Dec 21, 2026
    const ref = new Date(2026, 3, 1); // Apr 1, 2026
    const result = computeCT1Deadline(3, ref);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getDate()).toBe(21);
  });

  it("June year-end → Mar 21 next year", () => {
    // Jun 2026 year-end → Mar 21, 2027
    const ref = new Date(2026, 6, 1); // Jul 1, 2026
    const result = computeCT1Deadline(6, ref);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(21);
  });

  it("null year_end_month defaults to December", () => {
    const ref = new Date(2026, 0, 15);
    const withNull = computeCT1Deadline(null, ref);
    const withDec = computeCT1Deadline(12, ref);
    expect(withNull.getTime()).toBe(withDec.getTime());
  });

  it("advances to next cycle if deadline > 30d in the past", () => {
    // Dec 2024 year-end → Sep 21, 2025; if ref is Nov 2025, that's ~60d past → advance to Sep 21, 2026
    const ref = new Date(2025, 10, 15); // Nov 15, 2025
    const result = computeCT1Deadline(12, ref);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(21);
  });
});

// ══════════════════════════════════════════════════════════════
// computeForm11Deadline
// ══════════════════════════════════════════════════════════════
describe("computeForm11Deadline", () => {
  it("tax year 2025 → Oct 31, 2026", () => {
    const result = computeForm11Deadline(2025);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9); // October
    expect(result.getDate()).toBe(31);
  });

  it("tax year 2024 → Oct 31, 2025", () => {
    const result = computeForm11Deadline(2024);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(31);
  });
});

// ══════════════════════════════════════════════════════════════
// computeNextVATDeadlines
// ══════════════════════════════════════════════════════════════
describe("computeNextVATDeadlines", () => {
  it("returns 2 deadlines by default", () => {
    const ref = new Date(2026, 0, 15); // Jan 15, 2026
    const result = computeNextVATDeadlines(ref);
    expect(result).toHaveLength(2);
  });

  it("first deadline in Jan is Mar 19 (Jan-Feb period)", () => {
    const ref = new Date(2026, 0, 15);
    const result = computeNextVATDeadlines(ref, 1);
    expect(result[0].label).toBe("VAT3 (Jan–Feb)");
    expect(result[0].dueDate.getMonth()).toBe(2); // March
    expect(result[0].dueDate.getDate()).toBe(19);
  });

  it("mid-year reference picks correct upcoming periods", () => {
    const ref = new Date(2026, 6, 1); // Jul 1 — past May 19 (Mar-Apr) deadline
    const result = computeNextVATDeadlines(ref, 2);
    // Jul-Aug period due Sep 19 should be first
    expect(result[0].label).toBe("VAT3 (May–Jun)");
    expect(result[0].dueDate.getMonth()).toBe(6); // July 19
  });

  it("Nov-Dec period due in Jan of next year", () => {
    const ref = new Date(2026, 11, 1); // Dec 1, 2026
    const result = computeNextVATDeadlines(ref, 2);
    const novDec = result.find((d) => d.label === "VAT3 (Nov–Dec)");
    expect(novDec).toBeDefined();
    expect(novDec!.dueDate.getFullYear()).toBe(2027);
    expect(novDec!.dueDate.getMonth()).toBe(0); // January
  });

  it("can return up to 3 deadlines", () => {
    const ref = new Date(2026, 0, 15);
    const result = computeNextVATDeadlines(ref, 3);
    expect(result).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════
// getDeadlineStatus
// ══════════════════════════════════════════════════════════════
describe("getDeadlineStatus", () => {
  it("returns 'overdue' when date is in the past", () => {
    const now = new Date(2026, 5, 1);
    const past = new Date(2026, 4, 1);
    expect(getDeadlineStatus(past, now)).toBe("overdue");
  });

  it("returns 'due_soon' when within 30 days", () => {
    const now = new Date(2026, 5, 1);
    const soon = new Date(2026, 5, 20);
    expect(getDeadlineStatus(soon, now)).toBe("due_soon");
  });

  it("returns 'upcoming' when more than 30 days away", () => {
    const now = new Date(2026, 0, 1);
    const future = new Date(2026, 5, 1);
    expect(getDeadlineStatus(future, now)).toBe("upcoming");
  });

  it("returns 'due_soon' on the exact 30-day boundary", () => {
    const now = new Date(2026, 0, 1);
    const boundary = new Date(2026, 0, 31); // 30 days later
    expect(getDeadlineStatus(boundary, now)).toBe("due_soon");
  });
});

// ══════════════════════════════════════════════════════════════
// getDaysLabel
// ══════════════════════════════════════════════════════════════
describe("getDaysLabel", () => {
  it("shows 'Due today' for same day", () => {
    const now = new Date(2026, 5, 15);
    const due = new Date(2026, 5, 15);
    expect(getDaysLabel(due, now)).toBe("Due today");
  });

  it("shows 'Tomorrow' for next day", () => {
    const now = new Date(2026, 5, 15);
    const due = new Date(2026, 5, 16);
    expect(getDaysLabel(due, now)).toBe("Tomorrow");
  });

  it("shows Xd for future dates", () => {
    const now = new Date(2026, 5, 1);
    const due = new Date(2026, 5, 11);
    expect(getDaysLabel(due, now)).toBe("10d");
  });

  it("shows Xd overdue for past dates", () => {
    const now = new Date(2026, 5, 15);
    const due = new Date(2026, 5, 10);
    expect(getDaysLabel(due, now)).toBe("5d overdue");
  });
});

// ══════════════════════════════════════════════════════════════
// buildClientDeadlines
// ══════════════════════════════════════════════════════════════
describe("buildClientDeadlines", () => {
  const clients = [
    { id: "c1", client_name: "Acme Ltd", year_end_month: 12 },
    { id: "c2", client_name: "Beta Corp", year_end_month: 3 },
  ];

  it("returns deadlines sorted by status then date", () => {
    const now = new Date(2026, 1, 15); // Feb 15, 2026
    const result = buildClientDeadlines(clients, now);
    // Verify sorted: all overdue before due_soon before upcoming
    for (let i = 1; i < result.length; i++) {
      const statusOrder = { overdue: 0, due_soon: 1, upcoming: 2 };
      const prevOrder = statusOrder[result[i - 1].status];
      const curOrder = statusOrder[result[i].status];
      if (prevOrder === curOrder) {
        expect(result[i].dueDate.getTime()).toBeGreaterThanOrEqual(result[i - 1].dueDate.getTime());
      } else {
        expect(curOrder).toBeGreaterThanOrEqual(prevOrder);
      }
    }
  });

  it("respects maxItems option", () => {
    const now = new Date(2026, 1, 15);
    const result = buildClientDeadlines(clients, now, { maxItems: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("excludes VAT when includeVAT is false", () => {
    const now = new Date(2026, 1, 15);
    const result = buildClientDeadlines(clients, now, { includeVAT: false });
    const vatDeadlines = result.filter((d) => d.filingType === "vat");
    expect(vatDeadlines).toHaveLength(0);
  });

  it("deduplicates Form 11 across clients (same deadline for all)", () => {
    const now = new Date(2026, 1, 15);
    const result = buildClientDeadlines(clients, now, { includeVAT: false });
    const form11Deadlines = result.filter((d) => d.filingType === "form11");
    // Should be deduped to 1 entry labeled "All clients"
    expect(form11Deadlines).toHaveLength(1);
    expect(form11Deadlines[0].clientName).toBe("All clients");
  });

  it("CT1 deadlines differ by year-end month", () => {
    const now = new Date(2026, 1, 15);
    const result = buildClientDeadlines(clients, now, { includeVAT: false });
    const ct1Deadlines = result.filter((d) => d.filingType === "ct1");
    // Each client gets their own CT1
    expect(ct1Deadlines).toHaveLength(2);
    const dates = ct1Deadlines.map((d) => d.dueDate.getTime());
    expect(dates[0]).not.toBe(dates[1]);
  });

  it("returns empty array for no clients", () => {
    const now = new Date(2026, 1, 15);
    const result = buildClientDeadlines([], now);
    expect(result).toHaveLength(0);
  });
});
