import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Receipt,
  Landmark,
  History,
  FileText,
  Settings,
  Plus,
  CheckCircle2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  useOnboardingChecklist,
  useToggleChecklistItem,
  useAddChecklistItem,
  useUpdateChecklistNotes,
  type ChecklistItem,
} from "@/hooks/accountant/useOnboardingChecklist";

interface OnboardingChecklistProps {
  accountantClientId: string;
}

const CATEGORIES = [
  { key: "company_details", label: "Company Details", icon: Building2 },
  { key: "tax_registration", label: "Tax Registration", icon: Receipt },
  { key: "bank_accounts", label: "Bank Accounts", icon: Landmark },
  { key: "prior_year", label: "Prior Year", icon: History },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "preferences", label: "Preferences", icon: Settings },
] as const;

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function OnboardingChecklist({ accountantClientId }: OnboardingChecklistProps) {
  const { data: items, isLoading } = useOnboardingChecklist(accountantClientId);
  const toggleItem = useToggleChecklistItem();
  const addItem = useAddChecklistItem();
  const updateNotes = useUpdateChecklistNotes();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<string>("company_details");
  const [addLabel, setAddLabel] = useState("");

  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [activeNotesItem, setActiveNotesItem] = useState<ChecklistItem | null>(null);
  const [notesText, setNotesText] = useState("");

  const grouped = useMemo(() => {
    if (!items) return {};
    const map: Record<string, ChecklistItem[]> = {};
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items]);

  const completedCount = items?.filter((i) => i.is_completed).length ?? 0;
  const totalCount = items?.length ?? 0;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = (item: ChecklistItem) => {
    toggleItem.mutate(
      {
        id: item.id,
        accountant_client_id: accountantClientId,
        is_completed: !item.is_completed,
      },
      {
        onError: () => toast.error("Failed to update checklist item"),
      },
    );
  };

  const handleAddItem = () => {
    if (!addLabel.trim()) return;
    addItem.mutate(
      {
        accountant_client_id: accountantClientId,
        label: addLabel.trim(),
        category: addCategory,
      },
      {
        onSuccess: () => {
          setAddLabel("");
          setAddDialogOpen(false);
          toast.success("Item added");
        },
        onError: () => toast.error("Failed to add item"),
      },
    );
  };

  const handleOpenNotes = (item: ChecklistItem) => {
    setActiveNotesItem(item);
    setNotesText(item.notes ?? "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (!activeNotesItem) return;
    updateNotes.mutate(
      {
        id: activeNotesItem.id,
        accountant_client_id: accountantClientId,
        notes: notesText,
      },
      {
        onSuccess: () => {
          setNotesDialogOpen(false);
          toast.success("Notes saved");
        },
        onError: () => toast.error("Failed to save notes"),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading onboarding checklist...</span>
      </div>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Onboarding Checklist</h4>
            <Badge variant={percentage === 100 ? "default" : "secondary"}>
              {completedCount}/{totalCount} complete
            </Badge>
          </div>
          <div className="space-y-1">
            <Progress value={percentage} className="h-2.5" />
            <p className="text-xs text-muted-foreground text-right font-mono tabular-nums">{percentage}%</p>
          </div>
        </div>
        <CardContent className="space-y-6 pt-4">
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const categoryItems = grouped[key];
            if (!categoryItems?.length) return null;

            const catCompleted = categoryItems.filter((i) => i.is_completed).length;
            const allDone = catCompleted === categoryItems.length;

            return (
              <div key={key} className="pb-4 border-b border-muted/30 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${allDone ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <h4 className="text-sm font-medium">{label}</h4>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {catCompleted}/{categoryItems.length}
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        item.is_completed ? "bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={() => handleToggle(item)}
                        disabled={toggleItem.isPending}
                      />
                      <span
                        className={`flex-1 ${
                          item.is_completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.notes && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Notes
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleOpenNotes(item)}
                        title="Add/edit notes"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                      {item.is_completed && item.completed_at && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          {formatDate(item.completed_at)}
                        </span>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground gap-1 h-7"
                    onClick={() => {
                      setAddCategory(key);
                      setAddDialogOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3" /> Add Custom Item
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add Custom Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Checklist Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={addCategory} onValueChange={setAddCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="e.g. Letter of engagement countersigned"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={!addLabel.trim() || addItem.isPending}>
              {addItem.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes: {activeNotesItem?.label}</DialogTitle>
          </DialogHeader>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Add notes about this item..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} disabled={updateNotes.isPending}>
              {updateNotes.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
