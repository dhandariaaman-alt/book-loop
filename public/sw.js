// BookLoop service worker: shows browser push notifications.
// Payload (from lib/push.ts): { title, body, url }

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "BookLoop";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      data: { url: data.url || "/notifications" },
      tag: data.url || undefined,
      renotify: Boolean(data.url),
      lang: "en",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin);
  // Only ever open pages on this site.
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && client.url !== target.href) {
            try {
              await client.navigate(target.href);
            } catch {
              // Uncontrolled clients can't be navigated; open a new window instead.
              await self.clients.openWindow(target.href);
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
