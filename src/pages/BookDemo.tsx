import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

type Step = "date" | "time" | "details" | "confirmed";

interface SlotsResponse {
  slots: Record<string, string[]>;
  timezone: string;
}

const BookDemo = () => {
  const [step, setStep] = useState<Step>("date");
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available slots on mount
  useEffect(() => {
    async function fetchSlots() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-available-slots`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const response: SlotsResponse = await res.json();
        setSlots(response.slots || {});
      } catch (err) {
        console.error("Failed to fetch slots:", err);
        toast.error("Failed to load available times. Please refresh.");
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, []);

  const availableDates = new Set(Object.keys(slots));

  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";

  const timeSlotsForDate = selectedDateStr ? slots[selectedDateStr] || [] : [];

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!availableDates.has(dateStr)) return;
    setSelectedDate(date);
    setSelectedTime("");
    setStep("time");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert Dublin local time to UTC
      const isoDate = new Date(`${selectedDateStr}T${selectedTime}:00`);
      const dublinOffset = getDublinOffset(isoDate);
      const utcDate = new Date(isoDate.getTime() - dublinOffset * 60_000);

      const { data, error } = await supabase.functions.invoke("create-booking", {
        body: {
          name: name.trim(),
          email: email.trim(),
          scheduled_at: utcDate.toISOString(),
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        setIsSubmitting(false);
        return;
      }

      setStep("confirmed");
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Failed to book demo. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Style constants matching Welcome.tsx
  const inputClass =
    "h-14 bg-transparent border border-black/20 font-['IBM_Plex_Mono'] text-sm text-foreground placeholder:text-black/30 rounded-none";
  const labelClass =
    "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";
  const primaryBtnClass =
    "w-full h-14 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-none shadow-none";

  const formatSelectedDateTime = () => {
    if (!selectedDate || !selectedTime) return "";
    return selectedDate.toLocaleDateString("en-IE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) + ` at ${selectedTime}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Orange glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"
        style={{
          width: "800px",
          height: "600px",
          background:
            "radial-gradient(ellipse at center, rgba(232,147,12,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <img
            src="/enhance-penguin-transparent.png"
            alt="Balnce"
            className="object-contain"
            style={{ height: "clamp(3rem, 8vw, 5rem)", width: "auto" }}
          />
          <div className="inline-flex gap-[0.08em] items-center">
            {"BALNCE".split("").map((char, i) => (
              <div
                key={i}
                className="relative overflow-hidden flex items-center justify-center"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(2rem, 6vw, 4rem)",
                  width: "0.65em",
                  height: "1.05em",
                  backgroundColor: "#000",
                  color: "#fff",
                }}
              >
                {char}
              </div>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-base mb-8 font-['IBM_Plex_Sans']">
          Book a demo
        </p>

        <div className="w-full max-w-md">
          {/* Step: Pick a date */}
          {step === "date" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-semibold text-foreground font-['IBM_Plex_Mono'] mb-4 text-center">
                Pick a date
              </h2>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#E8930C]" />
                </div>
              ) : (
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => {
                      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      return !availableDates.has(dateStr);
                    }}
                    className="rounded-none border border-black/10"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step: Pick a time */}
          {step === "time" && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep("date")}
                className="text-muted-foreground hover:text-foreground mb-6 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <h2 className="text-xl font-semibold text-foreground font-['IBM_Plex_Mono'] mb-2 text-center">
                Pick a time
              </h2>
              <p className="text-muted-foreground text-sm font-['IBM_Plex_Sans'] mb-6 text-center">
                {selectedDate?.toLocaleDateString("en-IE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                {" "}&middot; 30 min &middot; Dublin time
              </p>
              {timeSlotsForDate.length === 0 ? (
                <p className="text-center text-muted-foreground font-['IBM_Plex_Sans']">
                  No available times for this date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {timeSlotsForDate.map((time) => (
                    <Button
                      key={time}
                      variant="outline"
                      onClick={() => handleTimeSelect(time)}
                      className="h-12 border border-black/20 bg-transparent font-['IBM_Plex_Mono'] text-sm text-foreground hover:bg-[#E8930C]/10 hover:border-[#E8930C] hover:text-[#E8930C] rounded-none shadow-none transition-colors"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Enter details */}
          {step === "details" && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep("time")}
                className="text-muted-foreground hover:text-foreground mb-6 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <h2 className="text-xl font-semibold text-foreground font-['IBM_Plex_Mono'] mb-2 text-center">
                Your details
              </h2>
              <p className="text-muted-foreground text-sm font-['IBM_Plex_Sans'] mb-6 text-center">
                {formatSelectedDateTime()}
              </p>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className={labelClass}>
                    Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className={labelClass}>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`${primaryBtnClass} mt-6`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Booking...
                    </>
                  ) : (
                    "Book Demo"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Confirmation */}
          {step === "confirmed" && (
            <div className="animate-fade-in text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-foreground font-['IBM_Plex_Mono'] mb-2">
                You're booked!
              </h2>
              <p className="text-muted-foreground font-['IBM_Plex_Sans'] mb-2">
                {formatSelectedDateTime()}
              </p>
              <p className="text-muted-foreground text-sm font-['IBM_Plex_Sans'] mb-8">
                We've sent a confirmation to <strong>{email}</strong>. You'll get reminders before the call.
              </p>
              <Button
                onClick={() => window.location.href = "/"}
                variant="outline"
                className="h-12 border border-black/20 bg-transparent font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-foreground hover:bg-black/5 rounded-none shadow-none"
              >
                Back to Balnce
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Get the Dublin timezone offset in minutes from UTC for a given date.
 * Handles IST (UTC+1) and GMT (UTC+0) automatically.
 */
function getDublinOffset(date: Date): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const dublinStr = date.toLocaleString("en-US", { timeZone: "Europe/Dublin" });
  const utcDate = new Date(utcStr);
  const dublinDate = new Date(dublinStr);
  return (dublinDate.getTime() - utcDate.getTime()) / 60_000;
}

export default BookDemo;
