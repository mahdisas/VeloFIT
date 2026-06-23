"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, MapPin, User } from "lucide-react";

import { saveBusinessDetails, uploadGymLogo } from "@/app/(app)/business-details/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type BusinessDetails } from "@/lib/business";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type FormValues = BusinessDetails;

export function BusinessDetailsForm({ details }: { details: BusinessDetails }) {
  const t = useT();
  const [form, setForm] = React.useState<FormValues>({ ...details });
  const [locating, setLocating] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("Geolocation is not supported on this device"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        set("location", `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setLocating(false);
        toast.success(t("Location captured"));
      },
      () => {
        setLocating(false);
        toast.error(t("Couldn't get your location"));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessDetails({
        name: form.name,
        email: form.email,
        phone: form.phone,
        whatsapp: form.whatsapp,
        location: form.location,
        facebookUrl: form.facebookUrl,
        instagramUrl: form.instagramUrl,
        tiktokUrl: form.tiktokUrl,
        description: form.description,
        vatRate: form.vatRate,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("Business details saved"));
    });
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          <LogoDropzone logoUrl={form.logoUrl} onUploaded={(url) => set("logoUrl", url)} />

          <div className="flex flex-1 flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Business name")} dir="auto" />
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("Email")} />

              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={t("Phone Number")} />
              <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder={t("Whatsapp Number")} />

              <div className="flex gap-2">
                <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={t("Location")} dir="auto" className="flex-1" />
                <Button type="button" onClick={getCurrentLocation} disabled={locating} className="shrink-0 gap-1.5">
                  {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                  {t("Get Current Location")}
                </Button>
              </div>
              <Input value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder={t("Facebook URL")} />

              <Input value={form.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder={t("Instagram URL")} />
              <Input value={form.tiktokUrl} onChange={(e) => set("tiktokUrl", e.target.value)} placeholder={t("TikTok URL")} />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("VAT rate (%)")}</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={String(form.vatRate)}
                  onChange={(e) => set("vatRate", e.target.value === "" ? 0 : Number(e.target.value))}
                  placeholder={t("VAT rate (%)")}
                />
              </div>
            </div>

            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Description")} rows={4} dir="auto" />

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="min-w-24">
                {pending ? t("Saving…") : t("Save")}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Logo dropzone — uploads to Supabase Storage on select and shows a preview. */
function LogoDropzone({ logoUrl, onUploaded }: { logoUrl: string | null; onUploaded: (url: string) => void }) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const upload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadGymLogo(fd);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onUploaded(result.url);
    toast.success(t("Logo uploaded"));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void upload(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "flex w-full shrink-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors lg:w-64",
        dragOver ? "border-primary bg-accent" : "border-input hover:border-primary/50"
      )}
    >
      <div className="relative grid size-36 place-content-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {uploading ? (
          <Loader2 className="size-10 animate-spin" />
        ) : logoUrl ? (
          <Image src={logoUrl} alt="Gym logo" fill sizes="144px" className="object-cover" />
        ) : (
          <User className="size-16" strokeWidth={1.5} />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold">{t("Logo image")}</p>
        <p className="text-xs text-primary">{uploading ? t("Uploading…") : logoUrl ? t("Click to replace") : t("Drag & Drop or click")}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </div>
  );
}
