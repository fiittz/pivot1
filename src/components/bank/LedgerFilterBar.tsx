import { useState, useEffect } from "react";
import { Search, Filter, X, ArrowUpDown, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";
import type { DateRange } from "react-day-picker";

interface LedgerFilterBarProps {
  searchText: string;
  onSearchChange: (v: string) => void;
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (v: { from?: Date; to?: Date }) => void;
  amountRange: { min?: number; max?: number };
  onAmountRangeChange: (v: { min?: number; max?: number }) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (v: string | null) => void;
  sortField: "date" | "amount" | "description";
  onSortFieldChange: (v: "date" | "amount" | "description") => void;
  sortDirection: "asc" | "desc";
  onSortDirectionChange: (v: "asc" | "desc") => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}

export default function LedgerFilterBar({
  searchText,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  amountRange,
  onAmountRangeChange,
  categoryFilter,
  onCategoryFilterChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onSortDirectionChange,
  onClearFilters,
  activeFilterCount,
}: LedgerFilterBarProps) {
  const { data: categories } = useCategories();
  const [localSearch, setLocalSearch] = useState(searchText);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minAmount, setMinAmount] = useState(amountRange.min?.toString() ?? "");
  const [maxAmount, setMaxAmount] = useState(amountRange.max?.toString() ?? "");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Sync external state
  useEffect(() => setLocalSearch(searchText), [searchText]);

  const handleDateSelect = (range: DateRange | undefined) => {
    onDateRangeChange({ from: range?.from, to: range?.to });
  };

  const applyAmountRange = () => {
    onAmountRangeChange({
      min: minAmount ? Number(minAmount) : undefined,
      max: maxAmount ? Number(maxAmount) : undefined,
    });
  };

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) return "Date range";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
    if (dateRange.from && dateRange.to) return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
    if (dateRange.from) return `From ${fmt(dateRange.from)}`;
    return `Until ${fmt(dateRange.to!)}`;
  };

  return (
    <div className="space-y-3">
      {/* Main search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(""); onSearchChange(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <Button
          variant={showAdvanced ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-9 gap-1.5"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => {
            onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc");
          }}
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortField === "date" ? "Date" : sortField === "amount" ? "Amount" : "Name"}
        </Button>
      </div>

      {/* Advanced filters row */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          {/* Date range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarIcon className="w-3.5 h-3.5" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={handleDateSelect}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* Amount range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                {amountRange.min || amountRange.max
                  ? `€${amountRange.min ?? 0} – €${amountRange.max ?? "∞"}`
                  : "Amount range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <p className="text-sm font-medium">Amount range</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="h-8"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="h-8"
                  />
                </div>
                <Button size="sm" className="w-full h-7 text-xs" onClick={applyAmountRange}>
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Category filter */}
          <Select
            value={categoryFilter ?? "all"}
            onValueChange={(v) => onCategoryFilterChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort field */}
          <Select value={sortField} onValueChange={(v) => onSortFieldChange(v as "date" | "amount" | "description")}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="amount">Sort by Amount</SelectItem>
              <SelectItem value="description">Sort by Name</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                onClearFilters();
                setLocalSearch("");
                setMinAmount("");
                setMaxAmount("");
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
