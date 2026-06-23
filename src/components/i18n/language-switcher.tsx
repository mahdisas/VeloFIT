"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";

import { setLocale } from "@/lib/i18n/actions";
import { dirFor, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Topbar language picker — switches locale (cookie) and applies RTL immediately. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale();
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    // Apply direction/lang instantly for snappy feedback; the cookie + refresh
    // make it authoritative (root layout re-renders <html lang dir>).
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={className ?? "text-muted-foreground"}
              aria-label={t("Language")}
              disabled={pending}
            >
              <Globe className="size-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("Language")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => choose(locale)}
            className="cursor-pointer justify-between"
          >
            <span>{LOCALE_LABELS[locale]}</span>
            {locale === current && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
