import { useState } from "react";
import { Brain, X } from "lucide-react";

const DISMISSED_KEY = "balnce-ai-disclosure-dismissed";

export default function AIDisclosureBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === "true"; } catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, "true"); } catch {}
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 flex items-center gap-3">
      <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <p className="text-xs text-blue-700 dark:text-blue-300 flex-1">
        Some categories and matches are suggested by AI. Look for confidence badges to see AI suggestions — you can always change them manually.
      </p>
      <button onClick={handleDismiss} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors flex-shrink-0">
        <X className="w-3.5 h-3.5 text-blue-500" />
      </button>
    </div>
  );
}
