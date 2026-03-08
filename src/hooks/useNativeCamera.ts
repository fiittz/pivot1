import { useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";

export function useNativeCamera() {
  const [isCapturing, setIsCapturing] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const capturePhoto = useCallback(async (): Promise<string> => {
    setIsCapturing(true);
    try {
      if (isNative) {
        const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          quality: 80,
          width: 1200,
        });
        if (!photo.base64String) throw new Error("No image captured");
        return `data:image/${photo.format || "jpeg"};base64,${photo.base64String}`;
      }

      // Web fallback: file picker
      return new Promise<string>((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return reject(new Error("No file selected"));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        };
        input.click();
      });
    } finally {
      setIsCapturing(false);
    }
  }, [isNative]);

  return { capturePhoto, isNative, isCapturing };
}
