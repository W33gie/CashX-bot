import { AuthForm } from "@/components/shell/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-muted">Sign in to your workspace.</p>
      <AuthForm mode="login" />
    </>
  );
}
