import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { unreadCount } from "@/lib/notify";

/** Bell linking to /notifications, with the unread count. */
async function NotificationBell({ userId }: { userId: string }) {
  const count = await unreadCount(userId).catch(() => 0);
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications, none unread";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      title="Notifications"
      className="btn-ghost relative h-10 w-10 p-0"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-bg"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

export async function Navbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4" aria-label="Main">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                Home
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn-ghost hidden sm:inline-flex">
                  Admin
                </Link>
              )}
              <NotificationBell userId={user.id} />
              <details className="menu relative">
                <summary
                  className="flex cursor-pointer list-none items-center rounded-full ring-offset-2 ring-offset-bg transition-shadow duration-200 hover:ring-2 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 [&::-webkit-details-marker]:hidden"
                  aria-label="Account menu"
                >
                  <Avatar name={user.name} image={user.image} size={36} />
                </summary>
                <div className="card absolute right-0 mt-2 w-56 p-1.5 shadow-[0_12px_32px_-12px_rgb(60_45_25/0.25)]">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted">@{user.username}</p>
                  </div>
                  <hr className="my-1 border-border" />
                  <Link href="/dashboard" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2 sm:hidden">
                    Home
                  </Link>
                  <Link href={`/u/${user.username}`} className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                    View my profile
                  </Link>
                  <Link href="/settings/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                    Edit profile
                  </Link>
                  <Link href="/settings/notifications" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                    Notification settings
                  </Link>
                  {(user.role === "INSTITUTION" || user.role === "ADMIN" || user.role === "MODERATOR") && (
                    <hr className="my-1 border-border" />
                  )}
                  {(user.role === "INSTITUTION" || user.role === "ADMIN") && (
                    <Link href="/institution" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                      Institution dashboard
                    </Link>
                  )}
                  {(user.role === "MODERATOR" || user.role === "ADMIN") && (
                    <Link href="/moderator" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                      Moderation
                    </Link>
                  )}
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2 sm:hidden">
                      Admin console
                    </Link>
                  )}
                  <hr className="my-1 border-border" />
                  <form action={signOutAction}>
                    <button className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-2">
                      Sign out
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Join
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
