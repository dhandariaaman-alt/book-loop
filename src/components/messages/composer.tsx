"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import type { MessageType } from "@prisma/client";
import { formatDuration, MAX_MESSAGE_CHARS, MAX_VOICE_SECONDS } from "./types";

export type Outgoing = {
  type: MessageType;
  body?: string;
  file?: File;
  durationSec?: number;
  /** Local object URL so photos and recordings show instantly. */
  previewUrl?: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_AUDIO = 3 * 1024 * 1024;

type Props = {
  onSend: (m: Outgoing) => Promise<boolean>;
  onError: (msg: string | null) => void;
};

export function Composer({ onSend, onError }: Props) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const cancelRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const hintId = useId();

  // Stop the microphone if the user leaves mid-recording.
  useEffect(
    () => () => {
      cancelRef.current = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recRef.current?.state === "recording") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }

  async function submit() {
    if (busy || recording) return;
    const body = text.trim();
    if (body.length > MAX_MESSAGE_CHARS) {
      onError(`Messages can be up to ${MAX_MESSAGE_CHARS} characters.`);
      return;
    }
    if (!body && !photo) return;

    const out: Outgoing = photo
      ? { type: "IMAGE", body: body || undefined, file: photo.file, previewUrl: photo.url }
      : { type: "TEXT", body };
    const keepText = text;
    const keepPhoto = photo;
    setText("");
    setPhoto(null);
    requestAnimationFrame(autosize);
    setBusy(true);
    const ok = await onSend(out);
    setBusy(false);
    if (!ok) {
      setText(keepText);
      setPhoto(keepPhoto);
    } else if (keepPhoto) {
      // The server copy has replaced the preview by now.
      window.setTimeout(() => URL.revokeObjectURL(keepPhoto.url), 30_000);
    }
    taRef.current?.focus();
  }

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) return onError("Send a JPG, PNG or WebP photo.");
    if (f.size > MAX_IMAGE) return onError("Photos must be 5 MB or smaller.");
    onError(null);
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ file: f, url: URL.createObjectURL(f) });
    taRef.current?.focus();
  }

  async function startRecording() {
    onError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Voice messages aren't supported in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Microphone access was blocked. Allow it in your browser settings to record.");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64_000 } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      onError("Your browser couldn't start recording.");
      return;
    }
    streamRef.current = stream;
    recRef.current = rec;
    chunksRef.current = [];
    cancelRef.current = false;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
      if (cancelRef.current) return;
      const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type });
      const seconds = Math.max(1, Math.min(MAX_VOICE_SECONDS, Math.round((Date.now() - startedRef.current) / 1000)));
      if (blob.size === 0) return onError("Nothing was recorded. Try again.");
      if (blob.size > MAX_AUDIO) return onError("That recording is too large. Keep it under 2 minutes.");
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice.${ext}`, { type });
      const url = URL.createObjectURL(blob);
      setBusy(true);
      void onSend({ type: "VOICE", file, durationSec: seconds, previewUrl: url }).finally(() => {
        setBusy(false);
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      });
    };

    startedRef.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedRef.current) / 1000);
      setElapsed(s);
      if (s >= MAX_VOICE_SECONDS && recRef.current?.state === "recording") recRef.current.stop();
    }, 250);
  }

  function stopRecording(cancel: boolean) {
    cancelRef.current = cancel;
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  const over = text.length > MAX_MESSAGE_CHARS;
  const canSend = !busy && !over && (text.trim().length > 0 || !!photo);

  if (recording) {
    return (
      <div className="card flex items-center gap-3 p-3" role="group" aria-label="Recording a voice message">
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
        </span>
        <p className="min-w-0 flex-1 text-sm" aria-live="off">
          Recording <span className="font-mono">{formatDuration(elapsed)}</span>
          <span className="text-muted"> / {formatDuration(MAX_VOICE_SECONDS)}</span>
        </p>
        <button type="button" className="btn-ghost px-3" onClick={() => stopRecording(true)}>
          Cancel
        </button>
        <button type="button" className="btn-primary px-3" onClick={() => stopRecording(false)}>
          <span className="h-3 w-3 rounded-sm bg-current" aria-hidden="true" />
          Stop and send
        </button>
      </div>
    );
  }

  return (
    <form
      className="card p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {photo && (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-surface-2 p-2">
          <img src={photo.url} alt="Photo to send" className="h-14 w-14 rounded-lg object-cover" />
          <p className="min-w-0 flex-1 truncate text-sm text-muted">{photo.file.name}</p>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => {
              URL.revokeObjectURL(photo.url);
              setPhoto(null);
            }}
          >
            Remove
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={pickPhoto} aria-hidden="true" />
        <button
          type="button"
          className="btn-ghost h-11 w-11 shrink-0 p-0"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach a photo"
          title="Attach a photo"
          disabled={busy}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
          </svg>
        </button>
        <label htmlFor={`${hintId}-ta`} className="sr-only">
          Message
        </label>
        <textarea
          id={`${hintId}-ta`}
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={photo ? "Add a caption (optional)" : "Write a message"}
          aria-describedby={hintId}
          aria-invalid={over || undefined}
          className="input max-h-42 min-h-11 flex-1 resize-none py-2.5 leading-snug"
        />
        {text.trim() || photo ? (
          <button type="submit" className="btn-primary h-11 shrink-0 px-4" disabled={!canSend} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            Send
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary h-11 w-11 shrink-0 p-0"
            onClick={() => void startRecording()}
            aria-label="Record a voice message"
            title="Record a voice message (up to 2 minutes)"
            disabled={busy}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
            </svg>
          </button>
        )}
      </div>
      <p id={hintId} className="mt-1 flex justify-between gap-2 px-1 text-[11px] text-muted">
        <span className="hidden sm:inline">Enter to send, Shift+Enter for a new line</span>
        {text.length > MAX_MESSAGE_CHARS - 400 && (
          <span className={`ml-auto font-mono ${over ? "text-danger" : ""}`}>
            {text.length}/{MAX_MESSAGE_CHARS}
          </span>
        )}
      </p>
    </form>
  );
}
