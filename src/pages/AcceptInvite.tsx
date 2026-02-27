import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAcceptInvite } from "@/hooks/accountant/useAcceptInvite";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const acceptMutation = useAcceptInvite();
  const [accepted, setAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!token) return;

    try {
      const result = await acceptMutation.mutateAsync(token);
      setAccepted(true);
      setErrorMsg(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to accept invitation";
      setErrorMsg(msg);
    }
  };

  // If not logged in, redirect to welcome with return URL
  useEffect(() => {
    if (!authLoading && !user) {
      // Store the invite URL so we can return after login
      sessionStorage.setItem("pendingInviteToken", token || "");
      navigate(`/?redirect=/invite/${token}`);
    }
  }, [authLoading, user, token, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
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

      <div className="relative z-10 max-w-md w-full">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img
            src="/enhance-penguin-transparent.png"
            alt="Balnce"
            className="w-10 h-10 object-contain"
          />
          <span className="text-2xl font-semibold text-foreground tracking-tight">Balnce</span>
        </div>

        <Card>
          <CardContent className="py-8 px-6 text-center">
            {/* Success */}
            {accepted && (
              <>
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  You're connected!
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {acceptMutation.data?.message || "Your accountant can now view your bookkeeping data."}
                </p>
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="h-11 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none"
                >
                  Go to Dashboard
                </Button>
              </>
            )}

            {/* Error */}
            {errorMsg && !accepted && (
              <>
                <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Invitation Error
                </h2>
                <p className="text-muted-foreground text-sm mb-6">{errorMsg}</p>
                <Button
                  onClick={() => navigate("/dashboard")}
                  variant="outline"
                  className="h-11 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest rounded-md shadow-none"
                >
                  Go to Dashboard
                </Button>
              </>
            )}

            {/* Pending — ready to accept */}
            {!accepted && !errorMsg && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-[#E8930C]/10 flex items-center justify-center mb-4">
                  <img
                    src="/enhance-penguin-transparent.png"
                    alt=""
                    className="w-10 h-10 object-contain"
                  />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Accountant Invitation
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your accountant has invited you to connect your Balnce account.
                  By accepting, they'll be able to view your bookkeeping data and
                  manage your tax filings.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={handleAccept}
                    disabled={acceptMutation.isPending}
                    className="h-11 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none"
                  >
                    {acceptMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        Accepting...
                      </>
                    ) : (
                      "Accept Invitation"
                    )}
                  </Button>
                  <Button
                    onClick={() => navigate("/dashboard")}
                    variant="outline"
                    className="h-11 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest rounded-md shadow-none"
                  >
                    Decline
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AcceptInvite;
