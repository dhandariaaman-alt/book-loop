// Admin-configurable platform settings (PlatformSetting table).

import { prisma } from "./prisma";

export const SETTINGS = {
  reservation_expiry_hours: { label: "Reservation expiry (hours)", default: 48, min: 1, max: 336 },
  return_reminder_days: { label: "Send return reminder (days before due)", default: 2, min: 1, max: 14 },
} as const;

export type SettingKey = keyof typeof SETTINGS;

export async function getNumberSetting(key: SettingKey): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  const n = Number(row?.value);
  const s = SETTINGS[key];
  return Number.isFinite(n) && n >= s.min && n <= s.max ? n : s.default;
}

export async function setNumberSetting(key: SettingKey, value: number) {
  const s = SETTINGS[key];
  if (!Number.isFinite(value) || value < s.min || value > s.max) throw new Error(`${s.label} must be between ${s.min} and ${s.max}.`);
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });
}
