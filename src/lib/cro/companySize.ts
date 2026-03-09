/**
 * Irish Companies Act 2014 — Company Size Classification
 *
 * Determines CRO filing requirements based on company size.
 * Thresholds updated per EU (Adjustments of Size Criteria) Regulations 2024
 * effective 1 July 2024 (applies to FY commencing on/after 1 Jan 2024).
 *
 * A company qualifies for a category if it meets AT LEAST 2 of the 3 criteria.
 */

export type CompanySize = "micro" | "small" | "medium" | "large";

export interface CompanySizeInput {
  balanceSheetTotal: number;   // total assets (fixed + current)
  netTurnover: number;         // annual revenue
  averageEmployees: number;    // average number of employees during the year
}

export interface CompanySizeResult {
  size: CompanySize;
  label: string;
  auditExempt: boolean;
  filingRequirements: CROFilingRequirements;
  thresholdsMet: {
    micro: number;   // how many of 3 thresholds met
    small: number;
    medium: number;
  };
}

export interface CROFilingRequirements {
  balanceSheet: "abridged" | "full";
  profitAndLoss: "exempt" | "abridged" | "full";
  directorsReport: "exempt" | "required";
  notesToAccounts: "minimal" | "selected" | "full";
  auditorReport: "exempt" | "required";
  cashFlowStatement: "exempt" | "required";
  description: string;
}

// Updated thresholds (effective 1 July 2024)
const THRESHOLDS = {
  micro: {
    balanceSheet: 450_000,
    turnover: 900_000,
    employees: 10,
  },
  small: {
    balanceSheet: 7_500_000,
    turnover: 15_000_000,
    employees: 50,
  },
  medium: {
    balanceSheet: 25_000_000,
    turnover: 50_000_000,
    employees: 250,
  },
} as const;

function countThresholdsMet(
  input: CompanySizeInput,
  limits: { balanceSheet: number; turnover: number; employees: number },
): number {
  let met = 0;
  if (input.balanceSheetTotal <= limits.balanceSheet) met++;
  if (input.netTurnover <= limits.turnover) met++;
  if (input.averageEmployees <= limits.employees) met++;
  return met;
}

/**
 * Classify a company and determine its CRO filing requirements.
 */
export function classifyCompanySize(input: CompanySizeInput): CompanySizeResult {
  const microMet = countThresholdsMet(input, THRESHOLDS.micro);
  const smallMet = countThresholdsMet(input, THRESHOLDS.small);
  const mediumMet = countThresholdsMet(input, THRESHOLDS.medium);

  // Must meet at least 2 of 3 to qualify
  if (microMet >= 2) {
    return {
      size: "micro",
      label: "Micro Company (s.280D)",
      auditExempt: true,
      filingRequirements: {
        balanceSheet: "abridged",
        profitAndLoss: "exempt",
        directorsReport: "exempt",
        notesToAccounts: "minimal",
        auditorReport: "exempt",
        cashFlowStatement: "exempt",
        description:
          "Abridged balance sheet only. P&L, directors' report, and most notes are exempt. " +
          "Audit exempt under s.352. Must include s.328 own-share acquisition note if applicable.",
      },
      thresholdsMet: { micro: microMet, small: smallMet, medium: mediumMet },
    };
  }

  if (smallMet >= 2) {
    return {
      size: "small",
      label: "Small Company (s.350)",
      auditExempt: true,
      filingRequirements: {
        balanceSheet: "abridged",
        profitAndLoss: "exempt",
        directorsReport: "exempt",
        notesToAccounts: "selected",
        auditorReport: "exempt",
        cashFlowStatement: "exempt",
        description:
          "Abridged balance sheet with selected notes. P&L and directors' report exempt. " +
          "Audit exempt under s.352. Notes must include accounting policies and related party disclosures.",
      },
      thresholdsMet: { micro: microMet, small: smallMet, medium: mediumMet },
    };
  }

  if (mediumMet >= 2) {
    return {
      size: "medium",
      label: "Medium Company (s.280F)",
      auditExempt: false,
      filingRequirements: {
        balanceSheet: "abridged",
        profitAndLoss: "abridged",
        directorsReport: "required",
        notesToAccounts: "selected",
        auditorReport: "required",
        cashFlowStatement: "exempt",
        description:
          "Abridged balance sheet and abridged P&L with selected notes, directors' report, " +
          "and full auditor's report. Audit is mandatory. Exempt from s.322 audit remuneration disclosure.",
      },
      thresholdsMet: { micro: microMet, small: smallMet, medium: mediumMet },
    };
  }

  return {
    size: "large",
    label: "Large Company",
    auditExempt: false,
    filingRequirements: {
      balanceSheet: "full",
      profitAndLoss: "full",
      directorsReport: "required",
      notesToAccounts: "full",
      auditorReport: "required",
      cashFlowStatement: "required",
      description:
        "Full statutory financial statements: balance sheet, P&L, cash flow statement, " +
        "full notes, directors' report (with s.225 compliance statement if relevant company), " +
        "and full auditor's report. No exemptions.",
    },
    thresholdsMet: { micro: microMet, small: smallMet, medium: mediumMet },
  };
}

/** Format the thresholds table for display */
export const COMPANY_SIZE_THRESHOLDS = [
  {
    size: "micro" as CompanySize,
    label: "Micro",
    section: "s.280D",
    balanceSheet: 450_000,
    turnover: 900_000,
    employees: 10,
  },
  {
    size: "small" as CompanySize,
    label: "Small",
    section: "s.350",
    balanceSheet: 7_500_000,
    turnover: 15_000_000,
    employees: 50,
  },
  {
    size: "medium" as CompanySize,
    label: "Medium",
    section: "s.280F",
    balanceSheet: 25_000_000,
    turnover: 50_000_000,
    employees: 250,
  },
];
