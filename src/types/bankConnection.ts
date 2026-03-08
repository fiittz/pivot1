export interface BankInstitution {
  id: string;
  name: string;
  logo?: string;
  country: string;
}

export interface BankConnection {
  id: string;
  userId: string;
  institutionId: string;
  institutionName: string;
  status: "active" | "expired" | "error" | "pending";
  accounts: ConnectedBankAccount[];
  lastSyncedAt: string | null;
  consentExpiresAt: string | null;
  createdAt: string;
}

export interface ConnectedBankAccount {
  id: string;
  connectionId: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
  iban?: string;
  balance: number;
  currency: string;
  type: "current" | "savings" | "credit";
}

export type ConnectionStatus = BankConnection["status"];

export const IRISH_BANKS: BankInstitution[] = [
  { id: "aib", name: "AIB", country: "IE" },
  { id: "boi", name: "Bank of Ireland", country: "IE" },
  { id: "ptsb", name: "Permanent TSB", country: "IE" },
  { id: "ulster", name: "Ulster Bank", country: "IE" },
  { id: "revolut", name: "Revolut", country: "IE" },
  { id: "n26", name: "N26", country: "IE" },
  { id: "anpost", name: "An Post Money", country: "IE" },
  { id: "kbc", name: "KBC Ireland", country: "IE" },
  { id: "credit_union", name: "Credit Union", country: "IE" },
];
