import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-wider text-muted">404</p>
        <h1 className="mt-1 text-[22px] font-semibold">Nothing here</h1>
        <Link href="/" className="mt-4 inline-block text-[13px] font-medium text-accent">Back to dashboard</Link>
      </div>
    </div>
  );
}
