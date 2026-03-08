import { Flame } from "lucide-react";

interface Props {
  streak: number;
}

export default function StreakBadge({ streak }: Props) {
  if (streak < 2) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-xs font-medium">
      <Flame className="w-3 h-3" />
      {streak} day streak
    </div>
  );
}
