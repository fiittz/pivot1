import { useState, useEffect } from "react";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AccountantPractice } from "@/types/accountant";

const AccountantSettings = () => {
  const { user, practice, refreshRoles } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_agent_number: "",
  });

  useEffect(() => {
    if (practice) {
      setForm({
        name: practice.name || "",
        email: practice.email || "",
        phone: practice.phone || "",
        address: practice.address || "",
        tax_agent_number: practice.tax_agent_number || "",
      });
    }
  }, [practice]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Practice name is required");
      return;
    }

    setIsSaving(true);
    try {
      if (practice?.id) {
        // Update existing
        const { error } = await supabase
          .from("accountant_practices")
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            tax_agent_number: form.tax_agent_number.trim() || null,
          })
          .eq("id", practice.id);

        if (error) throw error;
      } else {
        // Create new practice
        const { error } = await supabase.from("accountant_practices").insert({
          owner_id: user.id,
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          tax_agent_number: form.tax_agent_number.trim() || null,
        });

        if (error) throw error;
      }

      toast.success("Practice settings saved");
      refreshRoles();
    } catch (error) {
      console.error("Error saving practice:", error);
      toast.error("Failed to save practice settings");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "h-11 bg-transparent border border-border font-['IBM_Plex_Mono'] text-sm rounded-md";
  const labelClass =
    "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";

  return (
    <AccountantLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Practice Settings</h2>
          <p className="text-muted-foreground mt-1">
            Manage your firm details and Tax Agent Identification Number (TAIN).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Practice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className={labelClass}>Practice Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your firm name"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>TAIN (Tax Agent Number)</Label>
              <Input
                value={form.tax_agent_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tax_agent_number: e.target.value }))
                }
                placeholder="e.g. 12345T"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Your Revenue-issued Tax Agent Identification Number
              </p>
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="firm@example.ie"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+353 1 234 5678"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Office address"
                className={inputClass}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-11 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AccountantLayout>
  );
};

export default AccountantSettings;
