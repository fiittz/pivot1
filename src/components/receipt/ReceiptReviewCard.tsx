import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ReceiptData {
  supplier_name?: string;
  total_amount?: number;
  date?: string;
  suggested_category?: string;
  vat_rate?: string;
}

interface ReceiptReviewCardProps {
  imageUrl?: string;
  receiptData: ReceiptData;
  onAccept: (data: ReceiptData) => void;
  onEdit?: () => void;
  isConfirmed?: boolean;
}

export default function ReceiptReviewCard({ imageUrl, receiptData, onAccept, onEdit, isConfirmed }: ReceiptReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(receiptData);

  const borderColor = isConfirmed ? "border-green-500" : "border-amber-400";

  return (
    <div className={`bg-card rounded-xl border-2 ${borderColor} p-4 flex gap-4 transition-colors`}>
      {/* Thumbnail */}
      {imageUrl && (
        <img src={imageUrl} alt="Receipt" className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
      )}

      {/* Data */}
      <div className="flex-1 space-y-2">
        {isEditing ? (
          <>
            <Input
              value={editData.supplier_name || ""}
              onChange={(e) => setEditData({ ...editData, supplier_name: e.target.value })}
              placeholder="Vendor"
              className="h-8 text-sm"
            />
            <Input
              type="number"
              value={editData.total_amount ?? ""}
              onChange={(e) => setEditData({ ...editData, total_amount: Number(e.target.value) })}
              placeholder="Amount"
              className="h-8 text-sm"
            />
            <Input
              type="date"
              value={editData.date || ""}
              onChange={(e) => setEditData({ ...editData, date: e.target.value })}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { onAccept(editData); setIsEditing(false); }}>
                <Check className="w-3.5 h-3.5" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold text-sm">{receiptData.supplier_name || "Unknown vendor"}</p>
            <p className="text-xl font-bold">€{(receiptData.total_amount ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{receiptData.date || "No date"}</p>
            {receiptData.suggested_category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-block">
                {receiptData.suggested_category}
              </span>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onAccept(receiptData)}>
                <Check className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setIsEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
