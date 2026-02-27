import { Card, CardContent } from "@/components/ui/card";
import { ClientStatusBadge } from "./ClientStatusBadge";
import { Mail, Phone, Building2 } from "lucide-react";
import type { AccountantClient, ClientStatus } from "@/types/accountant";

interface ClientCardProps {
  client: AccountantClient;
  onClick?: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  const initials = client.client_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card
      className={onClick ? "cursor-pointer hover:border-border/80 hover:shadow-sm transition-all" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#E8930C]/10 border border-[#E8930C]/30 flex items-center justify-center text-sm font-semibold text-[#E8930C] shrink-0">
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-foreground truncate">{client.client_name}</h3>
              <ClientStatusBadge status={client.status as ClientStatus} />
            </div>

            <div className="mt-1.5 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{client.client_email}</span>
              </div>
              {client.client_business_name && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{client.client_business_name}</span>
                </div>
              )}
              {client.client_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{client.client_phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
