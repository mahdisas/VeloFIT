"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Plus } from "lucide-react";

import { createGymWithOwner } from "@/app/admin/actions";
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
import { useT } from "@/lib/i18n/provider";

/** Create a gym and its owner account in one step (you type the password). */
export function NewGymDialog() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (!name.trim() || !code.trim() || !username.trim() || password.length < 6) {
      toast.error(t("Fill in all fields (password ≥ 6 characters)."));
      return;
    }
    startTransition(async () => {
      const res = await createGymWithOwner({
        name: name.trim(),
        code: code.trim(),
        ownerUsername: username.trim(),
        ownerPassword: password,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("Gym created"));
      setOpen(false);
      setName(""); setCode(""); setUsername(""); setPassword("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button"><Plus className="size-4" /> {t("New Gym")}</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("New Gym")}</DialogTitle>
          <DialogDescription>{t("Creates the gym and its owner login.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field label={t("Gym name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" autoFocus />
          </Field>
          <Field label={t("Gym Code")}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" autoCapitalize="none" placeholder="omar" />
          </Field>
          <Field label={t("Owner username")}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" autoCapitalize="none" placeholder="captin" />
          </Field>
          <Field label={t("Owner password")}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-10"
                dir="ltr"
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
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("Close")}</Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {t("Create Gym")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
