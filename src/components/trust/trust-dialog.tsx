"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Native <dialog>, rendered into <body> so it works even when the trigger sits
 * inside a link or another form. Mount it only while open.
 */
export function TrustDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    // No cleanup: unmounting removes the dialog (and its modal state) from the page.
    if (d && !d.open) d.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // Keep clicks from reaching a surrounding link's handler; close on backdrop click.
        e.stopPropagation();
        if (e.target === ref.current) ref.current?.close();
      }}
      className="animate-pop-in m-auto w-[min(28rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-fg shadow-xl backdrop:bg-black/35"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="heading text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="btn-ghost -mr-2 -mt-1 h-9 w-9 !p-0"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
