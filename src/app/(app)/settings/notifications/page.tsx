import type { Metadata } from "next";
import Link from "next/link";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CHANNEL_DEFAULTS, NOTIFICATION_TYPE_LABEL } from "@/lib/notify";
import { smsConfigured } from "@/lib/sms";
import { PageHeader, Panel } from "@/components/app/ui";
import { PreferenceGrid, type PrefRow } from "@/components/notifications/preference-grid";
import { PushControls } from "@/components/notifications/push-controls";
import { PhoneForm } from "@/components/notifications/phone-form";

export const metadata: Metadata = { title: "Notification settings" };
export const dynamic = "force-dynamic";

const CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "PUSH", "SMS"];

export default async function NotificationSettingsPage() {
  const me = await requireUser();
  const [prefs, profile] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId: me.id } }),
    prisma.profile.findUnique({ where: { userId: me.id }, select: { phone: true } }),
  ]);

  const rows: PrefRow[] = (Object.keys(NOTIFICATION_TYPE_LABEL) as NotificationType[]).map((type) => ({
    type,
    label: NOTIFICATION_TYPE_LABEL[type],
    values: Object.fromEntries(
      CHANNELS.map((c) => [c, prefs.find((p) => p.type === type && p.channel === c)?.enabled ?? CHANNEL_DEFAULTS[c]]),
    ) as Record<NotificationChannel, boolean>,
  }));

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <Link href="/notifications" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <span aria-hidden="true">←</span> Notifications
      </Link>
      <div className="mt-4">
        <PageHeader
          title="Notification settings"
          note="only what matters to you"
          subtitle="Choose how BookLoop reaches you for each kind of update."
        />
      </div>

      <div className="mt-6 space-y-6">
        <section className="card overflow-hidden py-4" aria-labelledby="pref-title">
          <h2 id="pref-title" className="heading px-4 pb-3 text-lg font-semibold">
            What you hear about, and where
          </h2>
          <PreferenceGrid rows={rows} />
        </section>

        <Panel title="Browser notifications" tint="sky" icon="inbox">
          <p className="mb-3 text-sm text-muted">
            Get a pop-up on this device when something happens, even when BookLoop isn&apos;t open. Turn it on for each
            browser you use.
          </p>
          <PushControls />
        </Panel>

        <Panel title="Text messages (SMS)" tint="butter" icon="chat">
          <p className="mb-3 text-sm text-muted">
            SMS is off by default and may cost money, depending on your plan. Turn on the SMS column above for the
            updates you want by text.
          </p>
          <PhoneForm phone={profile?.phone ?? null} smsReady={smsConfigured()} />
        </Panel>

        <Panel title="Email" tint="peach" icon="inbox">
          <p className="text-sm text-muted">
            Emails go to the address on your account. Until an email provider is configured, emails are printed to the
            server console instead of being sent.
          </p>
        </Panel>
      </div>
    </div>
  );
}
