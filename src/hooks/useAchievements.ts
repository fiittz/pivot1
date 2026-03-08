import { useState, useMemo, useCallback, useEffect } from "react";
import { ACHIEVEMENTS, LEVELS, type UserAchievement, type BookkeepingScore } from "@/types/achievements";

const STORAGE_KEY = "balnce-achievements";
const STREAK_KEY = "balnce-login-streak";

interface StreakData {
  lastLogin: string;
  streak: number;
}

function loadAchievements(): UserAchievement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAchievements(achievements: UserAchievement[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { lastLogin: "", streak: 0 };
  } catch {
    return { lastLogin: "", streak: 0 };
  }
}

function updateStreak(): number {
  const data = loadStreak();
  const today = new Date().toISOString().slice(0, 10);

  if (data.lastLogin === today) return data.streak;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = data.lastLogin === yesterday ? data.streak + 1 : 1;

  localStorage.setItem(STREAK_KEY, JSON.stringify({ lastLogin: today, streak: newStreak }));
  return newStreak;
}

interface Stats {
  totalCategorized: number;
  totalReceipts: number;
  totalMatched: number;
  totalImports: number;
  vatReturnsCompleted: number;
  allOnboardingDone: boolean;
  hasZeroUncategorised: boolean;
}

export function useAchievements(stats: Stats) {
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>(loadAchievements);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(updateStreak());
  }, []);

  const checkAndUnlock = useCallback((achievementId: string, currentProgress: number) => {
    const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!achievement) return;

    setUserAchievements((prev) => {
      const existing = prev.find((a) => a.achievementId === achievementId);
      if (existing) return prev;

      if (currentProgress >= achievement.threshold) {
        const updated = [...prev, {
          achievementId,
          unlockedAt: new Date().toISOString(),
          progress: currentProgress,
        }];
        saveAchievements(updated);
        return updated;
      }
      return prev;
    });
  }, []);

  // Check achievements based on stats
  useEffect(() => {
    checkAndUnlock("first_import", stats.totalImports);
    checkAndUnlock("categorize_10", stats.totalCategorized);
    checkAndUnlock("categorize_100", stats.totalCategorized);
    checkAndUnlock("categorize_500", stats.totalCategorized);
    checkAndUnlock("receipt_first", stats.totalReceipts);
    checkAndUnlock("receipt_50", stats.totalReceipts);
    checkAndUnlock("receipt_match", stats.totalMatched);
    checkAndUnlock("vat_return", stats.vatReturnsCompleted);
    checkAndUnlock("zero_uncategorised", stats.hasZeroUncategorised ? 1 : 0);
    checkAndUnlock("all_onboarding", stats.allOnboardingDone ? 1 : 0);
    checkAndUnlock("streak_7", streak);
    checkAndUnlock("streak_30", streak);
  }, [stats, streak, checkAndUnlock]);

  const score = useMemo((): BookkeepingScore => {
    const totalPoints = userAchievements.reduce((sum, ua) => {
      const a = ACHIEVEMENTS.find((x) => x.id === ua.achievementId);
      return sum + (a?.points || 0);
    }, 0);

    let currentLevel = LEVELS[0];
    let nextLevel = LEVELS[1];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalPoints >= LEVELS[i].minPoints) {
        currentLevel = LEVELS[i];
        nextLevel = LEVELS[i + 1] || LEVELS[i];
        break;
      }
    }

    return {
      total: totalPoints,
      level: currentLevel.level,
      levelName: currentLevel.name,
      nextLevelAt: nextLevel.minPoints,
      streak,
      achievementsUnlocked: userAchievements.length,
      totalAchievements: ACHIEVEMENTS.length,
    };
  }, [userAchievements, streak]);

  const achievements = useMemo(() => {
    return ACHIEVEMENTS.map((a) => {
      const unlocked = userAchievements.find((ua) => ua.achievementId === a.id);
      return { ...a, unlocked: !!unlocked, unlockedAt: unlocked?.unlockedAt };
    });
  }, [userAchievements]);

  return { achievements, score, streak, userAchievements };
}
