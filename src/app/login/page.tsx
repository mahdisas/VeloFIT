import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo } from "@/components/layout/brand";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Brand */}
      <header className="relative z-10 p-5 md:p-6">
        <BrandLogo />
      </header>

      {/* Decorative blurred brand mark on the left (desktop only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -left-28 hidden -translate-y-1/2 opacity-70 blur-[64px] md:block"
      >
        <svg viewBox="0 0 200 200" className="size-[34rem]">
          <polygon points="18,150 116,18 158,58 60,178" fill="#3b82f6" />
          <polygon points="64,176 120,96 158,132 104,184" fill="#1e293b" />
          <polygon points="118,20 158,58 132,80 96,44" fill="#60a5fa" />
        </svg>
      </div>

      {/* Login card */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-4 pb-16">
        <LoginForm />
      </main>
    </div>
  );
}
