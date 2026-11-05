"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

type Img = { id: string; url: string; alt: string | null };

export function Gallery({ images, title, fallback }: { images: Img[]; title: string; fallback: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="min-w-0">
      <div
        className="relative mx-auto aspect-[2/3] w-full max-w-sm overflow-hidden rounded-l-md rounded-r-2xl shadow-[inset_6px_0_0_rgba(0,0,0,0.08),4px_6px_18px_rgba(0,0,0,0.14)]"
        style={{ containerType: "inline-size" }}
      >
        {current ? (
          <img src={current.url} alt={current.alt ?? `Cover of ${title}`} className="h-full w-full object-cover" />
        ) : (
          fallback
        )}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/15 to-transparent" aria-hidden="true" />
      </div>

      {images.length > 1 && (
        <ul className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-2" aria-label="Photos">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={i === active}
                className={`block h-20 w-14 overflow-hidden rounded-md border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
