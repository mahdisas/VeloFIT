"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { updateClient, type ClientUpdateInput } from "@/app/(app)/clients/client-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type ClientEditData } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";

function seed(initial: ClientEditData): ClientUpdateInput {
  return {
    fullName: initial.fullName,
    phone: initial.phone,
    phone2: initial.phone2,
    email: initial.email,
    nationalId: initial.nationalId,
    gender: initial.gender === "" ? "male" : initial.gender,
    birthDate: initial.birthDate,
    city: initial.city,
    address: initial.address,
    notes: initial.notes,
    messagingService: initial.messagingOpt,
  };
}

/** Edit an existing client's details. `children` is the trigger (the pencil). */
export function EditClientDialog({
  clientId,
  initial,
  children,
}: {
  clientId: string;
  initial: ClientEditData;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<ClientUpdateInput>(seed(initial));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Re-seed whenever the dialog opens (fresh server data after a refresh).
  React.useEffect(() => {
    if (open) {
      setForm(seed(initial));
      setError(null);
    }
  }, [open, initial]);

  const set = <K extends keyof ClientUpdateInput>(key: K, value: ClientUpdateInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) {
      setError(t("Name is required."));
      return;
    }
    startTransition(async () => {
      const result = await updateClient(clientId, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("Client updated"));
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("Edit client")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={t("Full Name")} required>
              <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder={t("Enter Full Name")} dir="auto" />
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label={t("Phone Number")}>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={t("Enter Phone Number")} inputMode="tel" dir="ltr" />
              </Field>
              <Field label={t("Phone Number 2")}>
                <Input value={form.phone2} onChange={(e) => set("phone2", e.target.value)} placeholder={t("Enter Phone Number 2")} inputMode="tel" dir="ltr" />
              </Field>
              <Field label={t("ID")}>
                <Input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} placeholder={t("Enter Client's Id")} />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("Email")}>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("Enter Email Address")} />
              </Field>
              <Field label={t("Birth Date")}>
                <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-[#595959]">{t("Gender")}</span>
                <RadioGroup
                  className="flex flex-row gap-4"
                  value={form.gender}
                  onValueChange={(v) => set("gender", v as ClientUpdateInput["gender"])}
                >
                  {(["male", "female", "other"] as const).map((g) => (
                    <div key={g} className="flex items-center gap-2">
                      <RadioGroupItem value={g} id={`edit-gender-${g}`} />
                      <Label htmlFor={`edit-gender-${g}`} className="font-normal capitalize">{t(g.charAt(0).toUpperCase() + g.slice(1))}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[#595959]">{t("Messaging Service")}</span>
                <Switch checked={form.messagingService} onCheckedChange={(v) => set("messagingService", v)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("City")}>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Enter City Name")} dir="auto" />
              </Field>
              <Field label={t("Address")}>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={t("Enter Address")} dir="auto" />
              </Field>
            </div>

            <Field label={t("Notes")}>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("Write a Note")} rows={3} dir="auto" />
            </Field>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving…") : t("Update")} <SendHorizontal className="size-4" />
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#595959]">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </div>
  );
}
