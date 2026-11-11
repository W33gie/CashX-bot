import { requireContext } from "@/lib/session";
import { Logo } from "@/components/shell/logo";
import { SideNav, MobileNav, SignOutButton } from "@/components/shell/nav";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-side px-3 py-4 text-white lg:flex">
        <div>
          <div className="px-2.5 pb-6 pt-1">
            <Logo />
          </div>
          <SideNav />
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={ctx.user.name} className="size-7" />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium">{ctx.user.name}</div>
              <div className="truncate text-[11.5px] text-side-ink">{ctx.workspaceName}</div>
            </div>
          </div>
          <SignOutButton className="mt-3" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 px-4 pt-3 backdrop-blur lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <Logo />
            <Avatar name={ctx.user.name} className="size-7" />
          </div>
          <MobileNav />
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
