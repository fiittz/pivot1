export const SUPPORTED_CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];
export type ExchangeRates = Record<string, number>;

const SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.symbol]),
);

export function getCurrencySymbol(code: string): string {
  return SYMBOL_MAP[code] || code;
}

export function formatCurrency(amount: number, currency: string = "EUR"): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = Math.abs(amount).toLocaleString("en-IE", {
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}

export function convertToEUR(amount: number, fromCurrency: string, rates: ExchangeRates): number {
  if (fromCurrency === "EUR") return amount;
  const rate = rates[fromCurrency];
  if (!rate) return amount;
  return amount / rate;
}

export function convertFromEUR(amount: number, toCurrency: string, rates: ExchangeRates): number {
  if (toCurrency === "EUR") return amount;
  const rate = rates[toCurrency];
  if (!rate) return amount;
  return amount * rate;
}

export function getExchangeRate(from: string, to: string, rates: ExchangeRates): number {
  if (from === to) return 1;
  if (from === "EUR") return rates[to] || 1;
  if (to === "EUR") return 1 / (rates[from] || 1);
  // Cross-rate via EUR
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  return toRate / fromRate;
}
