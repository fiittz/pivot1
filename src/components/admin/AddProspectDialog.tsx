import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAddProspect } from "@/hooks/admin/useCrmProspects";
import type { CrmPriority } from "@/types/crm";
import { PRIORITY_LABELS } from "@/types/crm";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddProspectDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [priority, setPriority] = useState<CrmPriority>("medium");
  const [comments, setComments] = useState("");

  const addProspect = useAddProspect();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addProspect.mutate(
      {
        name: name.trim(),
        area: area || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        priority,
        stage: "new_lead",
        comments: comments || null,
        deal_value: null,
        call_1_date: null,
        call_1_notes: null,
        demo_date: null,
        demo_notes: null,
        call_2_date: null,
        call_2_notes: null,
        pilot_started: null,
        closed_date: null,
      },
      {
        onSuccess: () => {
          toast.success("Prospect added");
          setName(""); setArea(""); setPhone(""); setEmail("");
          setWebsite(""); setPriority("medium"); setComments("");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Prospect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Practice Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="area">Area</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as CrmPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["top", "high", "medium", "low"] as CrmPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="comments">Comments</Label>
            <Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} className="min-h-[60px]" />
          </div>
          <Button type="submit" className="w-full" disabled={addProspect.isPending}>
            {addProspect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Prospect
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
