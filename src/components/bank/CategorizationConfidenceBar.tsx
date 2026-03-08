import { Progress } from "@/components/ui/progress";

interface Props {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export default function CategorizationConfidenceBar({ high, medium, low, total }: Props) {
  if (!total) return null;

  const highPct = (high / total) * 100;
  const medPct = (medium / total) * 100;
  const lowPct = (low / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        <div className="bg-green-500 transition-all" style={{ width: `${highPct}%` }} />
        <div className="bg-amber-500 transition-all" style={{ width: `${medPct}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${lowPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          High ({high})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          Medium ({medium})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          Low ({low})
        </span>
      </div>
    </div>
  );
}
