import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = { title: "Admin Console" };

/**
 * Dedicated platform (super-admin) login — email + password, no gym code. Lives
 * OUTSIDE the (console) route group so it isn't behind getPlatformAdmin.
 */
export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 start-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
      />
      <AdminLoginForm />
    </div>
  );
}
