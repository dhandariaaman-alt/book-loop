// Book photo and voice message storage.
// - If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, photos go to the
//   public Supabase Storage bucket SUPABASE_BUCKET (default "book-images").
// - Otherwise (local development) they are written to public/uploads.
//   Local files do not survive on serverless hosting, so set Supabase before deploying.

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type Mime = keyof typeof TYPES;

/** Check the file really is the image type it claims (magic bytes), not just its name. */
function sniff(buf: Buffer): Mime | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

export class UploadError extends Error {}

/** Validate and store one uploaded image. Returns its public URL. */
export async function saveImage(file: File): Promise<string> {
  if (file.size === 0) throw new UploadError("The photo is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError("Photos must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new UploadError("Upload a JPG, PNG or WebP photo.");

  const name = `${randomUUID()}.${TYPES[mime]}`;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (base && key) {
    const bucket = process.env.SUPABASE_BUCKET || "book-images";
    const res = await fetch(`${base}/storage/v1/object/${bucket}/listings/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": mime, "x-upsert": "false" },
      body: buf,
    });
    if (!res.ok) throw new UploadError("We couldn't store that photo. Please try again.");
    return `${base}/storage/v1/object/public/${bucket}/listings/${name}`;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}

// ─────────────────────────── Voice messages ───────────────────────────

export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

const AUDIO_TYPES = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
} as const;

type AudioMime = keyof typeof AUDIO_TYPES;

/** Check the recording really is an audio container we accept (magic bytes). */
function sniffAudio(buf: Buffer): AudioMime | null {
  if (buf.length < 12) return null;
  // WebM / Matroska (EBML header)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "audio/webm";
  if (buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  // MP4 / M4A: "ftyp" box at offset 4
  if (buf.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  // MP3: ID3 tag or an MPEG frame sync
  if (buf.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

/** Validate and store one voice recording. Returns its public URL. */
export async function saveAudio(file: File): Promise<string> {
  if (file.size === 0) throw new UploadError("The recording is empty.");
  if (file.size > MAX_AUDIO_BYTES) throw new UploadError("Voice messages must be 3 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffAudio(buf);
  if (!mime) throw new UploadError("That recording format isn't supported.");

  const name = `${randomUUID()}.${AUDIO_TYPES[mime]}`;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (base && key) {
    const bucket = process.env.SUPABASE_BUCKET || "book-images";
    const res = await fetch(`${base}/storage/v1/object/${bucket}/voice/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": mime, "x-upsert": "false" },
      body: buf,
    });
    if (!res.ok) throw new UploadError("We couldn't store that recording. Please try again.");
    return `${base}/storage/v1/object/public/${bucket}/voice/${name}`;
  }

  const dir = path.join(process.cwd(), "public", "uploads", "voice");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/voice/${name}`;
}
