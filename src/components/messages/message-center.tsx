"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, SendHorizontal, Trash2 } from "lucide-react";

import { deleteTemplate, sendBroadcast } from "@/app/(app)/messages/actions";
import { AddTemplateDialog } from "@/components/messages/add-template-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";
import {
  type GroupOption,
  type MessageTemplate,
  NAME_PLACEHOLDER,
  SUBSCRIPTION_TYPES,
  smsInfo,
} from "@/lib/messages";
import { cn } from "@/lib/utils";

export function MessageCenter({
  groups,
  initialTemplates,
}: {
  groups: GroupOption[];
  initialTemplates: MessageTemplate[];
}) {
  const tr = useT();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("all");
  const [subscriptionType, setSubscriptionType] = React.useState("all");
  const [message, setMessage] = React.useState("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filteredTemplates = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
    );
  }, [templates, query]);

  const { remaining, messages } = smsInfo(message);

  const onSend = () =>
    startTransition(async () => {
      const result = await sendBroadcast({ group, subscriptionType, message });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(tr("Message sent to {n} recipients", { n: result.recipients }));
      setMessage("");
      setSelectedTemplate(null);
    });

  // Upsert a created/updated template into the list (newest-first for new ones).
  const onTemplateSaved = (tpl: MessageTemplate) =>
    setTemplates((prev) =>
      prev.some((t) => t.id === tpl.id) ? prev.map((t) => (t.id === tpl.id ? tpl : t)) : [tpl, ...prev]
    );

  const onDeleteTemplate = (id: string) =>
    startTransition(async () => {
      const result = await deleteTemplate(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedTemplate === id) setSelectedTemplate(null);
      toast.success(tr("Template deleted"));
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <h2 className="font-semibold">{tr("Classes Subscriptions")}</h2>

        <div className="grid grid-cols-1 overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:grid-cols-[16rem_1fr]">
          {/* Templates panel */}
          <div className="flex flex-col gap-3 border-b p-4 lg:border-e lg:border-b-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{tr("Messages Templates")}</h3>
              <span className="flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                {templates.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("Search in messages")}
                className="ps-9"
              />
            </div>

            <ul className="flex flex-col gap-1.5">
              {filteredTemplates.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {tr("No templates yet.")}
                </li>
              ) : (
                filteredTemplates.map((t) => (
                  <li key={t.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(t.content);
                        setSelectedTemplate(t.id);
                      }}
                      className={cn(
                        "w-full rounded-lg border p-2.5 pe-14 text-start transition-colors hover:border-primary/50 hover:bg-accent",
                        selectedTemplate === t.id ? "border-primary bg-accent" : "border-border"
                      )}
                    >
                      <p className="truncate text-sm font-medium" dir="auto">{t.title}</p>
                      <p dir="auto" className="truncate text-xs text-muted-foreground">{t.content}</p>
                    </button>
                    {/* Edit / delete — revealed on hover/focus */}
                    <div className="absolute top-1/2 end-1.5 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <AddTemplateDialog template={t} onSaved={onTemplateSaved}>
                        <button type="button" aria-label={tr("Edit template")} className="grid size-7 place-content-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-primary">
                          <Pencil className="size-3.5" />
                        </button>
                      </AddTemplateDialog>
                      <DeleteTemplate name={t.title} onConfirm={() => onDeleteTemplate(t.id)} />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Composer */}
          <div className="flex flex-col gap-4 p-4 md:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Labeled label={tr("Group")}>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        <span dir="auto">{tr(g.label)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Labeled>
              <Labeled label={tr("Subscription type")}>
                <Select value={subscriptionType} onValueChange={setSubscriptionType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTION_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{tr(s.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Labeled>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {tr("If you want to add client name please add this Phrase")}{" "}
                <span className="font-medium text-foreground">{NAME_PLACEHOLDER}</span>
              </p>
              <AddTemplateDialog onSaved={onTemplateSaved}>
                <Button>
                  <Plus className="size-4" /> {tr("Add Template")}
                </Button>
              </AddTemplateDialog>
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={tr("Write SMS message here..")}
              dir="auto"
              className="min-h-64 resize-y"
            />

            <div className="text-end text-sm text-muted-foreground">
              <p>{remaining} {tr("Remaining characters")}</p>
              <p>{messages} {tr("Message")}</p>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSend} disabled={pending || message.trim().length === 0}>
                {pending ? tr("Sending…") : tr("Send")} <SendHorizontal className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Trash trigger + confirm dialog for deleting a saved template. */
function DeleteTemplate({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const tr = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" aria-label={tr("Delete template")} className="grid size-7 place-content-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Delete template?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {tr("This will permanently remove")}{" "}
            <span dir="auto" className="font-medium text-foreground">{name}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {tr("Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Select with a small blue label above, matching the reference's floating labels. */
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-primary">{label}</span>
      {children}
    </div>
  );
}
