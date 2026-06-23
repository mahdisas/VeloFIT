"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2 } from "lucide-react";

import { getSubscriptionEvents, type SubscriptionEvent } from "@/app/(app)/clients/client-actions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ClientSubscription } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";

function fmt(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const COLUMNS = ["Date", "Action", "Details", "By"];

/** Right-side drawer showing a subscription's REAL change history (creation,
 * payments + their documents, renewal/expiry) — fetched on open, tenant-scoped. */
export function SubscriptionHistoryDialog({
  subscription,
  children,
}: {
  subscription: ClientSubscription;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [events, setEvents] = React.useState<SubscriptionEvent[] | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Fetch real events the first time the drawer opens.
  React.useEffect(() => {
    if (!open || events !== null) return;
    startTransition(async () => {
      setEvents(await getSubscriptionEvents(subscription.id));
    });
  }, [open, events, subscription.id]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg lg:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("Subscription history")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-[#595959]">{t("Group")}:</span>
            <span dir="auto" className="font-medium">{subscription.group}</span>
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead key={c}>
                      <span className="flex items-center gap-1 font-medium text-muted-foreground">
                        {t(c)} <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending || events === null ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">
                      {t("No data available in the table")}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{fmt(e.date)}</TableCell>
                      <TableCell>{t(e.action)}</TableCell>
                      <TableCell><span dir="auto">{t(e.details)}</span></TableCell>
                      <TableCell className="text-muted-foreground">{t(e.by)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
