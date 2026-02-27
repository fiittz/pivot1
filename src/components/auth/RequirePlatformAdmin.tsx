import { useState, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN;

interface RequirePlatformAdminProps {
  children: ReactNode;
}

export function RequirePlatformAdmin({ children }: RequirePlatformAdminProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("admin_unlocked") === "1"
  );

  const handleSubmit = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem("admin_unlocked", "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-xs">
        <CardHeader>
          <CardTitle className="font-['IBM_Plex_Mono'] text-sm uppercase tracking-widest text-center">
            Admin Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError(false);
              }}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
            {error && (
              <p className="text-destructive text-sm text-center">Incorrect PIN</p>
            )}
            <Button type="submit" className="w-full" disabled={pin.length !== 4}>
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
