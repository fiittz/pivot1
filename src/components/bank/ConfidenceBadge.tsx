import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  confidence: number;
  className?: string;
}

export default function ConfidenceBadge({ confidence, className }: Props) {
  const percent = Math.round(confidence * 100);
  const level = percent >= 80 ? "high" : percent >= 50 ? "medium" : "low";

  const colors = {
    high: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    low: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  };

  const labels = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[level]} ${className || ""}`}>
          {percent}%
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <p>{labels[level]} AI categorisation</p>
        <p className="text-muted-foreground">Based on vendor history and transaction patterns</p>
      </TooltipContent>
    </Tooltip>
  );
}
