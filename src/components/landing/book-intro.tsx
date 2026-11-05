"use client";

import { useCallback, useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from "react";

/**
 * Full-screen opening animation for the landing page.
 *
 * Timeline (ms):
 *   0    – 1100  closed book rises in (scale .85 → 1, fade, lift), then holds so it can be seen
 *   1600 – 2500  cover swings open around the spine; book slides right so the spread is centred
 *   2500 – 4880  7 page leaves turn right → left, 280ms apart, 700ms each
 *   4900 – 6000  spread zooms ~7x into the right-hand page
 *   5300 – 6000  overlay fades out, revealing the landing page
 */
export const BOOK_INTRO_DURATION_MS = 6000;

const SEEN_KEY = "bookloop:intro-seen";
const DONE_EVENT = "bookloop:intro-done";
const LEAVES = 7;
const LEAF_START = 2500;
const LEAF_STAGGER = 280;

// Runs synchronously while the HTML is parsed, before first paint.
const BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=false;try{s=!!sessionStorage.getItem(${JSON.stringify(
  SEEN_KEY,
)})}catch(e){}var r=false;try{r=window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}if(s||r){d.dataset.intro="skip"}else{d.dataset.intro="playing";d.style.overflow="hidden";try{history.scrollRestoration="manual";window.scrollTo(0,0)}catch(e){}try{sessionStorage.setItem(${JSON.stringify(
  SEEN_KEY,
)},"1")}catch(e){}}}catch(e){}})();`;

const CSS = `
html[data-intro="skip"] .book-intro { display: none !important; }

.bi-overlay {
  position: fixed; inset: 0; z-index: 100; overflow: hidden;
  background-color: #faf8f4;
  background-image: radial-gradient(rgba(28,26,23,.13) 1px, transparent 1.2px);
  background-size: 22px 22px;
  animation: bi-fade 700ms cubic-bezier(.4,0,1,1) 5300ms both;
  will-change: opacity;
  contain: strict;
}
.bi-overlay.bi-skipping { animation: bi-skipfade 250ms ease-out both; }

.bi-stage {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}

.bi-zoom {
  --bi-w: min(46vw, 360px);
  position: relative;
  width: var(--bi-w);
  aspect-ratio: 3 / 4;
  transform-origin: 100% 50%;
  animation: bi-zoom 1100ms cubic-bezier(.6,0,.3,1) 4900ms both;
  will-change: transform;
}
.bi-shift {
  position: absolute; inset: 0;
  animation: bi-shift 900ms cubic-bezier(.45,.05,.3,1) 1600ms both;
  will-change: transform;
}
.bi-rise {
  position: absolute; inset: 0;
  animation: bi-rise 1100ms cubic-bezier(.2,.8,.2,1) 0ms both;
  will-change: transform, opacity;
}
.bi-shadow {
  position: absolute; left: 4%; right: 4%; bottom: -7%; height: 9%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(28,26,23,.28), rgba(28,26,23,0));
  transform-origin: 50% 50%;
  animation: bi-shadow 900ms cubic-bezier(.45,.05,.3,1) 1600ms both;
  will-change: transform;
}

.bi-book {
  position: absolute; inset: 0;
  perspective: 2200px;
  perspective-origin: 0% 45%;
  transform-style: preserve-3d;
}

/* back cover peeking out behind the page block */
.bi-back {
  position: absolute; inset: 0;
  border-radius: 3px 8px 8px 3px;
  background: #24584a;
  transform: translateZ(-1px);
  box-shadow: 0 18px 40px -18px rgba(28,26,23,.45);
}

