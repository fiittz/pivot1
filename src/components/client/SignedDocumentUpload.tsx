import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Upload, Camera, FileCheck, Clock, Send, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignaturePages, useUploadSignedPage, type CROSignaturePage } from "@/hooks/accountant/useCROSignaturePages";
import { useQuery } from "@tanstack/react-query";

interface SignedDocumentUploadProps {
  userId: string;
}

const STATUS_CONFIG: Record<
  CROSignaturePage["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  sent: { label: "Awaiting Signature", variant: "destructive", icon: Send },
  signed: { label: "Signed", variant: "default", icon: CheckCircle2 },
  filed: { label: "Filed with CRO", variant: "outline", icon: FileCheck },
};

export default function SignedDocumentUpload({ userId }: SignedDocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  // Look up the CRO company for this user
  const { data: croCompany } = useQuery({
    queryKey: ["cro-company", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cro_companies")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
    enabled: !!userId,
  });

  const { data: pages, isLoading } = useSignaturePages(croCompany?.id);
  const uploadMutation = useUploadSignedPage();

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    pageId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !croCompany) return;

    await uploadMutation.mutateAsync({
      signaturePageId: pageId,
      croCompanyId: croCompany.id,
      file,
    });

    setActivePageId(null);
    // Reset the input
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from("cro-documents")
      .download(storagePath);

    if (error || !data) return;

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pages || pages.length === 0) {
    return null; // Nothing to show if no signature pages
  }

  return (
    <div className="space-y-4">
      {pages.map((page) => {
        const config = STATUS_CONFIG[page.status];
        const StatusIcon = config.icon;
        const isPending = page.status === "sent";
        const isUploading = uploadMutation.isPending && activePageId === page.id;

        return (
          <Card key={page.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">
                Signature Page &mdash; FYE{" "}
                {new Date(page.financial_year_end + "T00:00:00").toLocaleDateString("en-IE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </CardTitle>
              <Badge variant={config.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Download unsigned PDF */}
              {page.pdf_storage_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    handleDownload(
                      page.pdf_storage_path!,
                      `signature-page-${page.financial_year_end}.pdf`,
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download Unsigned PDF
                </Button>
              )}

              {/* Download signed copy if available */}
              {page.signed_pdf_storage_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    handleDownload(
                      page.signed_pdf_storage_path!,
                      `signed-page-${page.financial_year_end}.pdf`,
                    )
                  }
                >
                  <FileCheck className="h-4 w-4" />
                  Download Signed Copy
                </Button>
              )}

              {/* Upload actions — only show when awaiting signature */}
              {isPending && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, page.id)}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, page.id)}
                  />

                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={isUploading}
                    onClick={() => {
                      setActivePageId(page.id);
                      fileInputRef.current?.click();
                    }}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload Signed Copy
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    disabled={isUploading}
                    onClick={() => {
                      setActivePageId(page.id);
                      cameraInputRef.current?.click();
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                </div>
              )}

              {/* Upload error */}
              {uploadMutation.isError && activePageId === page.id && (
                <p className="text-sm text-destructive">
                  Upload failed: {(uploadMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
