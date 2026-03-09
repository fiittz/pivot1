import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileSignature,
  Send,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  FileCheck,
  Eye,
} from "lucide-react";
import {
  useSignaturePages,
  useGenerateSignaturePage,
  useSendSignaturePage,
  type CROSignaturePage,
} from "@/hooks/accountant/useCROSignaturePages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CROSignaturePageSectionProps {
  croCompanyId: string;
  companyName: string;
  companyNumber: string;
}

const STATUS_CONFIG: Record<
  CROSignaturePage["status"],
  { label: string; className: string; icon: React.ElementType }
> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock },
  sent: { label: "Sent to Client", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Send },
  signed: { label: "Signed", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  filed: { label: "Filed with CRO", className: "bg-blue-100 text-blue-700 border-blue-200", icon: FileCheck },
};

export function CROSignaturePageSection({
  croCompanyId,
  companyName,
  companyNumber,
}: CROSignaturePageSectionProps) {
  const { data: pages, isLoading } = useSignaturePages(croCompanyId);
  const generateMutation = useGenerateSignaturePage();
  const sendMutation = useSendSignaturePage();
  const [sendEmail, setSendEmail] = useState("");
  const [sendingPageId, setSendingPageId] = useState<string | null>(null);

  const handleGenerate = () => {
    const currentYear = new Date().getFullYear();
    const financialYearEnd = `${currentYear - 1}-12-31`;

    generateMutation.mutate(
      {
        croCompanyId,
        companyName,
        companyNumber,
        financialYearEnd,
        directorName: "___________________",
        secretaryName: "___________________",
        accountingFramework: "frs102_1a",
        auditExempt: true,
      },
      {
        onSuccess: () => toast.success("Signature page generated"),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      },
    );
  };

  const handleSend = (pageId: string) => {
    if (!sendEmail.trim()) {
      toast.error("Enter a client email address");
      return;
    }
    sendMutation.mutate(
      { signaturePageId: pageId, croCompanyId, email: sendEmail.trim() },
      {
        onSuccess: () => {
          toast.success(`Signature page sent to ${sendEmail.trim()}`);
          setSendingPageId(null);
          setSendEmail("");
        },
        onError: (err) => toast.error(`Send failed: ${err.message}`),
      },
    );
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from("cro-documents")
      .download(storagePath);
    if (error || !data) {
      toast.error("Failed to download file");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Signature Pages
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FileSignature className="h-4 w-4 mr-1" />
          )}
          Generate New
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !pages || pages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No signature pages generated yet. Click "Generate New" to create a
            Section 324(2) certificate for the client to sign.
          </p>
        ) : (
          <div className="space-y-3">
            {pages.map((page) => {
              const config = STATUS_CONFIG[page.status];
              const StatusIcon = config.icon;
              const fye = new Date(page.financial_year_end + "T00:00:00").toLocaleDateString(
                "en-IE",
                { day: "numeric", month: "short", year: "numeric" },
              );

              return (
                <div
                  key={page.id}
                  className="border rounded-md px-4 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">FYE {fye}</span>
                    <Badge className={`gap-1 ${config.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {/* Download unsigned */}
                    {page.pdf_storage_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() =>
                          handleDownload(
                            page.pdf_storage_path!,
                            `signature-page-${page.financial_year_end}.pdf`,
                          )
                        }
                      >
                        <Download className="h-3 w-3" />
                        Download PDF
                      </Button>
                    )}

                    {/* Download signed */}
                    {page.signed_pdf_storage_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() =>
                          handleDownload(
                            page.signed_pdf_storage_path!,
                            `signed-${page.financial_year_end}.pdf`,
                          )
                        }
                      >
                        <Eye className="h-3 w-3" />
                        View Signed
                      </Button>
                    )}

                    {/* Send to client (only if draft) */}
                    {page.status === "draft" && sendingPageId !== page.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setSendingPageId(page.id)}
                      >
                        <Send className="h-3 w-3" />
                        Send to Client
                      </Button>
                    )}
                  </div>

                  {/* Email send row */}
                  {sendingPageId === page.id && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="client@email.com"
                        value={sendEmail}
                        onChange={(e) => setSendEmail(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSend(page.id);
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => handleSend(page.id)}
                        disabled={sendMutation.isPending}
                      >
                        {sendMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Send"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => setSendingPageId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Sent info */}
                  {page.sent_at && (
                    <p className="text-xs text-muted-foreground">
                      Sent to {page.sent_to_email} on{" "}
                      {new Date(page.sent_at).toLocaleDateString("en-IE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