/* right-hand page block with page-edge stripes */
.bi-block {
  position: absolute; top: 2.5%; bottom: 2.5%; left: 0; right: 2.5%;
  border-radius: 0 4px 4px 0;
  background:
    repeating-linear-gradient(90deg, transparent 0 2px, rgba(120,100,70,.18) 2px 3px) right / 6px 100% no-repeat,
    linear-gradient(90deg, #ede6d8 0%, #fbf8f1 9%, #fdfbf6 100%);
  overflow: hidden;
}

.bi-leaf, .bi-cover {
  position: absolute;
  transform-origin: 0% 50%;
  transform-style: preserve-3d;
  will-change: transform;
  animation: bi-flip var(--bi-dur) cubic-bezier(.45,.05,.35,1) var(--bi-delay) both;
}
.bi-leaf { top: 2.5%; bottom: 2.5%; left: 0; right: 3.2%; }
.bi-cover { inset: 0; }

.bi-face {
  position: absolute; inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
}
.bi-face-back { transform: rotateY(180deg); }

.bi-paper {
  background: linear-gradient(90deg, #efe8da 0%, #fcf9f2 10%, #fdfbf6 100%);
  border-radius: 0 4px 4px 0;
}
.bi-paper.bi-face-back {
  background: linear-gradient(270deg, #efe8da 0%, #fcf9f2 10%, #fdfbf6 100%);
  border-radius: 4px 0 0 4px;
}
/* shading toward the spine while turning */
.bi-face::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  opacity: 0;
  animation: bi-shade var(--bi-dur) ease-in-out var(--bi-delay) both;
  will-change: opacity;
}
.bi-paper::after { background: linear-gradient(90deg, rgba(40,30,15,.38), rgba(40,30,15,.06) 55%, rgba(255,255,255,.08)); }
.bi-paper.bi-face-back::after { background: linear-gradient(270deg, rgba(40,30,15,.38), rgba(40,30,15,.06) 55%, rgba(255,255,255,.08)); }

/* faux text */
.bi-text {
  position: absolute; top: 11%; bottom: 12%; left: 14%; right: 12%;
  display: flex; flex-direction: column; gap: 6.2%;
}
.bi-face-back .bi-text { left: 12%; right: 14%; }
.bi-line { height: 3px; border-radius: 2px; background: rgba(28,26,23,.14); }
.bi-line.bi-h { height: 6px; width: 55%; background: rgba(47,111,94,.35); margin-bottom: 2%; }
.bi-num {
  position: absolute; bottom: 5%; left: 50%; transform: translateX(-50%);
  font-size: 9px; color: rgba(28,26,23,.35); font-family: Georgia, serif;
}

/* cover */
.bi-cover-front {
  border-radius: 3px 8px 8px 3px;
  background:
    radial-gradient(120% 90% at 30% 15%, rgba(255,255,255,.14), transparent 55%),
    radial-gradient(90% 70% at 85% 95%, rgba(0,0,0,.22), transparent 60%),
    repeating-radial-gradient(circle at 40% 40%, rgba(255,255,255,.018) 0 1px, transparent 1px 3px),
    linear-gradient(135deg, #357a67 0%, #2f6f5e 45%, #275d4f 100%);
  color: #e9c46a;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.15);
}
.bi-spine {
  position: absolute; top: 0; bottom: 0; left: 0; width: 9%;
  background: linear-gradient(90deg, rgba(0,0,0,.32), rgba(0,0,0,.08) 60%, rgba(255,255,255,.12) 85%, rgba(0,0,0,.18));
}
.bi-frame {
  position: absolute; top: 6%; bottom: 6%; left: 15%; right: 7%;
  border: 1px solid rgba(233,196,106,.6);
  border-radius: 3px;
  box-shadow: inset 0 0 0 3px rgba(47,111,94,1), inset 0 0 0 4px rgba(233,196,106,.3);
}
.bi-title {
  position: relative; margin-left: 8%;
  font-size: clamp(22px, 6.4vw, 46px); line-height: 1;
  color: #e9c46a;
  text-shadow: 0 1px 0 rgba(0,0,0,.35), 0 -1px 0 rgba(255,236,180,.25);
}
.bi-rule { position: relative; margin: 6% 0 0 8%; width: 22%; height: 1px; background: rgba(233,196,106,.7); }
.bi-tag {
  position: relative; margin: 6% 0 0 8%; padding: 0 22%;
  font-size: clamp(8px, 2.1vw, 13px); line-height: 1.35; font-style: italic;
  color: rgba(233,196,106,.85);
}
.bi-cover-back { border-radius: 8px 3px 3px 8px; background: #2a6555; }
.bi-cover-back > .bi-endpaper {
  position: absolute; top: 2.5%; bottom: 2.5%; left: 3.2%; right: 0;
  border-radius: 4px 0 0 4px;
  background: linear-gradient(270deg, #e7dfcf 0%, #f6f1e6 12%, #f8f4ea 100%);
}
.bi-cover-back::after { background: linear-gradient(270deg, rgba(0,0,0,.35), rgba(0,0,0,.05) 60%, transparent); }

.bi-skip {
  position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom));
  padding: 8px 12px; border-radius: 999px;
  font-size: 13px; font-weight: 500; color: #4a463f;
  background: rgba(250,248,244,.75);
  border: 1px solid rgba(28,26,23,.12);
  cursor: pointer;
  transition: color .15s, border-color .15s, background-color .15s;
}
.bi-skip:hover { color: #2f6f5e; border-color: rgba(47,111,94,.4); }
.bi-skip:focus-visible { outline: 2px solid #2f6f5e; outline-offset: 2px; }

.bi-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@keyframes bi-rise {
  from { opacity: 0; transform: translateY(7vh) scale(.85); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bi-shift {
  from { transform: translateX(0); }
  to   { transform: translateX(calc(var(--bi-w) / 2)); }
}
@keyframes bi-shadow {
  from { transform: translateX(0) scaleX(1); }
  to   { transform: translateX(-50%) scaleX(2.05); }
}
@keyframes bi-flip {
  from { transform: rotateY(0deg) translateZ(var(--bi-z, 0px)); }
  to   { transform: rotateY(-180deg) translateZ(var(--bi-z, 0px)); }
}
@keyframes bi-shade {
  0%   { opacity: 0; }
  45%  { opacity: 1; }
  55%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes bi-zoom {
  from { transform: translateX(0) scale(1); }
  to   { transform: translateX(calc(var(--bi-w) * -0.5)) scale(7); }
}
@keyframes bi-fade { from { opacity: 1; } to { opacity: 0; } }
@keyframes bi-skipfade { to { opacity: 0; } }
`;

function TextLines({ heading, seed }: { heading?: boolean; seed: number }) {
  const widths = [96, 88, 100, 92, 70, 98, 90, 100, 84, 60, 95, 89];
  return (
    <div className="bi-text">
      {heading && <div className="bi-line bi-h" />}
      {widths.slice(0, heading ? 9 : 11).map((w, i) => (
        <div key={i} className="bi-line" style={{ width: `${widths[(i + seed) % widths.length] ?? w}%` }} />
      ))}
    </div>
  );
}

export function BookIntro() {
  const [mounted, setMounted] = useState(true);
  const [skipping, setSkipping] = useState(false);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const prevOverflowRef = useRef<string>("");
  // Decision + animation start time survive React StrictMode's effect re-run.
  const decisionRef = useRef<{ play: boolean; start: number } | null>(null);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    const root = document.documentElement;
    root.style.overflow = prevOverflowRef.current;
    delete root.dataset.intro;
    setMounted(false);
    window.dispatchEvent(new Event(DONE_EVENT));
  }, []);

  const skip = useCallback(() => {
    if (finishedRef.current) return;
    setSkipping(true);
    // Backup in case animationend never fires.
    timersRef.current.push(window.setTimeout(finish, 400));
  }, [finish]);

  useEffect(() => {
    const root = document.documentElement;

    if (!decisionRef.current) {
      const state = root.dataset.intro;
      if (state === "playing" || state === "skip") {
        // Decided by the inline boot script; CSS animations started at first paint.
        // The boot script already locked scrolling when playing.
        prevOverflowRef.current =
          state === "playing" && root.style.overflow === "hidden" ? "" : root.style.overflow;
        decisionRef.current = { play: state === "playing", start: 0 };
      } else {
        // Client-side navigation: the inline script does not run, so decide here.
        let seen = false;
        try {
          seen = !!window.sessionStorage.getItem(SEEN_KEY);
        } catch {}
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const play = !seen && !reduced;
        if (play) {
          try {
            window.sessionStorage.setItem(SEEN_KEY, "1");
          } catch {}
        }
        prevOverflowRef.current = root.style.overflow;
        decisionRef.current = { play, start: performance.now() };
      }
    }

    if (!decisionRef.current.play) {
      finish();
      return;
    }

    root.dataset.intro = "playing";
    root.style.overflow = "hidden";

    // The book always opens onto the top of the page. Browsers restore the old
    // scroll position on reload (sometimes after load), so reset it both now and then.
    const toTop = () => window.scrollTo(0, 0);
    toTop();
    window.addEventListener("load", toTop, { once: true });
    timersRef.current.push(window.setTimeout(toTop, 1500));

    // Backup finish if animationend is missed (e.g. background tab).
    const elapsed = performance.now() - decisionRef.current.start;
    const remaining = Math.max(BOOK_INTRO_DURATION_MS - elapsed, 0) + 600;
    timersRef.current.push(window.setTimeout(finish, remaining));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("load", toTop);
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (!finishedRef.current) {
        root.style.overflow = prevOverflowRef.current;
        delete root.dataset.intro;
      }
    };
  }, [finish, skip]);

  const onAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName === "bi-fade" || e.animationName === "bi-skipfade") finish();
  };

  if (!mounted) return null;

  return (
    <div
      className={`book-intro bi-overlay${skipping ? " bi-skipping" : ""}`}
      onAnimationEnd={onAnimationEnd}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} suppressHydrationWarning />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <p className="bi-sr" role="status" aria-live="polite">
        Opening BookLoop
      </p>

      <div className="bi-stage" aria-hidden="true">
        <div className="bi-zoom">
          <div className="bi-shift">
            <div className="bi-rise">
              <div className="bi-shadow" />
              <div className="bi-book">
                <div className="bi-back" />
                <div className="bi-block">
                  <TextLines heading seed={3} />
                  <span className="bi-num">1</span>
                </div>

                {Array.from({ length: LEAVES }, (_, i) => {
                  const style = {
                    "--bi-z": `${(LEAVES - i) * 0.4}px`,
                    "--bi-dur": "700ms",
                    "--bi-delay": `${LEAF_START + i * LEAF_STAGGER}ms`,
                  } as CSSProperties;
                  return (
                    <div key={i} className="bi-leaf" style={style}>
                      <div className="bi-face bi-paper">
                        <TextLines seed={i * 2} heading={i % 3 === 0} />
                      </div>
                      <div className="bi-face bi-paper bi-face-back">
                        <TextLines seed={i * 2 + 1} />
                      </div>
                    </div>
                  );
                })}

                <div
                  className="bi-cover"
                  style={
                    {
                      "--bi-z": `${(LEAVES + 2) * 0.4}px`,
                      "--bi-dur": "900ms",
                      "--bi-delay": "1600ms",
                    } as CSSProperties
                  }
                >
                  <div className="bi-face bi-cover-front">
                    <div className="bi-spine" />
                    <div className="bi-frame" />
                    <span className="bi-title heading">BookLoop</span>
                    <span className="bi-rule" />
                    <span className="bi-tag font-serif">Every book deserves another reader</span>
                  </div>
                  <div className="bi-face bi-face-back bi-cover-back">
                    <div className="bi-endpaper" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="bi-skip" onClick={skip}>
        Skip intro
      </button>
    </div>
  );
}
