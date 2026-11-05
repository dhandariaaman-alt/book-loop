"use client";

import { useEffect, useRef, useState } from "react";

const fmt = new Intl.NumberFormat("en-US");

/**
 * Counts a number up from 0 the first time it scrolls into view.
 * Server output (and reduced-motion users) get the final value, so there is
 * no layout shift and nothing to animate when motion is off.
 */
export function CountUp({ value, duration = 600 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    setDisplay(value);
    const el = ref.current;
    if (!el || !Number.isFinite(value) || value === 0) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
          setDisplay(Number((value * eased).toFixed(decimals)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {fmt.format(display)}
    </span>
  );
}
