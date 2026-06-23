"use client";

import * as React from "react";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";

import { resetUserPassword, saveUser } from "@/app/(app)/settings/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/provider";
import {
  emptyPermissions,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type Permissions,
  type StaffUser,
} from "@/lib/settings/users";

type FormValues = {
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  hourlyRate: string;
  permissions: Permissions;
};

function seed(user?: StaffUser): FormValues {
  return {
    username: user?.username ?? "",
    password: "",
    confirmPassword: "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    hourlyRate: user ? String(user.hourlyRate) : "0",
    permissions: user ? { ...user.permissions } : emptyPermissions(),
  };
}

/** Add / Edit Staff User drawer. `user` present → edit mode. */
export function UserDialog({
  user,
  onSaved,
  children,
}: {
  user?: StaffUser;
  onSaved: (user: StaffUser) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(user));
  const [resetPwd, setResetPwd] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(user));
      setResetPwd("");
      setError(null);
    }
  }, [open, user]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const togglePerm = (key: keyof Permissions, value: boolean) =>
    setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: value } }));

  const isEdit = Boolean(user);

  const onResetPassword = () => {
    if (!user) return;
    startTransition(async () => {
      const result = await resetUserPassword(user.id, resetPwd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResetPwd("");
      toast.success(t("Password reset"));
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.username.trim()) return setError(t("Username is required."));
    if (!isEdit) {
      if (!form.password.trim()) return setError(t("Password is required."));
      if (form.password !== form.confirmPassword) return setError(t("Passwords do not match."));
    }
    if (!form.firstName.trim()) return setError(t("First name is required."));
    if (!form.lastName.trim()) return setError(t("Last name is required."));
    if (!form.phone.trim()) return setError(t("Phone number is required."));

    startTransition(async () => {
      const result = await saveUser({
        id: user?.id,
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        hourlyRate: Number(form.hourlyRate) || 0,
        password: isEdit ? undefined : form.password,
        permissions: form.permissions,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
        hourlyRate: Number(form.hourlyRate) || 0,
        permissions: form.permissions,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Update user details") : t("Add new user")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            {isEdit ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={t("UserName")} required>
                    <Input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="omar" dir="auto" />
                  </Field>
                  <Field label={t("First Name")} required>
                    <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} dir="auto" />
                  </Field>
                  <Field label={t("Last Name")} required>
                    <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} dir="auto" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("Phone Number")} required>
                    <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </Field>
                  <Field label={t("Hourly rate")}>
                    <Input type="number" min={0} value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
                  </Field>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm text-[#595959]">{t("Reset Password")}</p>
                  <div className="mt-2 flex flex-col items-end gap-3">
                    <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder={t("Enter Password")} />
                    <Button type="button" size="sm" disabled={pending} onClick={onResetPassword}>
                      {t("Save")} <SendHorizontal className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={t("UserName")} required>
                    <Input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder={t("Enter UserName")} dir="auto" />
                  </Field>
                  <Field label={t("Password")} required>
                    <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={t("Enter Password")} />
                  </Field>
                  <Field label={t("Confirm Password")} required>
                    <Input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} placeholder={t("Enter confirm password")} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={t("First Name")} required>
                    <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder={t("Enter First Name")} dir="auto" />
                  </Field>
                  <Field label={t("Last Name")} required>
                    <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder={t("Enter Last Name")} dir="auto" />
                  </Field>
                  <Field label={t("Phone Number")} required>
                    <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={t("Enter Phone Number")} />
                  </Field>
                </div>
                <Field label={t("Hourly rate")} className="sm:max-w-[12rem]">
                  <Input type="number" min={0} value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
                </Field>
              </>
            )}

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-semibold">{t("Permissions")}</p>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {PERMISSION_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#595959]">{t(PERMISSION_LABELS[key])}</span>
                    <Switch checked={form.permissions[key]} onCheckedChange={(v) => togglePerm(key, v)} />
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {isEdit ? t("Update") : t("Add")} <SendHorizontal className="size-4" />
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-sm text-[#595959]">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </span>
      {children}
    </div>
  );
}
