import { useState } from "react";
import { Camera, Loader2, Check, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { useReceiptScanner } from "@/hooks/useReceiptScanner";

export default function QuickReceiptCapture() {
  const { capturePhoto, isCapturing } = useNativeCamera();
  const { state, receiptData, processImage, uploadReceipt, reset } = useReceiptScanner();
  const [captures, setCaptures] = useState<{ id: string; vendor: string; amount: number }[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const handleCapture = async () => {
    try {
      const imageData = await capturePhoto();
      setCurrentImage(imageData);
      // Convert base64 to blob for processing
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], "receipt.jpg", { type: "image/jpeg" });
      // Use the scanner's upload flow
      const { uploadFile } = useReceiptScanner.getState?.() || {};
      if (uploadFile) uploadFile(file);
    } catch (err) {
      console.error("Capture failed:", err);
    }
  };

  const isProcessing = state === "processing" || state === "uploading" || isCapturing;

  return (
    <div className="flex flex-col items-center px-6 py-8 gap-6">
      {/* Capture button */}
      <button
        onClick={handleCapture}
        disabled={isProcessing}
        className="w-28 h-28 rounded-full bg-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
      >
        {isProcessing ? (
          <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
        ) : (
          <Camera className="w-10 h-10 text-primary-foreground" />
        )}
      </button>
      <p className="text-sm text-muted-foreground">
        {isProcessing ? "Processing receipt..." : "Tap to capture receipt"}
      </p>

      {/* Result card */}
      {receiptData && state === "preview" && (
        <div className="w-full max-w-sm bg-card rounded-xl border p-4 space-y-3 animate-fade-in">
          <div className="flex items-center gap-3">
            {currentImage && (
              <img src={currentImage} alt="Receipt" className="w-16 h-20 object-cover rounded-lg" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{receiptData.supplier_name || "Unknown vendor"}</p>
              <p className="text-2xl font-bold">€{receiptData.total_amount?.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{receiptData.date || "No date"}</p>
              {receiptData.suggested_category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {receiptData.suggested_category}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => {
              setCaptures((prev) => [...prev, {
                id: Date.now().toString(),
                vendor: receiptData.supplier_name || "Unknown",
                amount: receiptData.total_amount || 0,
              }]);
              reset();
              setCurrentImage(null);
            }}>
              <Check className="w-4 h-4" /> Save
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          </div>
        </div>
      )}

      {/* Recent captures */}
      {captures.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent</p>
          {captures.slice(-5).reverse().map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg text-sm">
              <span>{c.vendor}</span>
              <span className="font-medium">€{c.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Capture another */}
      {captures.length > 0 && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCapture}>
          <Plus className="w-4 h-4" /> Capture Another
        </Button>
      )}
    </div>
  );
}
