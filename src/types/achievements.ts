export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "bookkeeping" | "receipts" | "compliance" | "streaks";
  threshold: number;
  points: number;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
  progress: number;
}

export interface BookkeepingScore {
  total: number;
  level: number;
  levelName: string;
  nextLevelAt: number;
  streak: number;
  achievementsUnlocked: number;
  totalAchievements: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_import", title: "First Steps", description: "Import your first bank CSV", icon: "Upload", category: "bookkeeping", threshold: 1, points: 10 },
  { id: "categorize_10", title: "Organiser", description: "Categorise 10 transactions", icon: "FolderCheck", category: "bookkeeping", threshold: 10, points: 20 },
  { id: "categorize_100", title: "Power Organiser", description: "Categorise 100 transactions", icon: "FolderCheck", category: "bookkeeping", threshold: 100, points: 50 },
  { id: "categorize_500", title: "Category Master", description: "Categorise 500 transactions", icon: "Crown", category: "bookkeeping", threshold: 500, points: 100 },
  { id: "receipt_first", title: "Receipt Rookie", description: "Upload your first receipt", icon: "Camera", category: "receipts", threshold: 1, points: 10 },
  { id: "receipt_50", title: "Receipt Pro", description: "Upload 50 receipts", icon: "Camera", category: "receipts", threshold: 50, points: 50 },
  { id: "receipt_match", title: "Perfect Match", description: "Match 10 receipts to transactions", icon: "Link", category: "receipts", threshold: 10, points: 30 },
  { id: "vat_return", title: "VAT Ready", description: "Complete your first VAT return", icon: "FileCheck", category: "compliance", threshold: 1, points: 50 },
  { id: "zero_uncategorised", title: "Clean Slate", description: "Clear all uncategorised transactions", icon: "Sparkles", category: "compliance", threshold: 1, points: 30 },
  { id: "streak_7", title: "Week Warrior", description: "Log in 7 days in a row", icon: "Flame", category: "streaks", threshold: 7, points: 20 },
  { id: "streak_30", title: "Monthly Master", description: "Log in 30 days in a row", icon: "Flame", category: "streaks", threshold: 30, points: 75 },
  { id: "all_onboarding", title: "Fully Set Up", description: "Complete all onboarding steps", icon: "CheckCircle", category: "compliance", threshold: 1, points: 40 },
];

export const LEVELS = [
  { level: 1, name: "Apprentice", minPoints: 0 },
  { level: 2, name: "Bookkeeper", minPoints: 50 },
  { level: 3, name: "Organiser", minPoints: 150 },
  { level: 4, name: "Pro", minPoints: 300 },
  { level: 5, name: "Master", minPoints: 500 },
] as const;
