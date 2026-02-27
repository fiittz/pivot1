import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "details" | "practice";

const AccountantSignup = () => {
  const navigate = useNavigate();
  const { user, refreshRoles } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Practice fields
  const [practiceName, setPracticeName] = useState("");
  const [tain, setTain] = useState("");

  const handleCreateAccount = async () => {
    if (!email || !password || !fullName) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/accountant/dashboard`,
          data: { full_name: fullName, is_accountant: true },
        },
      });

      if (error) throw error;

      if (data.user && data.session) {
        // Add accountant role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "accountant",
        });

        if (roleError) {
          console.error("Role insert error:", roleError);
          setErrorMsg(`Role error: ${roleError.message}`);
          setIsLoading(false);
          return; // Don't proceed — role is required
        }

        // Sync auth context so RequireAccountant sees the new role
        refreshRoles();
        setIsLoading(false);
        setStep("practice");
      } else if (data.user && !data.session) {
        // Email confirmation required — account created but no session yet
        toast.error(
          "Check your email to confirm your account, then come back and log in."
        );
        setIsLoading(false);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setErrorMsg(errMsg);
      toast.error(errMsg || "Failed to create account");
      setIsLoading(false);
    }
  };

  const handleCreatePractice = async () => {
    if (!practiceName.trim()) {
      toast.error("Practice name is required");
      return;
    }

    const currentUser = user || (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      toast.error("Not authenticated — please log in first");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from("accountant_practices").insert({
        owner_id: currentUser.id,
        name: practiceName.trim(),
        tax_agent_number: tain.trim() || null,
      });

      if (error) throw error;

      toast.success("Practice created! Welcome to Balnce.");
      navigate("/accountant/dashboard");
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setErrorMsg(errMsg);
      toast.error(errMsg || "Failed to create practice");
      setIsLoading(false);
    }
  };

  const inputClass =
    "h-14 bg-transparent border border-black/20 font-['IBM_Plex_Mono'] text-sm text-foreground placeholder:text-black/30 rounded-none";
  const labelClass =
    "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";
  const primaryBtnClass =
    "w-full h-14 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-none mt-6 shadow-none";

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
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"
        style={{
          width: "800px",
          height: "600px",
          background:
            "radial-gradient(ellipse at center, rgba(232,147,12,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
        <button
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground mb-8 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors"
        >
          &larr; Back
        </button>

        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="/enhance-penguin-transparent.png"
              alt="Balnce"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-3xl font-semibold text-foreground font-['IBM_Plex_Mono'] tracking-wide">
                {step === "details" ? "Accountant signup" : "Your practice"}
              </h1>
              <p className="text-sm text-muted-foreground font-['IBM_Plex_Sans']">
                {step === "details"
                  ? "Create your accountant account"
                  : "Set up your firm"}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm font-mono">
              {errorMsg}
            </div>
          )}

          {step === "details" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="full-name" className={labelClass}>
                  Full Name
                </Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-email" className={labelClass}>
                  Email
                </Label>
                <Input
                  id="acct-email"
                  type="email"
                  placeholder="you@firm.ie"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-password" className={labelClass}>
                  Password
                </Label>
                <Input
                  id="acct-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>

              <Button
                onClick={handleCreateAccount}
                disabled={isLoading}
                className={primaryBtnClass}
              >
                {isLoading ? "Creating account..." : "Continue"}
              </Button>

              <p className="text-center text-muted-foreground font-['IBM_Plex_Sans'] text-sm">
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/")}
                  className="font-semibold text-foreground underline"
                >
                  Log in
                </button>
              </p>
            </div>
          )}

          {step === "practice" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="practice-name" className={labelClass}>
                  Practice Name *
                </Label>
                <Input
                  id="practice-name"
                  type="text"
                  placeholder="Your firm name"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tain" className={labelClass}>
                  TAIN (Tax Agent Number)
                </Label>
                <Input
                  id="tain"
                  type="text"
                  placeholder="e.g. 12345T"
                  value={tain}
                  onChange={(e) => setTain(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground font-['IBM_Plex_Sans']">
                  Your Revenue-issued Tax Agent Identification Number. You can add this later.
                </p>
              </div>

              <Button
                onClick={handleCreatePractice}
                disabled={isLoading}
                className={primaryBtnClass}
              >
                {isLoading ? "Setting up..." : "Launch Practice"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountantSignup;
