"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { fetchSummary } from "@/app/(app)/summary/actions";
import { SummaryShareCard } from "@/components/summary/summary-share-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_TOGGLES,
  SUMMARY_LANGUAGES,
  type SummaryData,
  type SummaryLanguage,
  type SummaryParams,
  type SummaryToggles,
  summaryMonths,
  summaryYears,
} from "@/lib/summary";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const TOGGLE_FIELDS: { key: keyof SummaryToggles; label: (isYear: boolean) => string }[] = [
  { key: "totalTrainees", label: () => "Total Trainees" },
  {
    key: "totalLessons",
    label: (isYear) => (isYear ? "Total Lessons This Year" : "Total Lessons This Month"),
  },
  { key: "mostRequestedClass", label: () => "The most requested class was" },
  { key: "mostRegisteredTrainee", label: () => "Most Registered Trainee" },
];

export function SummaryBuilder({
  initialParams,
  initialData,
}: {
  initialParams: SummaryParams;
  initialData: SummaryData;
}) {
  const t = useT();
  const [params, setParams] = React.useState<SummaryParams>(initialParams);
  const [toggles, setToggles] = React.useState<SummaryToggles>(DEFAULT_TOGGLES);
  const [data, setData] = React.useState<SummaryData>(initialData);
  const [isPending, startTransition] = React.useTransition();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);

  // Render the share card to a PNG and trigger a browser download.
  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const period = params.period === "year" ? String(params.year) : `${String(params.month).padStart(2, "0")}-${params.year}`;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `velofit-summary-${period}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const years = React.useMemo(() => summaryYears(), []);
  const months = React.useMemo(() => summaryMonths(), []);
  const isYear = params.period === "year";

  // Refetch whenever the period/language changes. Skip the first run — the
  // server already provided initialData for initialParams.
  const firstRun = React.useRef(true);
  const key = `${params.period}|${params.year}|${params.month}|${params.language}`;
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    startTransition(async () => {
      setData(await fetchSummary(params));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const patch = (next: Partial<SummaryParams>) =>
    setParams((prev) => ({ ...prev, ...next }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Details panel */}
      <Card>
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-semibold">{t("Details")}</h2>

          <RadioGroup
            className="flex flex-row gap-6"
            value={params.period}
            onValueChange={(value) => patch({ period: value as SummaryParams["period"] })}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="year" id="period-year" />
              <Label htmlFor="period-year" className="font-normal">{t("Year")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="month" id="period-month" />
              <Label htmlFor="period-month" className="font-normal">{t("Month")}</Label>
            </div>
          </RadioGroup>

          {isYear ? (
            <Field label={t("Select a year")}>
              <Select
                value={String(params.year)}
                onValueChange={(value) => patch({ year: Number(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label={t("Select a month")}>
              <Select
                value={`${String(params.month).padStart(2, "0")}/${params.year}`}
                onValueChange={(value) => {
                  const [mm, yyyy] = value.split("/");
                  patch({ month: Number(mm), year: Number(yyyy) });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label={t("Language")}>
            <Select
              value={params.language}
              onValueChange={(value) => patch({ language: value as SummaryLanguage })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUMMARY_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex flex-col gap-3 border-t pt-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("Include in the card")}
            </span>
            {TOGGLE_FIELDS.map((field) => (
              <Label
                key={field.key}
                htmlFor={`toggle-${field.key}`}
                className="flex cursor-pointer items-center gap-2.5 font-normal"
              >
                <Checkbox
                  id={`toggle-${field.key}`}
                  checked={toggles[field.key]}
                  onCheckedChange={(checked) =>
                    setToggles((prev) => ({ ...prev, [field.key]: checked === true }))
                  }
                />
                {t(field.label(isYear))}
              </Label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Share preview */}
      <div className="flex flex-col gap-3 self-start lg:sticky lg:top-6">
        <p className="text-sm text-muted-foreground">
          {t("Share your fitness journey with us! Don't forget to tag us @velofit_app")}
        </p>
        <Button size="lg" className="w-full gap-2" onClick={downloadImage} disabled={downloading}>
          <Download className="size-4" /> {downloading ? t("Preparing…") : t("Download Image")}
        </Button>
        <div ref={cardRef} className={cn("mx-auto w-full max-w-sm transition-opacity", isPending && "opacity-60")}>
          <SummaryShareCard data={data} params={params} toggles={toggles} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
