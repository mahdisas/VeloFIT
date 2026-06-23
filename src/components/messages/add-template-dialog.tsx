"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { createTemplate, updateTemplate } from "@/app/(app)/messages/actions";
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
import { useT } from "@/lib/i18n/provider";
import { type MessageTemplate } from "@/lib/messages";

/**
 * Add / Edit message template drawer (Title + Content). `template` present →
 * edit mode. `onSaved` receives the created/updated row for an optimistic list.
 */
export function AddTemplateDialog({
  template,
  onSaved,
  children,
}: {
  template?: MessageTemplate;
  onSaved: (template: MessageTemplate) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const isEdit = Boolean(template);
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setTitle(template?.title ?? "");
      setContent(template?.content ?? "");
      setError(null);
    }
  }, [open, template]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t("Title is required."));
      return;
    }
    startTransition(async () => {
      const result =
        isEdit && template
          ? await updateTemplate(template.id, { title, content })
          : await createTemplate({ title, content });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({ id: result.id, title, content });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit message template") : t("Add new message template")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#595959]">{t("Title")}</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Message template title")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#595959]">{t("Content")}</span>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("Message template content")} rows={4} dir="auto" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving…") : isEdit ? t("Update") : t("Add")} <SendHorizontal className="size-4" />
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
