import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInviteClient } from "@/hooks/accountant/useInviteClient";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

const InviteClient = () => {
  const navigate = useNavigate();
  const inviteMutation = useInviteClient();

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_business_name: "",
    client_phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.client_name.trim() || !form.client_email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    try {
      await inviteMutation.mutateAsync({
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim(),
        client_business_name: form.client_business_name.trim() || undefined,
        client_phone: form.client_phone.trim() || undefined,
        message: form.message.trim() || undefined,
      });

      toast.success(`Invitation sent to ${form.client_email}`);
      navigate("/accountant/clients");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(msg);
    }
  };

  const inputClass =
    "h-11 bg-transparent border border-border font-['IBM_Plex_Mono'] text-sm rounded-md";
  const labelClass =
    "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";

  return (
    <AccountantLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate("/accountant/clients")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>

        <div>
          <h2 className="text-2xl font-semibold text-foreground">Invite a Client</h2>
          <p className="text-muted-foreground mt-1">
            Send an email invitation to connect with a business owner on Balnce.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Client Name *</Label>
                  <Input
                    value={form.client_name}
                    onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                    placeholder="John Smith"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Email *</Label>
                  <Input
                    type="email"
                    value={form.client_email}
                    onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                    placeholder="john@business.ie"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Business Name</Label>
                  <Input
                    value={form.client_business_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, client_business_name: e.target.value }))
                    }
                    placeholder="Smith Carpentry Ltd"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Phone</Label>
                  <Input
                    value={form.client_phone}
                    onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                    placeholder="+353 86 123 4567"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Personal Message (optional)</Label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Hi John, I'd like to connect your Balnce account so I can manage your bookkeeping and tax filings..."
                  rows={3}
                  className="w-full bg-transparent border border-border font-['IBM_Plex_Mono'] text-sm rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="h-11 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/accountant/clients")}
                  className="h-11 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest rounded-md shadow-none"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          The client will receive an email with a link to accept your invitation. If they don't
          have a Balnce account, they'll be prompted to create one. Invitations expire after 30
          days.
        </p>
      </div>
    </AccountantLayout>
  );
};

export default InviteClient;
