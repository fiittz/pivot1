import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocumentRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    title: string;
    description?: string;
    category?: string;
    due_date?: string;
  }) => void;
  isSaving?: boolean;
}

const CATEGORY_OPTIONS = [
  "Bank Statement",
  "Receipt",
  "Invoice",
  "Tax Certificate",
  "P60 / Employment Detail Summary",
  "P45",
  "Insurance Certificate",
  "Lease Agreement",
  "Utility Bill",
  "VAT Certificate",
  "Directors Resolution",
  "Other",
];

export function DocumentRequestForm({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: DocumentRequestFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setCategory("");
      setDueDate("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      due_date: dueDate || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="req-title">Title</Label>
              <Input
                id="req-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bank statement for Jan 2025"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-description">Description</Label>
              <Textarea
                id="req-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details about what is needed..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-due-date">Due Date</Label>
                <Input
                  id="req-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSaving}
              className="border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white"
            >
              {isSaving ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
