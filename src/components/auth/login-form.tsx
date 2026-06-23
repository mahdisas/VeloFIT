"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { createClient, setSessionPersistence } from "@/lib/supabase/client";
import { rememberGymCode, readGymCode, STAFF_EMAIL_DOMAIN } from "@/lib/auth";
import { setLocale } from "@/lib/i18n/actions";
import { dirFor, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Staff (management dashboard) login. Authenticates with Supabase email/password,
 * then verifies the signed-in profile belongs to the entered Gym Code (the gym's
 * slug) before entering the dashboard.
 */
export function LoginForm() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [gymCode, setGymCode] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [keepSignedIn, setKeepSignedIn] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Pre-fill the gym code from the last successful login on this device.
  React.useEffect(() => {
    const remembered = readGymCode();
    if (remembered) setGymCode(remembered);
  }, []);

  // Switch the dashboard language (cookie) and apply RTL immediately.
  const chooseLanguage = (next: Locale) => {
    if (next === locale) return;
    document.documentElement.lang = next;
    document.documentElement.dir = dirFor(next);
    void setLocale(next).then(() => router.refresh());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!gymCode.trim() || !email.trim() || !password) {
      setError(t("Please fill in all fields."));
      return;
    }

    setLoading(true);
    try {
      // Persist the "keep me signed in" choice BEFORE creating the client, so the
      // auth cookies are written persistent (checked) or session-only (unchecked).
      setSessionPersistence(keepSignedIn);
      const supabase = createClient();
      // Staff created in Settings · Users sign in with their USERNAME; their
      // login email is synthesized as <username>@<gym-slug>.<STAFF_EMAIL_DOMAIN>.
      // So if the identifier isn't already an email, build it from the gym code.
      const identifier = email.trim();
      const loginEmail = identifier.includes("@")
        ? identifier
        : `${identifier.toLowerCase()}@${gymCode.trim().toLowerCase()}.${STAFF_EMAIL_DOMAIN}`;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError || !data.user) {
        setError(t("Invalid email or password."));
        return;
      }

      // Confirm this staff member belongs to the gym they entered.
      const { data: profile } = await supabase
        .from("profiles")
        .select("gym_id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile?.gym_id) {
        await supabase.auth.signOut();
        setError(t("Your account isn't linked to a gym. Contact your administrator."));
        return;
      }

      const { data: gym } = await supabase
        .from("gyms")
        .select("slug")
        .eq("id", profile.gym_id)
        .maybeSingle();

      if (!gym || gym.slug.toLowerCase() !== gymCode.trim().toLowerCase()) {
        await supabase.auth.signOut();
        setError(t("That gym code doesn't match your account."));
        return;
      }

      // Remember the tenant hint, then go to the intended page (or the
      // dashboard). Only same-origin relative paths are honored — no open redirect.
      rememberGymCode(gymCode.trim());
      const redirectParam = new URLSearchParams(window.location.search).get("redirect");
      const dest =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : "/dashboard";
      router.push(dest);
      router.refresh();
    } catch {
      setError(t("Couldn't reach the server. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl shadow-black/5">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("Welcome to veloFIT")}</h1>
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-medium text-rose-500">{t("Language")}</span>
          <Select value={locale} onValueChange={(v) => chooseLanguage(v as Locale)}>
            <SelectTrigger className="h-9 w-[124px]" aria-label={t("Language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" sideOffset={4}>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  <span dir="auto">{LOCALE_LABELS[l]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <Field id="gymCode" label={t("Gym Code")}>
          <Input
            id="gymCode"
            value={gymCode}
            onChange={(e) => setGymCode(e.target.value)}
            placeholder={t("Gym Code")}
            autoComplete="organization"
            autoCapitalize="none"
            disabled={loading}
          />
        </Field>

        <Field id="email" label={t("Email or Username")}>
          <Input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("you@gym.com or username")}
            autoComplete="username"
            autoCapitalize="none"
            disabled={loading}
          />
        </Field>

        <Field id="password" label={t("Password")}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Password")}
              autoComplete="current-password"
              className="pe-10"
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
        </Field>

        <div className="flex items-center gap-2">
          <Checkbox
            id="keep"
            checked={keepSignedIn}
            onCheckedChange={(v) => setKeepSignedIn(v === true)}
            disabled={loading}
          />
          <Label htmlFor="keep" className="text-sm font-normal text-muted-foreground">
            {t("Keep me sign in")}
          </Label>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="h-11 w-full text-sm font-semibold">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("Signing in…")}
            </>
          ) : (
            t("Login")
          )}
        </Button>
      </form>
      {/* Privacy / Terms links removed for now — those pages don't exist yet
          (were 404-ing on prefetch). Re-add once the legal pages are built. */}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
