import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import type { Budget, BudgetCategory } from "@/types/budget";

interface Props {
  onSave: (budget: Omit<Budget, "id" | "createdAt">) => void;
  categories: { id: string; name: string }[];
}

export default function BudgetSetupCard({ onSave, categories }: Props) {
  const [name, setName] = useState("Monthly Budget");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [items, setItems] = useState<BudgetCategory[]>([]);

  const addCategory = () => {
    const unused = categories.find((c) => !items.some((i) => i.categoryId === c.id));
    if (unused) {
      setItems([...items, { categoryId: unused.id, categoryName: unused.name, monthlyLimit: 0 }]);
    }
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof BudgetCategory, value: string | number) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      if (field === "categoryId") {
        const cat = categories.find((c) => c.id === value);
        return { ...item, categoryId: value as string, categoryName: cat?.name || "" };
      }
      return { ...item, [field]: value };
    }));
  };

  const totalLimit = items.reduce((s, i) => s + i.monthlyLimit, 0);

  const handleSave = () => {
    if (!items.length) return;
    onSave({
      name,
      period,
      startDate: new Date().toISOString().slice(0, 10),
      categories: items,
      totalLimit: period === "annual" ? totalLimit * 12 : period === "quarterly" ? totalLimit * 3 : totalLimit,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Set Up Budget</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Budget name" className="flex-1" />
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select value={item.categoryId} onValueChange={(v) => updateItem(idx, "categoryId", v)}>
                <SelectTrigger className="flex-1 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                <Input
                  type="number"
                  value={item.monthlyLimit || ""}
                  onChange={(e) => updateItem(idx, "monthlyLimit", Number(e.target.value))}
                  className="w-28 pl-6 h-9 text-xs"
                  placeholder="0.00"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-xs" onClick={addCategory} disabled={items.length >= categories.length}>
            <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Category
          </Button>
          <span className="text-sm font-medium">Total: €{totalLimit.toFixed(2)}/mo</span>
        </div>

        <Button className="w-full" onClick={handleSave} disabled={!items.length}>
          Save Budget
        </Button>
      </CardContent>
    </Card>
  );
}
