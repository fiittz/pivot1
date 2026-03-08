import { useState, useCallback } from "react";

export interface AIIncident {
  id: string;
  timestamp: string;
  system: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  status: "open" | "investigating" | "resolved" | "closed";
  resolution?: string;
  resolvedAt?: string;
  reportedBy: string;
}

const STORAGE_KEY = "balnce-ai-incidents";

function loadIncidents(): AIIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIncidents(incidents: AIIncident[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
}

export function useAIIncidents() {
  const [incidents, setIncidents] = useState<AIIncident[]>(loadIncidents);

  const createIncident = useCallback((incident: Omit<AIIncident, "id" | "timestamp" | "status">) => {
    const newIncident: AIIncident = {
      ...incident,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: "open",
    };
    setIncidents((prev) => {
      const updated = [newIncident, ...prev];
      saveIncidents(updated);
      return updated;
    });
    return newIncident;
  }, []);

  const updateIncident = useCallback((id: string, updates: Partial<AIIncident>) => {
    setIncidents((prev) => {
      const updated = prev.map((inc) => (inc.id === id ? { ...inc, ...updates } : inc));
      saveIncidents(updated);
      return updated;
    });
  }, []);

  const resolveIncident = useCallback((id: string, resolution: string) => {
    setIncidents((prev) => {
      const updated = prev.map((inc) =>
        inc.id === id
          ? { ...inc, status: "resolved" as const, resolution, resolvedAt: new Date().toISOString() }
          : inc,
      );
      saveIncidents(updated);
      return updated;
    });
  }, []);

  const deleteIncident = useCallback((id: string) => {
    setIncidents((prev) => {
      const updated = prev.filter((inc) => inc.id !== id);
      saveIncidents(updated);
      return updated;
    });
  }, []);

  const openCount = incidents.filter((i) => i.status === "open" || i.status === "investigating").length;

  return { incidents, createIncident, updateIncident, resolveIncident, deleteIncident, openCount };
}
