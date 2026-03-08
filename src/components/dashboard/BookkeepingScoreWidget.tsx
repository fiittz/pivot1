import { Star, Flame, Trophy } from "lucide-react";
import type { BookkeepingScore } from "@/types/achievements";

interface Props {
  score: BookkeepingScore;
}

export default function BookkeepingScoreWidget({ score }: Props) {
  return (
    <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
          <h2 className="text-base font-semibold">Bookkeeping Score</h2>
        </div>
        <Star className="w-5 h-5 text-amber-500" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{score.total}</span>
        <span className="text-xs text-muted-foreground">pts · Lv{score.level} {score.levelName}</span>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {score.streak}d streak</span>
        <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-500" /> {score.achievementsUnlocked}/{score.totalAchievements}</span>
      </div>
    </div>
  );
}
