"use server";

import { recognize } from "node-tesseract-ocr";
import sharp from "sharp";
import { requireUser } from "@/lib/auth-guards";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage";

// Tesseract runs locally via the system `tesseract` binary (no network, no API
// key). oem 1 = LSTM engine; psm 3 = automatic page segmentation, a good
// default for a full recipe page/screenshot. Requires `tesseract-ocr` +
// `tesseract-ocr-data-eng` installed (the Docker image installs them; for local
// dev: `sudo apt install tesseract-ocr`).
const TESSERACT_CONFIG = { lang: "eng", oem: 1, psm: 3 } as const;

/**
 * Run local OCR on an uploaded image and return the raw extracted text. The
 * caller drops this into the recipe form for the user to review and edit — it
 * is deliberately unstructured (no parsing into ingredients/steps yet).
 *
 * Expects a `FormData` with an `image` File field.
 */
export async function extractTextFromImage(
  formData: FormData,
): Promise<{ text: string }> {
  await requireUser();

  const file = formData.get("image");
  if (!(file instanceof File)) {
    throw new Error("No image file provided.");
  }
  if (file.size === 0) throw new Error("Image file is empty.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 5 MB limit.");
  }
  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}.`);
  }

  // Preprocess to maximise OCR accuracy: honour EXIF orientation, drop colour,
  // and normalise contrast. This is the single biggest lever on Tesseract
  // quality for photos of cookbook pages and screenshots.
  const processed = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .grayscale()
    .normalize()
    .png()
    .toBuffer();

  const text = await recognize(processed, TESSERACT_CONFIG);
  return { text: text.trim() };
}
