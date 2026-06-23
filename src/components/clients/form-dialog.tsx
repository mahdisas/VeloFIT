"use client";

import * as React from "react";
import { SendHorizontal, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";

export type FormFieldValue = string | boolean;

export type FormField =
  | { name: string; label: string; type: "text" | "number" | "date" | "textarea" | "file"; placeholder?: string; required?: boolean; defaultValue?: string; accept?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string }
  | { name: string; label: string; type: "checkbox"; defaultValue?: boolean };

function seed(fields: FormField[]): Record<string, FormFieldValue> {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.type === "checkbox" ? Boolean(f.defaultValue) : f.defaultValue ?? ""])
  );
}

/**
 * Field-driven create/edit form that slides in from the right as a drawer
 * (matching the reference "Add Document" panel). Works with a trigger
 * (`children`) or controlled via `open`/`onOpenChange`. The `columns` prop is
 * accepted for API compatibility but the drawer always stacks fields.
 */
export function FormDialog({
  title,
  description,
  fields,
  submitLabel = "Save",
  onSubmit,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  columns?: 1 | 2 | 3;
  onSubmit: (values: Record<string, FormFieldValue>) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useT();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (o: boolean) => (isControlled ? onOpenChange?.(o) : setInternalOpen(o));

  const [values, setValues] = React.useState<Record<string, FormFieldValue>>(seed(fields));

  React.useEffect(() => {
    if (isOpen) setValues(seed(fields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const set = (name: string, value: FormFieldValue) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
    setOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t(title)}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {fields.map((field) => {
              if (field.type === "checkbox") {
                return (
                  <label key={field.name} className="flex items-center gap-2.5">
                    <Checkbox
                      checked={Boolean(values[field.name])}
                      onCheckedChange={(c) => set(field.name, c === true)}
                    />
                    <span className="text-sm text-[#595959]">{t(field.label)}</span>
                  </label>
                );
              }
              return (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#595959]">
                    {t(field.label)}
                    {"required" in field && field.required && <span className="text-destructive"> *</span>}
                  </span>
                  {field.type === "select" ? (
                    <Select value={String(values[field.name] ?? "")} onValueChange={(v) => set(field.name, v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder={t("Select…")} /></SelectTrigger>
                      <SelectContent>
                        {field.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      value={String(values[field.name] ?? "")}
                      onChange={(e) => set(field.name, e.target.value)}
                      placeholder={field.placeholder ? t(field.placeholder) : undefined}
                      rows={3}
                    />
                  ) : field.type === "file" ? (
                    <FileDropzone
                      accept={field.accept}
                      fileName={String(values[field.name] ?? "")}
                      onFile={(name) => set(field.name, name)}
                    />
                  ) : (
                    <Input
                      type={field.type}
                      value={String(values[field.name] ?? "")}
                      onChange={(e) => set(field.name, e.target.value)}
                      placeholder={field.placeholder ? t(field.placeholder) : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit">{t(submitLabel)} <SendHorizontal className="size-4" /></Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Dashed "Browse File" dropzone with click-to-select and drag-and-drop. */
function FileDropzone({
  accept,
  fileName,
  onFile,
}: {
  accept?: string;
  fileName: string;
  onFile: (name: string) => void;
}) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f.name);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
        dragOver ? "border-primary bg-accent" : "border-input hover:border-primary/50"
      }`}
    >
      <UploadCloud className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{fileName || t("Browse File")}</p>
      <p className="text-xs text-muted-foreground">
        {fileName ? t("Click to choose a different file") : t("Drag drop some file here, or click to select file")}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0]?.name ?? "")}
      />
    </div>
  );
}
