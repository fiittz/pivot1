import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendarSettings, useUpdateCalendarSettings } from "@/hooks/admin/useCalendarSettings";
import { toast } from "sonner";
import { Clock, Bell, Mail, Loader2 } from "lucide-react";

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarTab() {
  const { data: settings, isLoading } = useCalendarSettings();
  const updateMutation = useUpdateCalendarSettings();

  // Availability form state
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [lookaheadDays, setLookaheadDays] = useState(20);
  const [bufferHours, setBufferHours] = useState(3);
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [rateLimit, setRateLimit] = useState(3);

  // Reminder state
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder1h, setReminder1h] = useState(true);
  const [reminder10m, setReminder10m] = useState(true);

  // Sync form state when settings load
  useEffect(() => {
    if (settings) {
      setStartHour(settings.start_hour);
      setEndHour(settings.end_hour);
      setSlotMinutes(settings.slot_minutes);
      setLookaheadDays(settings.lookahead_days);
      setBufferHours(settings.same_day_buffer_hours);
      setAvailableDays(settings.available_days);
      setRateLimit(settings.rate_limit_per_hour);
      setReminder24h(settings.reminder_24h_enabled);
      setReminder1h(settings.reminder_1h_enabled);
      setReminder10m(settings.reminder_10m_enabled);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleToggleDay = (day: number) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSaveAvailability = async () => {
    if (startHour >= endHour) {
      toast.error("Start hour must be before end hour");
      return;
    }
    if (availableDays.length === 0) {
      toast.error("Select at least one available day");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        start_hour: startHour,
        end_hour: endHour,
        slot_minutes: slotMinutes,
        lookahead_days: lookaheadDays,
        same_day_buffer_hours: bufferHours,
        available_days: availableDays,
        rate_limit_per_hour: rateLimit,
      });
      toast.success("Availability settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleSaveReminders = async () => {
    try {
      await updateMutation.mutateAsync({
        reminder_24h_enabled: reminder24h,
        reminder_1h_enabled: reminder1h,
        reminder_10m_enabled: reminder10m,
      });
      toast.success("Reminder settings saved");
    } catch {
      toast.error("Failed to save reminder settings");
    }
  };

  return (
    <div className="space-y-6">
      {/* Availability Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Availability
          </CardTitle>
          <CardDescription>
            Configure when demo slots are shown on the booking page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Hour</Label>
              <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>End Hour</Label>
              <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Slot Duration (minutes)</Label>
              <Select value={String(slotMinutes)} onValueChange={(v) => setSlotMinutes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Lookahead Days</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={lookaheadDays}
                onChange={(e) => setLookaheadDays(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Same-Day Buffer (hours)</Label>
              <Input
                type="number"
                min={0}
                max={12}
                value={bufferHours}
                onChange={(e) => setBufferHours(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Rate Limit (per email/hour)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available Days</Label>
            <div className="flex gap-3 flex-wrap">
              {DAY_LABELS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={availableDays.includes(value)}
                    onCheckedChange={() => handleToggleDay(value)}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSaveAvailability}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Availability
          </Button>
        </CardContent>
      </Card>

      {/* Reminders Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders
          </CardTitle>
          <CardDescription>
            Toggle automated email reminders before demos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">24-hour reminder</p>
              <p className="text-sm text-muted-foreground">Sent ~24 hours before the demo</p>
            </div>
            <Switch checked={reminder24h} onCheckedChange={setReminder24h} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">1-hour reminder</p>
              <p className="text-sm text-muted-foreground">Sent ~1 hour before the demo</p>
            </div>
            <Switch checked={reminder1h} onCheckedChange={setReminder1h} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">10-minute reminder</p>
              <p className="text-sm text-muted-foreground">Sent ~10 minutes before the demo</p>
            </div>
            <Switch checked={reminder10m} onCheckedChange={setReminder10m} />
          </div>

          <Button
            onClick={handleSaveReminders}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Reminders
          </Button>
        </CardContent>
      </Card>

      {/* Email Templates Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Templates
          </CardTitle>
          <CardDescription>
            Preview of automated emails sent to prospects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="font-medium">Booking Confirmation</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">From:</span> Jamie from Balnce &lt;jamie@balnce.ie&gt;
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Subject:</span> Your Balnce demo is booked — [date/time]
            </p>
            <p className="text-sm text-muted-foreground">
              Includes meeting link (Jitsi), date/time details, and reschedule link.
              Also sends a .ics calendar invite to Jamie.
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="font-medium">Reminder Emails (24h / 1h / 10m)</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">From:</span> Jamie from Balnce &lt;jamie@balnce.ie&gt;
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Subject:</span> Reminder — [meeting title] is [timeframe]
            </p>
            <p className="text-sm text-muted-foreground">
              Includes meeting link, confirm attendance button, and reschedule link.
              Sent via cron job with 5-minute tolerance windows.
            </p>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Templates are defined in edge function code. To change content, update
            the email builder functions in <code>create-booking</code> and <code>send-demo-reminders</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
