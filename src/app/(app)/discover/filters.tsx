"use client";

import { useEffect, useRef } from "react";

/** Submits the surrounding filter form when a select or chip changes. The form still works without JS. */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "radio")) {
        form.requestSubmit();
      }
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);

  return <span ref={ref} hidden />;
}
