import { Card } from "@/components/ui/card";
import { Trophy, Lock } from "lucide-react";
import type { Achievement } from "@/types/achievements";

interface Props {
  achievement: Achievement & { unlocked: boolean; unlockedAt?: string };
}

export default function AchievementCard({ achievement }: Props) {
  return (
    <Card className={`p-3 flex items-center gap-3 ${achievement.unlocked ? "" : "opacity-50"}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${achievement.unlocked ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
        {achievement.unlocked ? <Trophy className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{achievement.title}</p>
        <p className="text-[10px] text-muted-foreground">{achievement.description}</p>
      </div>
      <div className="text-right">
        <span className="text-xs font-medium">{achievement.points} pts</span>
        {achievement.unlocked && achievement.unlockedAt && (
          <p className="text-[9px] text-muted-foreground">{new Date(achievement.unlockedAt).toLocaleDateString("en-IE")}</p>
        )}
      </div>
    </Card>
  );
}
