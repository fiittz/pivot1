import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface RequirePlatformAdminProps {
  children: ReactNode;
}

export function RequirePlatformAdmin({ children }: RequirePlatformAdminProps) {
  const { user, isLoading, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
      return;
    }

    if (!isLoading && user && isPlatformAdmin === false) {
      navigate("/dashboard");
    }
  }, [user, isLoading, isPlatformAdmin, navigate]);

  if (isLoading || isPlatformAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return user && isPlatformAdmin ? <>{children}</> : null;
}
