import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Loader2,
  Receipt,
  Scale,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import type { CopilotSuggestion } from "@/hooks/accountant/useCopilot";

interface CopilotPanelProps {
  suggestions: CopilotSuggestion[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

const TYPE_CONFIG: Record<
  CopilotSuggestion["type"],
  { icon: React.ElementType; label: string; color: string }
> = {
  miscategorisation: { icon: AlertTriangle, label: "Miscategorisation", color: "text-amber-500" },
  missing_relief: { icon: Lightbulb, label: "Missed Relief", color: "text-blue-500" },
  compliance_risk: { icon: Shield, label: "Compliance", color: "text-red-500" },
  optimisation: { icon: Sparkles, label: "Optimisation", color: "text-emerald-500" },
  missing_receipt: { icon: Receipt, label: "Missing Receipt", color: "text-amber-400" },
  inconsistency: { icon: Scale, label: "Inconsistency", color: "text-purple-500" },
};

const SEVERITY_COLORS: Record<CopilotSuggestion["severity"], string> = {
  high: "bg-red-500/10 text-red-500",
  medium: "bg-amber-500/10 text-amber-500",
  low: "bg-blue-500/10 text-blue-500",
};

const CopilotPanel = ({ suggestions, isLoading, error, onRefresh }: CopilotPanelProps) => {
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const visibleSuggestions = suggestions.filter((_, i) => !dismissedIds.has(i));
  const highCount = visibleSuggestions.filter((s) => s.severity === "high").length;
  const medCount = visibleSuggestions.filter((s) => s.severity === "medium").length;

  const dismiss = (index: number) => {
    setDismissedIds((prev) => new Set([...prev, index]));
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-[#E8930C]" />
          <h3 className="font-semibold text-sm">Co-Pilot</h3>
        </div>
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analysing client data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#E8930C]" />
            <h3 className="font-semibold text-sm">Co-Pilot</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} className="text-xs">
            Retry
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Failed to analyse: {error.message}
        </p>
      </div>
    );
  }

  if (visibleSuggestions.length === 0 && suggestions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#E8930C]" />
            <h3 className="font-semibold text-sm">Co-Pilot</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} className="text-xs">
            Re-analyse
          </Button>
        </div>
        <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          No issues found
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-[#E8930C]" />
          <span className="font-semibold text-sm">Co-Pilot</span>
          <span className="text-xs text-muted-foreground">
            {visibleSuggestions.length} suggestion{visibleSuggestions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {highCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-500">
              {highCount} high
            </Badge>
          )}
          {medCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500">
              {medCount} medium
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-6 text-[10px] px-2">
            Re-analyse
          </Button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {suggestions.map((suggestion, index) => {
          if (dismissedIds.has(index)) return null;
          const config = TYPE_CONFIG[suggestion.type];
          const Icon = config.icon;

          return (
            <SuggestionItem
              key={index}
              suggestion={suggestion}
              icon={<Icon className={`w-4 h-4 ${config.color}`} />}
              typeLabel={config.label}
              onDismiss={() => dismiss(index)}
            />
          );
        })}
      </div>

      {dismissedIds.size > 0 && (
        <div className="px-4 py-2 border-t bg-muted/20">
          <button
            type="button"
            onClick={() => setDismissedIds(new Set())}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Show {dismissedIds.size} dismissed
          </button>
        </div>
      )}
    </div>
  );
};

function SuggestionItem({
  suggestion,
  icon,
  typeLabel,
  onDismiss,
}: {
  suggestion: CopilotSuggestion;
  icon: React.ReactNode;
  typeLabel: string;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(suggestion.severity === "high");

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="px-4 py-2.5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-start gap-3 text-left group"
          >
            <div className="mt-0.5 flex-shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{suggestion.title}</span>
                <Badge
                  variant="secondary"
                  className={`text-[9px] px-1 py-0 flex-shrink-0 ${SEVERITY_COLORS[suggestion.severity]}`}
                >
                  {suggestion.severity}
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0">
                  {typeLabel}
                </Badge>
                {suggestion.estimated_impact && (
                  <span className="text-[10px] text-emerald-600 font-medium flex-shrink-0">
                    {suggestion.estimated_impact}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="ml-7 mt-2 space-y-2">
            <p className="text-xs text-muted-foreground">{suggestion.description}</p>

            {suggestion.legislation && (
              <p className="text-[10px] text-muted-foreground/70 font-mono">
                Ref: {suggestion.legislation}
              </p>
            )}

            <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs">{suggestion.action}</p>
            </div>

            {suggestion.affected_transactions && suggestion.affected_transactions.length > 0 && (
              <div className="text-[10px] text-muted-foreground">
                Affected: {suggestion.affected_transactions.slice(0, 5).join(", ")}
                {suggestion.affected_transactions.length > 5 && ` (+${suggestion.affected_transactions.length - 5} more)`}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="h-6 text-[10px] px-2 text-muted-foreground"
              >
                <X className="w-3 h-3 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default CopilotPanel;
