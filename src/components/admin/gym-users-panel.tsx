"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus } from "lucide-react";

import { addGymUser, resetGymUserPassword, setGymUserActive, type GymUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const ROLES = ["owner", "admin", "manager", "trainer", "receptionist"] as const;

/** A gym's staff: list + add + reset password + deactivate/activate (super-admin). */
export function GymUsersPanel({ gymId, users }: { gymId: string; users: GymUser[] }) {
  const t = useT();
  const [resetFor, setResetFor] = React.useState<GymUser | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t("Users")}</h2>
        <AddUserDialog gymId={gymId} />
      </div>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("No users yet.")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} onReset={() => setResetFor(u)} />
          ))}
        </div>
      )}

      {resetFor && (
        <ResetPasswordDialog user={resetFor} onDone={() => setResetFor(null)} />
      )}
    </section>
  );
}

function UserRow({ user, onReset }: { user: GymUser; onReset: () => void }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const toggleActive = () => {
    const next = user.isArchived; // archived → reactivate; else deactivate
    startTransition(async () => {
      const res = await setGymUserActive(user.id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? t("User activated") : t("User deactivated"));
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <span className="grid size-10 shrink-0 place-content-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
        <span dir="auto">{initials(user.fullName)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium" dir="auto">{user.fullName}</p>
          {user.isArchived && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("Inactive")}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <span dir="ltr">{user.username || "—"}</span> · <span className="capitalize">{t(roleLabel(user.role))}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onReset} aria-label={t("Reset password")} title={t("Reset password")}>
          <KeyRound className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleActive}
          disabled={pending}
          className={cn(!user.isArchived && "text-destructive hover:text-destructive")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : user.isArchived ? t("Activate") : t("Deactivate")}
        </Button>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function AddUserDialog({ gymId }: { gymId: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<(typeof ROLES)[number]>("receptionist");
  const [password, setPassword] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (!username.trim() || !fullName.trim() || password.length < 6) {
      toast.error(t("Fill in all fields (password ≥ 6 characters)."));
      return;
    }
    startTransition(async () => {
      const res = await addGymUser({ gymId, username: username.trim(), fullName: fullName.trim(), role, password });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("User created"));
      setOpen(false);
      setUsername(""); setFullName(""); setRole("receptionist"); setPassword("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline"><Plus className="size-4" /> {t("Add user")}</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add user")}</DialogTitle>
          <DialogDescription>{t("Creates a staff login for this gym.")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">{t("Full name")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} dir="auto" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">{t("Username")}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" autoCapitalize="none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">{t("Role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as (typeof ROLES)[number])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{t(roleLabel(r))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">{t("Password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("Close")}</Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {t("Add user")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onDone }: { user: GymUser; onDone: () => void }) {
  const t = useT();
  const [password, setPassword] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (password.length < 6) {
      toast.error(t("Password must be at least 6 characters."));
      return;
    }
    startTransition(async () => {
      const res = await resetGymUserPassword(user.id, password);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("Password updated"));
      onDone();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Reset password")}</DialogTitle>
          <DialogDescription dir="auto">{user.fullName}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label className="text-muted-foreground">{t("New password")}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>{t("Close")}</Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {t("Update")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
