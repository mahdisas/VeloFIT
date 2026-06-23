"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { saveCampaign } from "@/app/(app)/marketing/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";
import { CAMPAIGN_TYPES, PLATFORM_TYPES, type Campaign } from "@/lib/marketing/campaigns";

type FormValues = {
  name: string;
  platformType: string;
  campaignType: string;
  url: string;
  description: string;
};

function seed(campaign?: Campaign): FormValues {
  return {
    name: campaign?.name ?? "",
    platformType: campaign?.platformType ?? PLATFORM_TYPES[0],
    campaignType: campaign?.campaignType ?? CAMPAIGN_TYPES[0],
    url: campaign?.url ?? "",
    description: campaign?.description ?? "",
  };
}

/** Add / Edit Campaign drawer. `campaign` present → edit mode. */
export function CampaignDialog({
  campaign,
  onSaved,
  children,
}: {
  campaign?: Campaign;
  onSaved: (campaign: Campaign) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(campaign));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(campaign));
      setError(null);
    }
  }, [open, campaign]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(campaign);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    startTransition(async () => {
      const result = await saveCampaign({
        id: campaign?.id,
        name: form.name,
        platformType: form.platformType,
        campaignType: form.campaignType,
        url: form.url,
        description: form.description,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        name: form.name,
        platformType: form.platformType,
        campaignType: form.campaignType,
        url: form.url.trim(),
        description: form.description,
        isActive: campaign?.isActive ?? true,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit Campaign") : t("Add Campaign")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={t("Name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Name")} dir="auto" />
            </Field>

            <Field label={t("Platform Type")}>
              <Select value={form.platformType} onValueChange={(v) => set("platformType", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={4}>
                  {PLATFORM_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("Campaign Type")}>
              <Select value={form.campaignType} onValueChange={(v) => set("campaignType", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={4}>
                  {CAMPAIGN_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("URL")}>
              <Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" inputMode="url" />
            </Field>

            <Field label={t("Description")}>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Description")} rows={3} dir="auto" />
            </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
