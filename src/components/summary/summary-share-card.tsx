import { Award, Dumbbell, Flame, Infinity as InfinityIcon, Zap } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand";
import {
  type SummaryData,
  type SummaryLanguage,
  type SummaryParams,
  type SummaryToggles,
} from "@/lib/summary";
import { cn } from "@/lib/utils";

/**
 * The shareable "Celebrating Your Success" card. Pure presentation: given the
 * summary figures, the active period/language and which rows are toggled on, it
 * renders the blue gradient card exactly as exported to social.
 *
 * Templates carry a single "{v}" placeholder so the value can be bolded
 * regardless of where it sits in the sentence (start in EN trainees row, end in
 * the lessons row). RTL languages flip text direction automatically.
 */

type Templates = {
  celebrate: string;
  summaryYear: string; // "{y}"
  summaryMonth: string; // "{m}"
  thisPeriod: { year: string; month: string };
  trainees: { year: string; month: string };
  lessons: { year: string; month: string };
  mostRequestedClass: string;
  mostRegisteredTrainee: string;
};

const STRINGS: Record<SummaryLanguage, Templates> = {
  en: {
    celebrate: "Celebrating Your Success",
    summaryYear: "Summary Of {y}",
    summaryMonth: "Summary for {m}",
    thisPeriod: { year: "this year", month: "this month" },
    trainees: {
      year: "{v} trainees have registered for all the lessons this year",
      month: "{v} trainees have registered for all the lessons this month",
    },
    lessons: {
      year: "Total Lessons This Year {v}",
      month: "Total Lessons This Month {v}",
    },
    mostRequestedClass: "The most requested class was {v}",
    mostRegisteredTrainee: "Most Registered Trainee {v}",
  },
  he: {
    celebrate: "חוגגים את ההצלחה שלך",
    summaryYear: "סיכום שנת {y}",
    summaryMonth: "סיכום לחודש {m}",
    thisPeriod: { year: "השנה", month: "החודש" },
    trainees: {
      year: "{v} מתאמנים נרשמו לכל השיעורים השנה",
      month: "{v} מתאמנים נרשמו לכל השיעורים החודש",
    },
    lessons: {
      year: "סך השיעורים השנה {v}",
      month: "סך השיעורים החודש {v}",
    },
    mostRequestedClass: "החוג המבוקש ביותר היה {v}",
    mostRegisteredTrainee: "המתאמן הרשום ביותר {v}",
  },
  ar: {
    celebrate: "نحتفل بنجاحك",
    summaryYear: "ملخص عام {y}",
    summaryMonth: "ملخص لشهر {m}",
    thisPeriod: { year: "هذا العام", month: "هذا الشهر" },
    trainees: {
      year: "{v} متدرب سجّلوا في كل الحصص هذا العام",
      month: "{v} متدرب سجّلوا في كل الحصص هذا الشهر",
    },
    lessons: {
      year: "إجمالي الحصص هذا العام {v}",
      month: "إجمالي الحصص هذا الشهر {v}",
    },
    mostRequestedClass: "الحصة الأكثر طلبًا كانت {v}",
    mostRegisteredTrainee: "المتدرب الأكثر تسجيلًا {v}",
  },
};

/** Split a "{v}" template and render the value in bold. */
function withValue(template: string, value: React.ReactNode) {
  const [before, after] = template.split("{v}");
  return (
    <>
      {before}
      <span className="font-bold">{value}</span>
      {after}
    </>
  );
}

const ROW_ICONS = {
  trainees: { Icon: InfinityIcon, color: "bg-sky-500" },
  lessons: { Icon: Zap, color: "bg-violet-500" },
  mostRequestedClass: { Icon: Flame, color: "bg-orange-500" },
  mostRegisteredTrainee: { Icon: Award, color: "bg-rose-500" },
} as const;

function StatRow({
  icon,
  rtl,
  children,
}: {
  icon: keyof typeof ROW_ICONS;
  rtl: boolean;
  children: React.ReactNode;
}) {
  const { Icon, color } = ROW_ICONS[icon];
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5",
          color
        )}
      >
        <Icon className="size-5" />
      </span>
      <span
        dir={rtl ? "rtl" : "ltr"}
        className={cn("flex-1 text-sm leading-snug text-slate-700", rtl ? "text-right" : "text-left")}
      >
        {children}
      </span>
    </li>
  );
}

export function SummaryShareCard({
  data,
  params,
  toggles,
}: {
  data: SummaryData;
  params: SummaryParams;
  toggles: SummaryToggles;
}) {
  const t = STRINGS[params.language];
  const rtl = params.language === "he" || params.language === "ar";
  const isYear = params.period === "year";
  const monthLabel = `${String(params.month).padStart(2, "0")}/${params.year}`;
  const periodHeading = isYear
    ? t.summaryYear.replace("{y}", String(params.year))
    : t.summaryMonth.replace("{m}", monthLabel);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-950/25">
      {/* Decorative glows for depth */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-14 size-52 rounded-full bg-indigo-300/20 blur-3xl" />

      {/* Gym badge */}
      <div className="relative flex flex-col items-center gap-2.5">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 shadow-lg ring-4 ring-white/25">
          <Dumbbell className="size-7 -rotate-45" />
        </div>
        <p className="flex items-center gap-1.5 text-center text-2xl font-extrabold tracking-tight drop-shadow-sm" dir={rtl ? "rtl" : "ltr"}>
          {t.celebrate} <span aria-hidden>🏆</span>
        </p>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/95 ring-1 ring-white/20 backdrop-blur">
          {periodHeading}
        </span>
      </div>

      {/* Stats panel */}
      <ul className="relative mt-6 flex flex-col divide-y divide-slate-100 rounded-2xl bg-white p-5 shadow-lg">
        {toggles.totalTrainees && (
          <StatRow icon="trainees" rtl={rtl}>
            {withValue(t.trainees[isYear ? "year" : "month"], data.totalTrainees)}
          </StatRow>
        )}
        {toggles.totalLessons && (
          <StatRow icon="lessons" rtl={rtl}>
            {withValue(t.lessons[isYear ? "year" : "month"], data.totalLessons)}
          </StatRow>
        )}
        {toggles.mostRequestedClass && (
          <StatRow icon="mostRequestedClass" rtl={rtl}>
            {withValue(
              t.mostRequestedClass,
              <span dir="auto">{data.mostRequestedClass}</span>
            )}
          </StatRow>
        )}
        {toggles.mostRegisteredTrainee && (
          <StatRow icon="mostRegisteredTrainee" rtl={rtl}>
            {withValue(
              t.mostRegisteredTrainee,
              <span dir="auto">{data.mostRegisteredTrainee}</span>
            )}
          </StatRow>
        )}
      </ul>

      {/* Brand footer */}
      <div className="relative mt-5 flex items-center justify-center rounded-2xl bg-white/95 py-3 shadow-sm">
        <BrandLogo />
      </div>
    </div>
  );
}
