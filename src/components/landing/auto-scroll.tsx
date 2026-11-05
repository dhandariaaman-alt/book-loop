"use client";

import { useEffect, useRef, useState } from "react";
import { onIntroDone } from "@/lib/intro";

const SPEED_PX_PER_SEC = 110; // brisk tour pace
const START_DELAY_MS = 2500; // let the hero animate in first
const AFTER_INTRO_DELAY_MS = 1800; // start delay once the book intro has finished
const RESUME_AFTER_MS = 6000; // idle time before resuming after the visitor interacts
const PAUSE_AT_BOTTOM_MS = 3000;

/**
 * Slowly scrolls the page like a guided tour. Any wheel, touch, key or click
 * pauses it; it resumes after a short idle period. The button turns it off.
 */
export function AutoScroll() {
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const enabledRef = useRef(true);
  const controls = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEnabled(false);
      return;
    }

    let raf = 0;
    let last = 0;
    let pos = window.scrollY; // fractional position, since scrollTo rounds
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    let active = false;

    const stop = () => {
      active = false;
      cancelAnimationFrame(raf);
      setRunning(false);
    };

    const step = (t: number) => {
      if (!active) return;
      const dt = last ? Math.min(t - last, 100) : 16;
      last = t;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      pos += (SPEED_PX_PER_SEC * dt) / 1000;
      if (pos >= max) {
        window.scrollTo({ top: max });
        stop();
        // At the end: wait, glide back to the top, then start again.
        resumeTimer = setTimeout(() => {
          if (!enabledRef.current) return;
          window.scrollTo({ top: 0, behavior: "smooth" });
          resumeTimer = setTimeout(start, 2500);
        }, PAUSE_AT_BOTTOM_MS);
        return;
      }
      window.scrollTo({ top: pos });
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (!enabledRef.current || active) return;
      // Don't scroll behind an open popup (e.g. the book details dialog).
      if (document.querySelector("dialog[open]")) {
        resumeTimer = setTimeout(start, RESUME_AFTER_MS);
        return;
      }
      pos = window.scrollY;
      last = 0;
      active = true;
      setRunning(true);
      raf = requestAnimationFrame(step);
    };

    const onUserInput = () => {
      stop();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(start, RESUME_AFTER_MS);
    };

    // Input during the intro must not arm the idle-resume timer.
    const onInput = () => {
      if (introPlaying) return;
      onUserInput();
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    // Wait for the book intro (if any) before the start countdown begins.
    let introPlaying = document.documentElement.dataset.intro === "playing";
    const offIntro = onIntroDone(() => {
      introPlaying = false;
      resumeTimer = setTimeout(start, introWait ? AFTER_INTRO_DELAY_MS : START_DELAY_MS);
    });
    const introWait = introPlaying;

    // Expose start/stop to the toggle button.
    controls.current = { start, stop: () => { stop(); clearTimeout(resumeTimer); } };

    return () => {
      stop();
      offIntro();
      clearTimeout(resumeTimer);
      events.forEach((e) => window.removeEventListener(e, onInput));
    };
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;
    if (next) setTimeout(() => controls.current?.start(), 300);
    else controls.current?.stop();
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={enabled}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" className="size-4 text-brand" fill="currentColor" aria-hidden>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4 text-brand" fill="currentColor" aria-hidden>
          <path d="M7 5v14l12-7Z" />
        </svg>
      )}
      <span>{enabled ? "Pause tour" : "Auto-scroll"}</span>
      {enabled && running && <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden />}
    </button>
  );
}
