"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";

import { checkPlatformAdmin } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, setSessionPersistence } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";

/**
 * Platform (super-admin) login. Authenticates with Supabase email/password (no gym
 * code), then confirms the account is allowlisted before entering the console —
 * otherwise it signs back out. The account is gymless; it exists only to operate
 * the platform.
 */
export function AdminLoginForm() {
  const t = useT();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("Please fill in all fields."));
      return;
    }

    setLoading(true);
    try {
      setSessionPersistence(true);
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.user) {
        setError(t("Invalid email or password."));
        return;
      }

      // Only allowlisted accounts may enter — anyone else is signed straight out.
      const ok = await checkPlatformAdmin();
      if (!ok) {
        await supabase.auth.signOut();
        setError(t("This account isn't a platform admin."));
        return;
      }

      // Hard navigation (not router.push) so the proxy + server re-evaluate with
      // the just-set session cookie — a soft nav here races the auth cookie and
      // leaves you on the login page until a manual refresh.
      window.location.assign("/admin");
      return;
    } catch {
      setError(t("Couldn't reach the server. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl shadow-black/5">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Shield className="size-6" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">{t("Admin Console")}</h1>
        <p className="text-sm text-muted-foreground">{t("Sign in to manage all gyms.")}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adminEmail" className="text-muted-foreground">{t("Email")}</Label>
          <Input
            id="adminEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adminPassword" className="text-muted-foreground">{t("Password")}</Label>
          <div className="relative">
            <Input
              id="adminPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-10"
              dir="ltr"
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? t("Hide password") : t("Show password")}
              className="absolute top-1/2 end-2 grid size-7 -translate-y-1/2 place-content-center rounded text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <Button type="submit" disabled={loading} className="h-11 w-full text-sm font-semibold">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("Signing in…")}
            </>
          ) : (
            t("Sign in")
          )}
        </Button>
      </form>
    </div>
  );
}
