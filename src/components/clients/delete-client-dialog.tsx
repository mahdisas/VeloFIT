"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { archiveClient } from "@/app/(app)/clients/client-actions";
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
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Confirm + archive a client (soft delete → status 'archived'), then refresh. */
export function DeleteClientDialog({
  clientId,
  clientName,
  children,
}: {
  clientId: string;
  clientName: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onConfirm = () =>
    startTransition(async () => {
      const result = await archiveClient(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("Client archived"));
      router.refresh();
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Archive client?")}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir="auto" className="font-medium text-foreground">{clientName}</span>{" "}
            {t("will be moved to Archive · Clients and hidden from the active list. You can restore them later.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {pending ? t("Archiving…") : t("Archive")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
