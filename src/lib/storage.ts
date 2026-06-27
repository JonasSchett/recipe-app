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
 * Resolve a public `/uploads/recipes/<file>` path to its absolute path on disk,
 * or `null` if the path is malformed or escapes the uploads directory (guards
 * against traversal like `/uploads/recipes/../../secret`). Returns a path
 * regardless of whether the file exists.
 */
export function resolveStoredImagePath(
  publicPath: string | null | undefined,
): string | null {
  if (!publicPath || !publicPath.startsWith(PUBLIC_PREFIX)) return null;
  const filename = path.basename(publicPath);
  if (filename !== publicPath.slice(PUBLIC_PREFIX.length)) return null;
  return path.join(uploadDir(), filename);
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
  const filePath = resolveStoredImagePath(publicPath);
  if (!filePath) return;

  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
