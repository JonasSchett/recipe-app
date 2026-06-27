"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; path: string };

/**
 * Recipe image viewer: a large hero showing the active image (full size, not
 * cropped) plus a clickable thumbnail strip. Tapping a thumbnail swaps it into
 * the hero. Defaults to the first image (the recipe's hero).
 */
export function RecipeGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? null);
  const active = images.find((img) => img.id === activeId) ?? images[0] ?? null;

  if (!active) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted text-muted-foreground">
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files */}
        <img
          src={active.path}
          alt={title}
          className="h-full w-full object-contain"
        />
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, i) => {
            const isActive = image.id === active.id;
            return (
              <button
                type="button"
                key={image.id}
                onClick={() => setActiveId(image.id)}
                aria-label={`Show image ${i + 1}`}
                aria-pressed={isActive}
                className={cn(
                  "h-20 w-20 overflow-hidden rounded-md border transition",
                  isActive
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files */}
                <img
                  src={image.path}
                  alt={`${title} — image ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
