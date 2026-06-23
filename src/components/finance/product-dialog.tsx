"use client";

import * as React from "react";
import Link from "next/link";
import { SendHorizontal } from "lucide-react";

import { saveProduct } from "@/app/(app)/finance/products/actions";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";
import { type Product } from "@/lib/finance/products";
import { type IdName } from "@/lib/classes";

type FormValues = {
  categoryId: string;
  price: string;
  name: string;
  description: string;
  showInApp: boolean;
};

function seed(product?: Product): FormValues {
  return {
    categoryId: product?.categoryId ?? "",
    price: product ? String(product.price) : "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    showInApp: product?.showInApp ?? true,
  };
}

/** Add / Edit Product drawer. `product` present → edit mode. */
export function ProductDialog({
  product,
  categoryOptions,
  onSaved,
  children,
}: {
  product?: Product;
  categoryOptions: IdName[];
  onSaved: (product: Product) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(product));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(product));
      setError(null);
    }
  }, [open, product]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(product);
  const hasCategories = categoryOptions.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.categoryId) {
      setError(t("Category is required."));
      return;
    }
    if (!form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    startTransition(async () => {
      const result = await saveProduct({
        id: product?.id,
        name: form.name,
        categoryId: form.categoryId,
        price: Number(form.price) || 0,
        showInApp: form.showInApp,
        description: form.description,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        name: form.name,
        categoryId: form.categoryId,
        categoryName: categoryOptions.find((c) => c.id === form.categoryId)?.name ?? "",
        price: Number(form.price) || 0,
        showInApp: form.showInApp,
        description: form.description,
        imageUrl: product?.imageUrl ?? null,
        isActive: product?.isActive ?? true,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit product") : t("New product")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("Category")}>
                {hasCategories ? (
                  <Select value={form.categoryId || undefined} onValueChange={(v) => set("categoryId", v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={t("Choose category")} /></SelectTrigger>
                    <SelectContent position="popper" align="start" sideOffset={4}>
                      {categoryOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}><span dir="auto">{o.name}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <div className="flex h-9 w-full items-center rounded-md border border-destructive/60 bg-transparent px-3 text-sm text-muted-foreground" />
                    <p className="text-xs text-destructive">
                      {t("No Categories,")}{" "}
                      <Link href="/finance/categories" className="font-medium underline hover:no-underline">{t("Create here")}</Link>
                    </p>
                  </>
                )}
              </Field>
              <Field label={t("Price")}>
                <Input type="number" min={0} step="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <Field label={t("Name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Enter name")} dir="auto" />
            </Field>

            <Field label={t("Description")}>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Enter description")} rows={3} dir="auto" />
            </Field>

            <div className="flex items-center gap-3">
              <span className="text-sm text-[#595959]">{t("Show in app")}</span>
              <Switch checked={form.showInApp} onCheckedChange={(v) => set("showInApp", v)} />
            </div>

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
