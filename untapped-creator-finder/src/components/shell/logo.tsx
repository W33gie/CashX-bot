export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--accent)" />
        <path d="M7 7v6a5 5 0 0 0 10 0V7" stroke="var(--accent-ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="17" cy="7" r="1.6" fill="var(--accent-ink)" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Untapped</span>
    </span>
  );
}
