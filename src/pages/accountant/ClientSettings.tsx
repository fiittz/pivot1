import { useState } from "react";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  KeyRound,
  Shield,
  Eye,
  FileText,
  Bell,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentTemplate {
  id: string;
  title: string;
  description: string;
}

const ClientSettings = () => {
  // Password reset
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Client status
  const [clientStatus, setClientStatus] = useState("active");

  // Access level
  const [accessLevel, setAccessLevel] = useState("read_only");

  // Document request templates (local state only)
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  // Notification preferences
  const [notifyDocumentRequests, setNotifyDocumentRequests] = useState(true);
  const [notifyFilingDeadlines, setNotifyFilingDeadlines] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);

  const handleSendPasswordReset = async () => {
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      toast.error("Please enter the client's email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: trimmed },
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${trimmed}`);
      setResetEmail("");
    } catch (error) {
      console.error("Error sending password reset:", error);
      toast.error("Failed to send password reset email");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleAddTemplate = () => {
    const title = newTemplateTitle.trim();
    const description = newTemplateDescription.trim();
    if (!title) {
      toast.error("Template title is required");
      return;
    }

    const template: DocumentTemplate = {
      id: crypto.randomUUID(),
      title,
      description,
    };

    setTemplates((prev) => [...prev, template]);
    setNewTemplateTitle("");
    setNewTemplateDescription("");
    toast.success("Template added");
  };

  const handleRemoveTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template removed");
  };

  const inputClass =
    "h-11 bg-transparent border border-border font-['IBM_Plex_Mono'] text-sm rounded-md";
  const labelClass =
    "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";

  return (
    <AccountantLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Client Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage client account settings, access levels, and notification
            preferences.
          </p>
        </div>

        {/* Password Reset */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Password Reset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a password reset email to the client. They will receive a
              link to create a new password.
            </p>
            <div className="space-y-2">
              <Label className={labelClass}>Client Email</Label>
              <Input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="client@example.ie"
                className={inputClass}
              />
            </div>
            <Button
              onClick={handleSendPasswordReset}
              disabled={isSendingReset}
              className="h-11 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none gap-1.5"
            >
              {isSendingReset ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Email"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Client Status Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Client Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Control the client's account status. Suspended clients cannot log
              in. Archived clients are hidden from active lists.
            </p>
            <div className="space-y-2">
              <Label className={labelClass}>Status</Label>
              <Select value={clientStatus} onValueChange={setClientStatus}>
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Access Level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Access Level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define what data and actions the client can access within their
              account.
            </p>
            <div className="space-y-2">
              <Label className={labelClass}>Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read_only">Read Only</SelectItem>
                  <SelectItem value="read_write">Read & Write</SelectItem>
                  <SelectItem value="full_access">Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Document Request Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Document Request Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Save common document request templates for reuse. These are stored
              locally and will be persisted to the database in a future update.
            </p>

            {templates.length > 0 && (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {template.title}
                      </p>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTemplate(template.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Separator />
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className={labelClass}>Template Title</Label>
                <Input
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="e.g. Annual accounts pack"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Description (optional)</Label>
                <Input
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="Documents needed for year-end filing"
                  className={inputClass}
                />
              </div>
              <Button
                onClick={handleAddTemplate}
                variant="outline"
                className="h-11 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest rounded-md shadow-none gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Configure which email notifications the client receives.
            </p>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Document Requests
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notify the client when you request documents
                </p>
              </div>
              <Switch
                checked={notifyDocumentRequests}
                onCheckedChange={setNotifyDocumentRequests}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Filing Deadlines
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notify the client about upcoming filing deadlines
                </p>
              </div>
              <Switch
                checked={notifyFilingDeadlines}
                onCheckedChange={setNotifyFilingDeadlines}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground">
                  Messages from Accountant
                </Label>
                <p className="text-xs text-muted-foreground">
                  Notify the client when you send them a message
                </p>
              </div>
              <Switch
                checked={notifyMessages}
                onCheckedChange={setNotifyMessages}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AccountantLayout>
  );
};

export default ClientSettings;
