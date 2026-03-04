import { useMyDocumentRequests } from "@/hooks/accountant/useDocumentRequests";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Banner shown on the business owner's dashboard when their accountant
 * has pending document requests. Read-only — the client sees what's needed
 * but file upload is handled via the existing receipt scanner.
 */
export function DocumentRequestsBanner() {
  const { data: requests = [] } = useMyDocumentRequests();

  if (requests.length === 0) return null;

  return (
    <Card className="border-[#E8930C]/30 bg-[#E8930C]/5">
      <CardContent className="p-4">
        <div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Your accountant needs {requests.length} document{requests.length !== 1 ? "s" : ""}
            </h3>
            <div className="mt-2 space-y-1.5">
              {requests.slice(0, 3).map((req) => (
                <div key={req.id} className="flex items-center gap-2 text-sm">
                  <span className="text-foreground">{req.title}</span>
                  {req.due_date && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {req.due_date}
                    </span>
                  )}
                </div>
              ))}
              {requests.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  + {requests.length - 3} more request{requests.length - 3 !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            {requests[0]?.practice_name && (
              <p className="text-xs text-muted-foreground mt-2">
                From: {requests[0].practice_name}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
