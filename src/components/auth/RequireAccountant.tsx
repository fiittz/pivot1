import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface RequireAccountantProps {
  children: ReactNode;
}

export function RequireAccountant({ children }: RequireAccountantProps) {
  const { user, isLoading, isAccountant } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
      return;
    }

    if (!isLoading && user && isAccountant === false) {
      navigate("/dashboard");
    }
  }, [user, isLoading, isAccountant, navigate]);

  if (isLoading || isAccountant === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return user && isAccountant ? <>{children}</> : null;
}
