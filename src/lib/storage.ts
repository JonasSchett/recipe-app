import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

// Recipe images live in the public dir so Next serves them directly, and the
// `uploads` folder is a persistent Docker volume (see docker-compose.yml).
const UPLOAD_SUBDIR = path.join("public", "uploads", "recipes");
const PUBLIC_PREFIX = "/uploads/recipes/";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Map of accepted MIME types to the extension used on disk.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function uploadDir(): string {
  return path.join(process.cwd(), UPLOAD_SUBDIR);
}

/**
 * Validate and persist an uploaded image to local storage, returning the
 * public path (e.g. `/uploads/recipes/<uuid>.jpg`) to store on the recipe.
 */
export async function saveRecipeImage(file: File): Promise<string> {
  if (file.size === 0) throw new Error("Image file is empty.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 5 MB limit.");
  }
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}.`);
  }

  const filename = `${randomUUID()}.${ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  return `${PUBLIC_PREFIX}${filename}`;
}

/**
 * Best-effort removal of a previously stored recipe image. No-ops for empty
 * paths, paths outside the uploads dir, or files that are already gone.
 */
export async function deleteRecipeImage(
  publicPath: string | null | undefined,
): Promise<void> {
  if (!publicPath || !publicPath.startsWith(PUBLIC_PREFIX)) return;

  const filename = path.basename(publicPath);
  // Reject anything that isn't a bare filename inside the uploads dir
  // (guards against path traversal like `/uploads/recipes/../../secret`).
  if (filename !== publicPath.slice(PUBLIC_PREFIX.length)) return;

  try {
    await unlink(path.join(uploadDir(), filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
