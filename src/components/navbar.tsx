import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { Avatar } from "./avatar";
import { Logo } from "./logo";

export async function Navbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
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
              <details className="relative">
                <summary
                  className="flex cursor-pointer list-none items-center rounded-full focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden"
                  aria-label="Account menu"
                >
                  <Avatar name={user.name} image={user.image} size={36} />
                </summary>
                <div className="card absolute right-0 mt-2 w-56 p-1.5 shadow-lg">
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
