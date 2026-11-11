import { Logo } from "@/components/shell/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-side p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="max-w-md">
          <p className="text-[28px] font-semibold leading-tight tracking-tight">
            Find the creators everyone else hasn&apos;t found yet.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-side-ink">
            Untapped scores creators on audience quality, growth and visible commercial saturation — and shows you the
            evidence behind every number.
          </p>
        </div>
        <div className="text-[12px] text-side-ink">Public data only · Evidence over guesses</div>
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[480px] rounded-full bg-[radial-gradient(circle,var(--accent)_0%,transparent_65%)] opacity-25" />
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
