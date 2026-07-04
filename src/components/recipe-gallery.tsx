"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; path: string };

/**
 * Recipe image viewer: a large hero showing the active image (full size, not
 * cropped) plus a clickable thumbnail strip. Tapping a thumbnail swaps it into
 * the hero; tapping the hero opens the image in a fullscreen lightbox
 * (tap anywhere / Esc to close, arrows or ←/→ to move between images).
 */
export function RecipeGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? null);
  const [fullscreen, setFullscreen] = useState(false);
  const active = images.find((img) => img.id === activeId) ?? images[0] ?? null;

  const step = useCallback(
    (delta: number) => {
      setActiveId((current) => {
        const index = images.findIndex((img) => img.id === current);
        if (index === -1) return current;
        const next = (index + delta + images.length) % images.length;
        return images[next].id;
      });
    },
    [images],
  );

  // Lightbox: keyboard controls + keep the page behind from scrolling.
  useEffect(() => {
    if (!fullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen, step]);

  if (!active) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted text-muted-foreground">
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        aria-label="View image fullscreen"
        className="aspect-video w-full cursor-zoom-in overflow-hidden rounded-xl border bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files */}
        <img
          src={active.path}
          alt={title}
          className="h-full w-full object-contain"
        />
      </button>
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

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — fullscreen image`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
          onClick={() => setFullscreen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files */}
          <img
            src={active.path}
            alt={title}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            aria-label="Close fullscreen"
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            onClick={() => setFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
