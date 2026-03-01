import { cn } from "@/lib/utils";

export interface PipelineTab<T extends string = string> {
  key: T;
  label: string;
  count: number;
}

interface StatusPipelineTabsProps<T extends string = string> {
  tabs: PipelineTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function StatusPipelineTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
}: StatusPipelineTabsProps<T>) {
  return (
    <div className="flex items-center gap-0 border-b border-border">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full",
                  isActive
                    ? "bg-[#E8930C] text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8930C]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
