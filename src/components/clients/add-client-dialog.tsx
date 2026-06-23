"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, SendHorizontal } from "lucide-react";

import { createClient, type NewClientInput } from "@/app/(app)/clients/client-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";

// Country dial codes (trimmed; extend as needed).
const COUNTRY_CODES = [
  { value: "+972", label: "🇮🇱 +972" },
  { value: "+971", label: "🇦🇪 +971" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
];

const EMPTY: NewClientInput = {
  firstName: "",
  middleName: "",
  lastName: "",
  birthDate: "",
  countryCode: "+972",
  phone: "",
  nationalId: "",
  phone2: "",
  email: "",
  gender: "male",
  messagingService: true,
  city: "",
  address: "",
  notes: "",
  sendWelcomeMessage: false,
};

export function AddClientDialog() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewClientInput>(EMPTY);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof NewClientInput>(key: K, value: NewClientInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.phone.trim()) {
      setError(t("Please fill in all required fields."));
      return;
    }
    startTransition(async () => {
      const result = await createClient(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setForm(EMPTY);
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setForm(EMPTY);
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t("Add Client")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-4xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("New Client")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {/* Names */}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("First Name")} required>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder={t("Enter First Name")} />
            </Field>
            <Field label={t("Middle Name")}>
              <Input value={form.middleName} onChange={(e) => set("middleName", e.target.value)} placeholder={t("Enter Middle Name")} />
            </Field>
            <Field label={t("Last Name")} required>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder={t("Enter Last Name")} />
            </Field>
          </div>

          {/* Birth date + phone */}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("Birth Date")} required>
              <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            </Field>
            <Field label={t("Country Code")} required>
              <Select value={form.countryCode} onValueChange={(v) => set("countryCode", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("Phone Number")} required>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={t("Enter Phone Number")} inputMode="tel" dir="ltr" />
            </Field>
          </div>

          {/* ID / phone2 / email */}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("ID")}>
              <Input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} placeholder={t("Enter Client's Id")} />
            </Field>
            <Field label={t("Phone Number 2")}>
              <Input value={form.phone2} onChange={(e) => set("phone2", e.target.value)} placeholder={t("Enter Phone Number 2")} inputMode="tel" dir="ltr" />
            </Field>
            <Field label={t("Email")}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("Enter Email Address")} />
            </Field>
          </div>

          {/* Gender + messaging */}
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-[#595959]">{t("Gender")}</span>
              <RadioGroup
                className="flex flex-row gap-4"
                value={form.gender}
                onValueChange={(v) => set("gender", v as NewClientInput["gender"])}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="male" id="gender-male" />
                  <Label htmlFor="gender-male" className="font-normal">{t("Male")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="female" id="gender-female" />
                  <Label htmlFor="gender-female" className="font-normal">{t("Female")}</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#595959]">{t("Messaging Service")}</span>
              <Switch checked={form.messagingService} onCheckedChange={(v) => set("messagingService", v)} />
            </div>
          </div>

          {/* City + address */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("City")}>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Enter City Name")} />
            </Field>
            <Field label={t("Address")}>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={t("Enter Address")} />
            </Field>
          </div>

          <Field label={t("Notes")}>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("Write a Note")} rows={3} />
          </Field>

          {/* Phase 2: welcome SMS isn't wired to a provider yet — disabled. */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#595959]">{t("Send Welcome Message")}</span>
            <Switch checked={false} disabled onCheckedChange={() => {}} />
            <span className="text-xs text-muted-foreground">{t("Coming soon")}</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("Adding…") : t("Add")} <SendHorizontal className="size-4" />
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
