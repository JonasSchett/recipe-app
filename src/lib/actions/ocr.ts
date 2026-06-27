"use server";

import { readFile } from "fs/promises";
import { recognize } from "node-tesseract-ocr";
import sharp from "sharp";
import { requireUser } from "@/lib/auth-guards";
import { resolveStoredImagePath } from "@/lib/storage";

// Tesseract runs locally via the system `tesseract` binary (no network, no API
// key). oem 1 = LSTM engine; psm 3 = automatic page segmentation, a good
// default for a full recipe page/screenshot. Requires `tesseract-ocr` +
// `tesseract-ocr-data-eng` installed (the Docker image installs them; for local
// dev: `sudo apt install tesseract-ocr`).
const TESSERACT_CONFIG = { lang: "eng", oem: 1, psm: 3 } as const;

/**
 * Run local OCR on one of a recipe's uploaded images (by its public
 * `/uploads/recipes/<file>` path) and return the raw extracted text. The caller
 * drops this into the recipe form for the user to review and edit — it is
 * deliberately unstructured (no parsing into ingredients/steps yet).
 */
export async function extractTextFromRecipeImage(
  publicPath: string,
): Promise<{ text: string }> {
  await requireUser();

  const filePath = resolveStoredImagePath(publicPath);
  if (!filePath) throw new Error("Invalid image path.");

  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    throw new Error("Image file not found.");
  }

  // Preprocess to maximise OCR accuracy: honour EXIF orientation, drop colour,
  // and normalise contrast. This is the single biggest lever on Tesseract
  // quality for photos of cookbook pages and screenshots.
  const processed = await sharp(bytes)
    .rotate()
    .grayscale()
    .normalize()
    .png()
    .toBuffer();

  const text = await recognize(processed, TESSERACT_CONFIG);
  return { text: text.trim() };
}
