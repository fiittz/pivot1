import AchievementCard from "./AchievementCard";
import type { Achievement } from "@/types/achievements";

interface Props {
  achievements: (Achievement & { unlocked: boolean; unlockedAt?: string })[];
}

export default function AchievementsPanel({ achievements }: Props) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <div className="space-y-4">
      {unlocked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Unlocked ({unlocked.length})</h3>
          {unlocked.map((a) => <AchievementCard key={a.id} achievement={a} />)}
        </div>
      )}
      {locked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Locked ({locked.length})</h3>
          {locked.map((a) => <AchievementCard key={a.id} achievement={a} />)}
        </div>
      )}
    </div>
  );
}
