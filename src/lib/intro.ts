export const INTRO_DONE_EVENT = "bookloop:intro-done";

/** True while the book-opening intro overlay is playing. Safe on the server (returns false). */
export function isIntroPlaying(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.intro === "playing";
}

/**
 * Runs `cb` once the intro is over: on the next microtask if no intro is
 * playing, otherwise on the `bookloop:intro-done` event. Returns an unsubscribe.
 */
export function onIntroDone(cb: () => void): () => void {
  let cancelled = false;
  if (!isIntroPlaying()) {
    queueMicrotask(() => {
      if (!cancelled) cb();
    });
    return () => {
      cancelled = true;
    };
  }
  const handler = () => {
    window.removeEventListener(INTRO_DONE_EVENT, handler);
    if (!cancelled) cb();
  };
  window.addEventListener(INTRO_DONE_EVENT, handler);
  return () => {
    cancelled = true;
    window.removeEventListener(INTRO_DONE_EVENT, handler);
  };
}
