import { describe, it, expect } from "vitest";
import {
  dayName,
  dayOfWeek,
  roundCent,
  diffDays,
  wholeEuro,
  centEuro,
  fmtRevDate,
  fmtDate,
  fmtTaxYear,
  fmtEuro,
  fmtPercent,
} from "../calc";

// ── dayName ──────────────────────────────────────────────────

describe("dayName", () => {
  it("returns Monday for 2026-03-02", () => {
    expect(dayName(new Date(2026, 2, 2))).toBe("Monday");
  });

  it("covers all 7 days of the week", () => {
    // 2026-03-01 is a Sunday
    const expected = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (let i = 0; i < 7; i++) {
      expect(dayName(new Date(2026, 2, 1 + i))).toBe(expected[i]);
    }
  });

  it("accepts an ISO string", () => {
    expect(dayName("2026-03-05")).toBe("Thursday");
  });
});

// ── dayOfWeek ────────────────────────────────────────────────

describe("dayOfWeek", () => {
  it("returns 0 for Sunday", () => {
    expect(dayOfWeek(new Date(2026, 2, 1))).toBe(0);
  });

  it("returns 1 for Monday", () => {
    expect(dayOfWeek(new Date(2026, 2, 2))).toBe(1);
  });

  it("returns 6 for Saturday", () => {
    expect(dayOfWeek(new Date(2026, 2, 7))).toBe(6);
  });

  it("accepts an ISO string", () => {
    expect(dayOfWeek("2026-03-05")).toBe(4); // Thursday
  });
});

// ── roundCent ────────────────────────────────────────────────

describe("roundCent", () => {
  it("rounds to 2 decimal places", () => {
    // 1.005 * 100 = 100.4999… in IEEE 754, so Math.round gives 100 → 1.00
    expect(roundCent(1.005)).toBe(1);
    expect(roundCent(1.006)).toBe(1.01);
    expect(roundCent(1.004)).toBe(1);
  });

  it("handles zero", () => {
    expect(roundCent(0)).toBe(0);
  });

  it("handles negative values", () => {
    // -1.555 * 100 = -155.4999… → Math.round = -155 → -1.55
    expect(roundCent(-1.555)).toBe(-1.55);
    expect(roundCent(-1.556)).toBe(-1.56);
    expect(roundCent(-0.001)).toBe(-0);
  });

  it("handles large amounts", () => {
    expect(roundCent(123456.789)).toBe(123456.79);
  });

  it("preserves already-rounded values", () => {
    expect(roundCent(42.0)).toBe(42);
    expect(roundCent(99.99)).toBe(99.99);
  });
});

// ── diffDays ─────────────────────────────────────────────────

describe("diffDays", () => {
  it("returns positive for b > a", () => {
    expect(diffDays(new Date(2026, 0, 1), new Date(2026, 0, 10))).toBe(9);
  });

  it("returns negative for b < a", () => {
    expect(diffDays(new Date(2026, 0, 10), new Date(2026, 0, 1))).toBe(-9);
  });

  it("returns 0 for same day", () => {
    const d = new Date(2026, 0, 1);
    expect(diffDays(d, d)).toBe(0);
  });

  it("handles month boundaries", () => {
    expect(diffDays(new Date(2026, 0, 31), new Date(2026, 1, 1))).toBe(1);
  });
});

// ── wholeEuro ────────────────────────────────────────────────

describe("wholeEuro", () => {
  it("rounds to nearest integer", () => {
    expect(wholeEuro(99.49)).toBe(99);
    expect(wholeEuro(99.5)).toBe(100);
  });

  it("handles zero", () => {
    expect(wholeEuro(0)).toBe(0);
  });
});

// ── centEuro ─────────────────────────────────────────────────

describe("centEuro", () => {
  it("formats to 2 decimal places", () => {
    expect(centEuro(100)).toBe("100.00");
    expect(centEuro(99.1)).toBe("99.10");
    expect(centEuro(0.5)).toBe("0.50");
  });
});

// ── fmtRevDate ───────────────────────────────────────────────

describe("fmtRevDate", () => {
  it("formats ISO to DD/MM/YYYY", () => {
    expect(fmtRevDate("2026-03-05")).toBe("05/03/2026");
  });

  it("pads single-digit day and month", () => {
    expect(fmtRevDate("2026-01-02")).toBe("02/01/2026");
  });
});

// ── fmtDate ──────────────────────────────────────────────────

describe("fmtDate", () => {
  it("returns a human-readable Irish date", () => {
    const result = fmtDate(new Date(2026, 2, 5));
    // Intl output may vary slightly by runtime, but should contain these parts
    expect(result).toContain("5");
    expect(result).toContain("Mar");
    expect(result).toContain("2026");
  });
});

// ── fmtTaxYear ───────────────────────────────────────────────

describe("fmtTaxYear", () => {
  it("formats a number year", () => {
    expect(fmtTaxYear(2025)).toBe("Year ended 31 December 2025");
  });

  it("formats a string year", () => {
    expect(fmtTaxYear("2024")).toBe("Year ended 31 December 2024");
  });
});

// ── fmtEuro ──────────────────────────────────────────────────

describe("fmtEuro", () => {
  it("formats with euro sign and 2 decimals", () => {
    const result = fmtEuro(1234.5);
    expect(result).toContain("1,234.50");
  });

  it("formats zero", () => {
    const result = fmtEuro(0);
    expect(result).toContain("0.00");
  });
});

// ── fmtPercent ───────────────────────────────────────────────

describe("fmtPercent", () => {
  it("converts decimal to percentage string", () => {
    expect(fmtPercent(0.2)).toBe("20%");
    expect(fmtPercent(0.125)).toBe("13%"); // rounds to nearest integer
    expect(fmtPercent(1)).toBe("100%");
  });
});
