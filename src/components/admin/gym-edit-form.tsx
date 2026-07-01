"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { setGymActive, updateGym, type GymDetail } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Edit a gym's name + message balance, and suspend/activate it. The gym code is
 *  immutable (it's baked into every staff login email), so it's shown read-only. */
export function GymEditForm({ gym }: { gym: GymDetail }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = React.useState(gym.name);
  const [balance, setBalance] = React.useState(String(gym.messagesBalance));
  const [active, setActive] = React.useState(gym.isActive);
  const [savePending, startSave] = React.useTransition();
  const [togglePending, startToggle] = React.useTransition();

  const save = () => {
    if (!name.trim()) {
      toast.error(t("Gym name is required"));
      return;
    }
    startSave(async () => {
      const res = await updateGym({ gymId: gym.id, name: name.trim(), messagesBalance: Number(balance) || 0 });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("Saved"));
      router.refresh();
    });
  };

  const toggle = () => {
    const next = !active;
    startToggle(async () => {
      const res = await setGymActive(gym.id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setActive(next);
      toast.success(next ? t("Gym activated") : t("Gym suspended"));
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{t("Gym details")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Gym name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
        </Field>
        <Field label={t("Gym Code")}>
          <Input value={gym.code} disabled dir="ltr" />
        </Field>
        <Field label={t("Message balance")}>
          <Input type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" onClick={save} disabled={savePending}>
          {savePending ? <Loader2 className="size-4 animate-spin" /> : null} {t("Save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={toggle}
          disabled={togglePending}
          className={cn(active && "text-destructive hover:text-destructive")}
        >
          {togglePending ? <Loader2 className="size-4 animate-spin" /> : null}
          {active ? t("Suspend gym") : t("Activate gym")}
        </Button>
      </div>
    </section>
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
