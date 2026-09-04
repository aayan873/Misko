"use client";

/**
 * Downscales an image file client-side before it's sent to the server — a raw
 * phone-camera photo (often 3-5MB) can exceed typical serverless request-body
 * limits and is unnecessarily large for reading handwritten text anyway.
 * Returns base64 (no data: URL prefix) and the mime type it was encoded as.
 */
export function resizeImageToBase64(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve({ base64, mimeType });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    img.src = objectUrl;
  });
}
