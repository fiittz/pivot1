import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/currencyUtils";

interface Props {
  amount: number;
  currency: string;
  eurAmount: number;
  rate: number;
}

export default function CurrencyConversionBadge({ amount, currency, eurAmount, rate }: Props) {
  if (currency === "EUR") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-xs font-medium">
          {formatCurrency(amount, currency)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <p>{formatCurrency(amount, currency)} = {formatCurrency(eurAmount, "EUR")}</p>
        <p className="text-muted-foreground">Rate: 1 {currency} = {(1 / rate).toFixed(4)} EUR</p>
      </TooltipContent>
    </Tooltip>
  );
}
