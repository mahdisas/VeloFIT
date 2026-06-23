"use client";

import * as React from "react";
import { SendHorizontal, UploadCloud } from "lucide-react";

import { saveClassKind } from "@/app/(app)/classes/kinds/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { type ClassKind } from "@/lib/class-kinds";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type FormValues = {
  name: string;
  minParticipants: string;
  maxParticipants: string;
  description: string;
  imageName: string;
};

function seed(kind?: ClassKind): FormValues {
  return {
    name: kind?.name ?? "",
    minParticipants: kind ? String(kind.minParticipants) : "",
    maxParticipants: kind ? String(kind.maxParticipants) : "",
    description: kind?.description ?? "",
    imageName: "",
  };
}

/** Add / Edit Class Kind drawer. `kind` present → edit mode. */
export function ClassKindDialog({
  kind,
  onSaved,
  children,
}: {
  kind?: ClassKind;
  onSaved: (kind: ClassKind) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(kind));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(kind));
      setError(null);
    }
  }, [open, kind]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(kind);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    startTransition(async () => {
      const result = await saveClassKind({
        id: kind?.id,
        name: form.name,
        description: form.description,
        minParticipants: Number(form.minParticipants) || 0,
        maxParticipants: Number(form.maxParticipants) || 0,
        imageName: form.imageName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        name: form.name,
        description: form.description,
        minParticipants: Number(form.minParticipants) || 0,
        maxParticipants: Number(form.maxParticipants) || 0,
        imageUrl: kind?.imageUrl ?? null,
        isActive: kind?.isActive ?? true,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit class kind") : t("Add Class Kind")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={t("Name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Name")} dir="auto" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("Min Participants")}>
                <Input type="number" min={0} value={form.minParticipants} onChange={(e) => set("minParticipants", e.target.value)} />
              </Field>
              <Field label={t("Max Participants")}>
                <Input type="number" min={0} value={form.maxParticipants} onChange={(e) => set("maxParticipants", e.target.value)} />
              </Field>
            </div>

            <Field label={t("Description")}>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Description")} rows={3} dir="auto" />
            </Field>

            <ImageDropzone fileName={form.imageName} onFile={(name) => set("imageName", name)} />

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

function ImageDropzone({ fileName, onFile }: { fileName: string; onFile: (name: string) => void }) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

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
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f.name);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/40 px-4 py-8 text-center transition-colors",
        dragOver ? "border-primary bg-accent" : "border-input hover:border-primary/50"
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" />
      <p className="text-sm font-semibold">{fileName || t("Upload image")}</p>
      <p className="text-xs text-muted-foreground">
        {fileName ? t("Click to choose a different file") : t("Drag drop some file here, or click to select file")}
      </p>
      <p className="text-xs text-muted-foreground">{t("Only *.jpeg and *.png images will be accepted")}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0]?.name ?? "")}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
