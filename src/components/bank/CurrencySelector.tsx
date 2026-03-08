import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/lib/currencyUtils";

interface Props {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export default function CurrencySelector({ value, onChange, className }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className || "h-8 w-[140px] text-xs"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-xs">
            {c.code} {c.symbol} — {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
