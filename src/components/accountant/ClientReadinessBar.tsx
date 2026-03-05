import { useClientReadiness, type ReadinessStep } from "@/hooks/accountant/useClientReadiness";
import { CheckCircle2, Circle, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientReadinessBarProps {
  clientUserId: string | null | undefined;
  periodStart?: string;
  periodEnd?: string;
  /** When true, shows compact inline version */
  compact?: boolean;
}

const statusIcon = (step: ReadinessStep) => {
  if (step.status === "complete") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (step.status === "in_progress") return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40" />;
};

const progressColor = (step: ReadinessStep) => {
  if (step.status === "complete") return "bg-emerald-500";
  if (step.status === "in_progress") return "bg-amber-500";
  return "bg-muted-foreground/20";
};

export function ClientReadinessBar({ clientUserId, periodStart, periodEnd, compact }: ClientReadinessBarProps) {
  const { data, isLoading } = useClientReadiness(clientUserId, periodStart, periodEnd);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking readiness...
      </div>
    );
  }

  if (!data) return null;

  const { steps, overallProgress, isReadyForFiling, periodLabel } = data;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Filing readiness</span>
          <span className={cn("font-medium", isReadyForFiling ? "text-emerald-600" : "text-amber-600")}>
            {overallProgress}%
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isReadyForFiling ? "bg-emerald-500" : "bg-amber-500",
            )}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex gap-1">
          {steps.map((step) => (
            <Tooltip key={step.key}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex-1 h-1.5 rounded-full",
                    progressColor(step),
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{step.label}</p>
                <p className="text-muted-foreground">{step.detail}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Filing Readiness</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {isReadyForFiling ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready for filing
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              <Lock className="w-3.5 h-3.5" />
              {overallProgress}% complete
            </span>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isReadyForFiling ? "bg-emerald-500" : "bg-amber-500",
          )}
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Step breakdown */}
      <div className="grid grid-cols-5 gap-3">
        {steps.map((step, i) => (
          <div key={step.key} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              {statusIcon(step)}
              <span className="text-xs font-medium text-foreground">{step.label}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", progressColor(step))}
                style={{ width: `${step.progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useIsReadyForFiling(clientUserId: string | null | undefined) {
  const { data } = useClientReadiness(clientUserId);
  return data?.isReadyForFiling ?? false;
}
