import { useQuery } from "@tanstack/react-query";
import type { ExchangeRates } from "@/lib/currencyUtils";

const STORAGE_KEY = "balnce-exchange-rates";
const API_URL = "https://api.frankfurter.app/latest?from=EUR";

function getCachedRates(): { rates: ExchangeRates; lastUpdated: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheRates(rates: ExchangeRates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rates, lastUpdated: new Date().toISOString() }));
}

export function useExchangeRates() {
  const cached = getCachedRates();

  const query = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async (): Promise<ExchangeRates> => {
      const res = await fetch(API_URL);
      if (!res.ok) {
        // Fall back to cached rates
        if (cached?.rates) return cached.rates;
        throw new Error("Failed to fetch exchange rates");
      }
      const data = await res.json();
      const rates: ExchangeRates = data.rates || {};
      cacheRates(rates);
      return rates;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    placeholderData: cached?.rates || undefined,
    retry: 2,
  });

  return {
    rates: query.data || cached?.rates || {},
    isLoading: query.isLoading,
    lastUpdated: cached?.lastUpdated || null,
  };
}
