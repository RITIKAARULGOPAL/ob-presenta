'use client';

import { useEffect, useState } from 'react';
import type { HotspotGalleryImage } from '@/types/slide';

/** A lightweight prev/next image viewer for a hotspot's gallery — deliberately
 *  not the full crop/rotate `ImageAdjustOverlay` editor, just a viewer. Closes
 *  on Escape, backdrop click, or the close button; arrow keys step through. */
export function Lightbox({
  images,
  startIndex = 0,
  keyPlanImage,
  onClose,
}: {
  images: HotspotGalleryImage[];
  startIndex?: number;
  keyPlanImage?: { url: string; arrowDeg?: number };
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const image = images[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
      >
        Close ✕
      </button>

      {keyPlanImage?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={keyPlanImage.url}
          alt=""
          onClick={(e) => e.stopPropagation()}
          style={keyPlanImage.arrowDeg != null ? { transform: `rotate(${keyPlanImage.arrowDeg}deg)` } : undefined}
          className="absolute bottom-4 left-4 h-20 w-20 rounded-md border-2 border-white/80 object-cover shadow-lg"
        />
      )}

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + images.length) % images.length);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-xl text-white hover:bg-white/20"
        >
          ‹
        </button>
      )}

      <div className="flex max-h-full max-w-3xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.caption ?? ''} className="max-h-[70vh] max-w-full rounded-md object-contain shadow-2xl" />
        {image.caption && <p className="text-center text-sm text-white/85">{image.caption}</p>}
        {images.length > 1 && (
          <p className="text-xs text-white/50">
            {index + 1} / {images.length}
          </p>
        )}
      </div>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % images.length);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-xl text-white hover:bg-white/20"
        >
          ›
        </button>
      )}
    </div>
  );
}
