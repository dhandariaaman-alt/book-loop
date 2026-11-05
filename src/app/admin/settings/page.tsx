import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { PageHeader, Panel } from "@/components/app/ui";
import { SETTINGS, getNumberSetting, type SettingKey } from "@/lib/settings";
import { fmtDateTime } from "@/lib/admin";
import { updateSettingAction } from "@/app/actions/admin";
import { ActionForm } from "../_components/action-form";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireRole(["ADMIN"]);
  const keys = Object.keys(SETTINGS) as SettingKey[];
  const [values, rows] = await Promise.all([
    Promise.all(keys.map((k) => getNumberSetting(k))),
    prisma.platformSetting.findMany({ where: { key: { in: keys } }, select: { key: true, updatedAt: true } }),
  ]);
  const updated = new Map(rows.map((r) => [r.key, r.updatedAt]));

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform rules that apply to everyone. Every change is recorded in the audit log." />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {keys.map((key, i) => {
          const s = SETTINGS[key];
          const id = `setting-${key}`;
          return (
            <Panel key={key} title={s.label} tint={i % 2 ? "butter" : "sky"} icon="clock">
              <ActionForm action={updateSettingAction} hidden={{ key }} label="Save" variant="primary" alwaysOpen>
                <label htmlFor={id} className="label text-xs">
                  Value (between {s.min} and {s.max}, default {s.default})
                </label>
                <input id={id} name="value" type="number" min={s.min} max={s.max} step={1} defaultValue={values[i]} required className="input max-w-40" />
                <p className="text-[11px] text-muted">
                  {updated.get(key) ? `Last changed ${fmtDateTime(updated.get(key))}` : "Using the default"}
                </p>
              </ActionForm>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
