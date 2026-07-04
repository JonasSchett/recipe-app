import { readFile } from "fs/promises";
import path from "path";
import { ALLOWED_IMAGE_TYPES, resolveStoredImagePath } from "@/lib/storage";

// Next only serves `public/` assets that existed at build time, so images
// uploaded at runtime 404 under the production standalone server. This route
// serves them from disk instead; in dev, files present in `public/` are served
// statically before this route is reached.

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_IMAGE_TYPES).map(([mime, ext]) => [ext, mime]),
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const filePath = resolveStoredImagePath(`/uploads/recipes/${filename}`);
  const mime = MIME_BY_EXT[path.extname(filename).slice(1).toLowerCase()];
  if (!filePath || !mime) {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    throw err;
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      // Filenames are random UUIDs, so contents never change for a given URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
