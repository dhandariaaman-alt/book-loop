import { requireUser } from "@/lib/session";
import { BottomNav, SideNav } from "@/components/app/app-nav";

// Shell for every signed-in section: sidebar on desktop, tab bar on phones.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 pb-28 pt-6 lg:pb-12 lg:pt-8">
      <SideNav name={me.name ?? me.username} username={me.username} />
      <div className="min-w-0 flex-1">{children}</div>
      <BottomNav />
    </div>
  );
}
