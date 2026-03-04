import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Globe, MapPin, MessageSquare, PhoneCall, Send, Calendar, CheckCircle, ArrowRight, Bell, Bot, Loader2, ExternalLink } from "lucide-react";
import { useProspectActivity, useAddActivity } from "@/hooks/admin/useCrmActivity";
import { useUpdateProspect, useUpdateProspectStage } from "@/hooks/admin/useCrmProspects";
import { useProspectDemoBookings } from "@/hooks/admin/useDemoBookings";
import type { CrmProspect, CrmActivityType, CrmStage } from "@/types/crm";
import {
  STAGE_LABELS, STAGE_ORDER, PRIORITY_LABELS, PRIORITY_COLORS,
  ACTIVITY_TYPE_LABELS,
} from "@/types/crm";
import { toast } from "sonner";

const ACTIVITY_ICONS: Record<CrmActivityType, React.ReactNode> = {
  note: <MessageSquare className="h-3.5 w-3.5" />,
  call: <PhoneCall className="h-3.5 w-3.5" />,
  email_sent: <Send className="h-3.5 w-3.5" />,
  demo_booked: <Calendar className="h-3.5 w-3.5" />,
  demo_confirmed: <CheckCircle className="h-3.5 w-3.5" />,
  demo_done: <CheckCircle className="h-3.5 w-3.5" />,
  stage_change: <ArrowRight className="h-3.5 w-3.5" />,
  follow_up: <Bell className="h-3.5 w-3.5" />,
  system: <Bot className="h-3.5 w-3.5" />,
};

interface Props {
  prospect: CrmProspect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProspectDetailDialog({ prospect, open, onOpenChange }: Props) {
  const [noteType, setNoteType] = useState<CrmActivityType>("note");
  const [noteContent, setNoteContent] = useState("");
  const [editing, setEditing] = useState<Partial<CrmProspect>>({});

  const { data: activity, isLoading: activityLoading } = useProspectActivity(prospect?.id);
  const { data: demos } = useProspectDemoBookings(prospect?.email);
  const addActivity = useAddActivity();
  const updateProspect = useUpdateProspect();
  const updateStage = useUpdateProspectStage();

  if (!prospect) return null;

  const handleStageChange = (newStage: CrmStage) => {
    updateStage.mutate(
      { prospectId: prospect.id, oldStage: prospect.stage, newStage },
      { onSuccess: () => toast.success("Stage updated") }
    );
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) return;
    addActivity.mutate(
      {
        prospectId: prospect.id,
        activityType: noteType,
        title: `${ACTIVITY_TYPE_LABELS[noteType]} added`,
        content: noteContent.trim(),
      },
      {
        onSuccess: () => {
          setNoteContent("");
          toast.success("Activity added");
        },
      }
    );
  };

  const handleFieldSave = (field: string, value: string) => {
    updateProspect.mutate(
      { id: prospect.id, [field]: value || null },
      { onSuccess: () => toast.success("Updated") }
    );
    setEditing({});
  };

  const editableField = (
    field: keyof CrmProspect,
    label: string,
    icon: React.ReactNode
  ) => {
    const value = (prospect[field] as string) || "";
    const isEditing = field in editing;
    return (
      <div className="flex items-center gap-2 text-sm">
        {icon}
        {isEditing ? (
          <Input
            autoFocus
            defaultValue={value}
            className="h-7 text-sm"
            onBlur={(e) => handleFieldSave(field, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFieldSave(field, (e.target as HTMLInputElement).value);
              if (e.key === "Escape") setEditing({});
            }}
          />
        ) : (
          <span
            className="cursor-pointer hover:underline text-muted-foreground"
            onClick={() => setEditing({ [field]: true })}
          >
            {value || `Add ${label}...`}
          </span>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">{prospect.name}</DialogTitle>
            <Badge className={PRIORITY_COLORS[prospect.priority]}>
              {PRIORITY_LABELS[prospect.priority]}
            </Badge>
          </div>
          <div className="pt-2">
            <Select value={prospect.stage} onValueChange={handleStageChange}>
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-3 py-2">
          {editableField("area", "area", <MapPin className="h-4 w-4 text-muted-foreground" />)}
          {editableField("phone", "phone", <Phone className="h-4 w-4 text-muted-foreground" />)}
          {editableField("email", "email", <Mail className="h-4 w-4 text-muted-foreground" />)}
          {editableField("website", "website", <Globe className="h-4 w-4 text-muted-foreground" />)}
        </div>

        {/* Comments */}
        {prospect.comments && (
          <p className="text-sm text-muted-foreground italic border-l-2 pl-3">
            {prospect.comments}
          </p>
        )}

        {/* Demo Bookings */}
        {demos && demos.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Demo Bookings</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {demos.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {new Date(d.scheduled_at).toLocaleDateString("en-IE", {
                        weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {d.confirmed && (
                      <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                        Confirmed
                      </Badge>
                    )}
                    {d.cancelled && (
                      <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                        Cancelled
                      </Badge>
                    )}
                  </div>
                  {d.meeting_url && (
                    <a href={d.meeting_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" /> Join
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Add Activity */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Add Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex gap-2">
              <Select value={noteType} onValueChange={(v) => setNoteType(v as CrmActivityType)}>
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["note", "call", "email_sent", "follow_up"] as CrmActivityType[]).map((t) => (
                    <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8" onClick={handleAddNote} disabled={addActivity.isPending}>
                {addActivity.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
              </Button>
            </div>
            <Textarea
              placeholder="What happened?"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="text-sm min-h-[60px]"
            />
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Activity</h4>
          {activityLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : activity && activity.length > 0 ? (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-2 text-sm">
                  <div className="mt-0.5 text-muted-foreground">
                    {ACTIVITY_ICONS[a.activity_type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("en-IE", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {a.content && (
                      <p className="text-muted-foreground text-xs mt-0.5">{a.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No activity yet</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
