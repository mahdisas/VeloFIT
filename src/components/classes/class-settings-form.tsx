"use client";

import * as React from "react";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";

import { saveClassSettings } from "@/app/(app)/classes/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/provider";
import { type ClassSettings } from "@/lib/class-settings";

export function ClassSettingsForm({ initial }: { initial: ClassSettings }) {
  const t = useT();
  const [settings, setSettings] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof ClassSettings>(key: K, value: ClassSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const onSave = () =>
    startTransition(async () => {
      const result = await saveClassSettings(settings);
      if (result.ok) toast.success(t("Class settings saved"));
      else toast.error(result.error);
    });

  return (
    <Card>
      <CardContent className="flex flex-col">
        <Row>
          <Label>{t("Convert status from waiting to approved in case of availability")}</Label>
          <Switch
            checked={settings.convertWaitingToApproved}
            onCheckedChange={(v) => set("convertWaitingToApproved", v)}
          />
        </Row>

        <Divider />
        <Row>
          <Label>{t("Send notification when class cancellation")}</Label>
          <Switch
            checked={settings.notifyOnCancellation}
            onCheckedChange={(v) => set("notifyOnCancellation", v)}
          />
        </Row>

        <Divider />
        <Row>
          <div className="flex flex-wrap items-center gap-2">
            <Label>{t("Send reminder of class before")}</Label>
            <Input
              type="number"
              min={0}
              value={settings.reminderMinutesBefore}
              onChange={(e) => set("reminderMinutesBefore", Number(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">
              {t("minutes")} <span className="text-amber-600">{t("(if the value is 0 then the system will not send any reminder)")}</span>
            </span>
          </div>
        </Row>

        <Divider />
        <Row>
          <Label>{t("Apply enrollment limit across all subscriptions")}</Label>
          <Switch
            checked={settings.applyEnrollmentLimitAcrossSubscriptions}
            onCheckedChange={(v) => set("applyEnrollmentLimitAcrossSubscriptions", v)}
          />
        </Row>

        <Divider />
        <Row>
          <Label>{t("Block clients for absences")}</Label>
          <Switch
            checked={settings.blockClientsForAbsences}
            onCheckedChange={(v) => set("blockClientsForAbsences", v)}
          />
        </Row>

        <div className="flex justify-end pt-6">
          <Button onClick={onSave} disabled={pending}>
            {pending ? t("Saving…") : t("Save")} <SendHorizontal className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-4">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium">{children}</span>;
}

function Divider() {
  return <div className="border-t" />;
}
