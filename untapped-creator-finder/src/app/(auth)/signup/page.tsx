import { AuthForm } from "@/components/shell/auth-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-muted">You&apos;ll get a private workspace for your prospects.</p>
      <AuthForm mode="signup" />
    </>
  );
}
