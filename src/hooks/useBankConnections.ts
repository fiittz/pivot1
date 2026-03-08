import { useState, useCallback, useEffect } from "react";
import { IRISH_BANKS, type BankConnection, type BankInstitution } from "@/types/bankConnection";

const STORAGE_KEY = "balnce-bank-connections";

function loadConnections(): BankConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConnections(connections: BankConnection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

export function useBankConnections() {
  const [connections, setConnections] = useState<BankConnection[]>(loadConnections);
  const [isConnecting, setIsConnecting] = useState(false);
  const supportedBanks: BankInstitution[] = IRISH_BANKS;

  useEffect(() => {
    saveConnections(connections);
  }, [connections]);

  const connectBank = useCallback(async (institutionId: string) => {
    setIsConnecting(true);
    const bank = IRISH_BANKS.find((b) => b.id === institutionId);
    if (!bank) {
      setIsConnecting(false);
      throw new Error("Bank not found");
    }

    const newConnection: BankConnection = {
      id: `conn-${Date.now()}`,
      userId: "current-user",
      institutionId,
      institutionName: bank.name,
      status: "pending",
      accounts: [],
      lastSyncedAt: null,
      consentExpiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    setConnections((prev) => [...prev, newConnection]);

    // Simulate connection process
    await new Promise((r) => setTimeout(r, 2000));

    setConnections((prev) =>
      prev.map((c) =>
        c.id === newConnection.id
          ? {
              ...c,
              status: "active" as const,
              lastSyncedAt: new Date().toISOString(),
              accounts: [
                {
                  id: `acc-${Date.now()}-1`,
                  connectionId: newConnection.id,
                  accountName: `${bank.name} Current Account`,
                  accountNumber: "****1234",
                  iban: "IE29 AIBK 9311 5212 3456 78",
                  balance: 12450.0,
                  currency: "EUR",
                  type: "current" as const,
                },
                {
                  id: `acc-${Date.now()}-2`,
                  connectionId: newConnection.id,
                  accountName: `${bank.name} Savings`,
                  accountNumber: "****5678",
                  balance: 25000.0,
                  currency: "EUR",
                  type: "savings" as const,
                },
              ],
            }
          : c,
      ),
    );
    setIsConnecting(false);
  }, []);

  const disconnectBank = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }, []);

  const syncBank = useCallback((connectionId: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === connectionId ? { ...c, lastSyncedAt: new Date().toISOString() } : c)),
    );
  }, []);

  return {
    connections,
    supportedBanks,
    connectBank,
    disconnectBank,
    syncBank,
    isConnecting,
  };
}
