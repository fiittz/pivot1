import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, Flame, Trophy } from "lucide-react";
import type { BookkeepingScore } from "@/types/achievements";

interface Props {
  score: BookkeepingScore;
}

export default function BookkeepingScoreCard({ score }: Props) {
  const progressToNext = score.nextLevelAt > 0
    ? Math.min(((score.total) / score.nextLevelAt) * 100, 100)
    : 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          Bookkeeping Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{score.total}</p>
            <p className="text-xs text-muted-foreground">points</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">Level {score.level}: {score.levelName}</p>
            <p className="text-[10px] text-muted-foreground">Next level at {score.nextLevelAt} pts</p>
          </div>
        </div>

        <Progress value={progressToNext} className="h-2" />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Flame className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-sm font-bold">{score.streak}</p>
              <p className="text-[10px] text-muted-foreground">day streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Trophy className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-sm font-bold">{score.achievementsUnlocked}/{score.totalAchievements}</p>
              <p className="text-[10px] text-muted-foreground">achievements</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
