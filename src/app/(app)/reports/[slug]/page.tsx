import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassesAbsenceReport } from "@/components/reports/classes-absence-report";
import { ClassesExpireReport } from "@/components/reports/classes-expire-report";
import { ClassesMainReport } from "@/components/reports/classes-main-report";
import { ClassesRenewalReport } from "@/components/reports/classes-renewal-report";
import { CreditCardReport } from "@/components/reports/credit-card-report";
import { DirectDebitReport } from "@/components/reports/direct-debit-report";
import { DocumentReport, type DocumentReportParams } from "@/components/reports/document-report";
import { FinanceChargesReport } from "@/components/reports/finance-charges-report";
import { NoEnrollmentsReport } from "@/components/reports/no-enrollments-report";
import { OrdersReport, type OrdersReportParams } from "@/components/reports/orders-report";
import { PaymentsReport, type PaymentsReportParams } from "@/components/reports/payments-report";
import type { PaymentMethod } from "@/lib/reports/finance-payments";
import { SoldItemsReport, type SoldItemsReportParams } from "@/components/reports/sold-items-report";
import { BirthdaysReport } from "@/components/reports/birthdays-report";
import { EmployeePresenceReport } from "@/components/reports/employee-presence-report";
import { InactiveClientsReport } from "@/components/reports/inactive-clients-report";
import { LeadsReport } from "@/components/reports/leads-report";
import { MessagesReportView } from "@/components/reports/messages-report-view";
import { NewSubscriptionsReport } from "@/components/reports/new-subscriptions-report";
import { SubscriptionsBalanceReport } from "@/components/reports/subscriptions-balance-report";
import { TrainerHoursReport } from "@/components/reports/trainer-hours-report";
import {
  getBalanceRows,
  getBirthdays,
  getClassesAbsenceReport,
  getCreditCardTransactions,
  getDirectDebitRows,
  getEmployeeOptions,
  getEmployeePresence,
  getFinanceCharges,
  getFinanceDocuments,
  getFinancePayments,
  getInactiveClients,
  getLeads,
  getMessages,
  getNewSubscriptions,
  getNoEnrollmentRows,
  getOrders,
  getRenewalRows,
  getReportTrainers,
  getSoldItems,
  getSoldItemsTrainerOptions,
  getSoldPackageOptions,
  getSoldProductOptions,
  getSubscriptionRows,
  getTrainerHours,
} from "@/lib/reports/server";
import { ALL_REPORTS, getReport } from "@/lib/reports";
import { getT } from "@/lib/i18n/server";

type ReportSearchParams = { [key: string]: string | string[] | undefined };

const PAGE_SIZES = [10, 25, 50];
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

/** Resolve the Finance Documents report state from the URL search params. */
function docParams(sp: ReportSearchParams): DocumentReportParams {
  const typesRaw = first(sp.types);
  const size = Number(first(sp.size));
  return {
    search: first(sp.q),
    // key absent ⇒ all types; present ⇒ the (possibly empty) selected subset.
    docTypes: sp.types === undefined ? null : typesRaw.split(",").filter(Boolean),
    from: first(sp.from),
    to: first(sp.to),
    sort: first(sp.sort) || "date",
    dir: first(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(first(sp.page)) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : 10,
  };
}

const ALL_METHODS: PaymentMethod[] = ["cash", "creditCard", "cheques", "bankTransfer"];

/** Resolve the Finance Payments report state from the URL search params. */
function payParams(sp: ReportSearchParams): PaymentsReportParams {
  const methodsRaw = first(sp.methods);
  const size = Number(first(sp.size));
  return {
    search: first(sp.q),
    methods:
      sp.methods === undefined
        ? null
        : (methodsRaw.split(",").filter((m): m is PaymentMethod => (ALL_METHODS as string[]).includes(m))),
    from: first(sp.from),
    to: first(sp.to),
    sort: first(sp.sort) || "date",
    dir: first(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(first(sp.page)) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : 10,
  };
}

/** Resolve the Sold-items report state (kind comes from the slug, not the URL). */
function soldParams(sp: ReportSearchParams): Omit<SoldItemsReportParams, "kind"> {
  const size = Number(first(sp.size));
  return {
    search: first(sp.q),
    item: first(sp.item),
    byUser: first(sp.trainer),
    from: first(sp.from),
    to: first(sp.to),
    sort: first(sp.sort) || "date",
    dir: first(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(first(sp.page)) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : 10,
  };
}

/** Resolve the Orders report state from the URL search params. */
function ordersParams(sp: ReportSearchParams): OrdersReportParams {
  const size = Number(first(sp.size));
  const status = first(sp.status);
  return {
    search: first(sp.q),
    status: ["completed", "pending", "cancelled"].includes(status) ? status : "all",
    from: first(sp.from),
    to: first(sp.to),
    sort: first(sp.sort) || "date",
    dir: first(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(first(sp.page)) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : 10,
  };
}

/** slug → builder. Adding a report is one entry here plus its component + data. */
const RENDERERS: Record<string, (sp: ReportSearchParams) => Promise<React.ReactNode>> = {
  // Classes
  "classes-main": async () => <ClassesMainReport data={await getSubscriptionRows()} />,
  "classes-expire": async () => <ClassesExpireReport data={await getSubscriptionRows()} />,
  "classes-absence": async () => <ClassesAbsenceReport data={await getClassesAbsenceReport()} />,
  "classes-renewal": async () => <ClassesRenewalReport data={await getRenewalRows()} />,
  "subscriptions-no-enrollments": async () => <NoEnrollmentsReport data={await getNoEnrollmentRows()} />,
  "subscriptions-balance": async () => <SubscriptionsBalanceReport data={await getBalanceRows()} />,
  "direct-debit-subscriptions": async () => <DirectDebitReport data={await getDirectDebitRows()} />,
  // Finance
  "finance-document": async (sp) => {
    const p = docParams(sp);
    const data = await getFinanceDocuments(p);
    return <DocumentReport {...data} params={p} filename="finance-document-report.csv" showInitiatedBy />;
  },
  "finance-charges": async () => <FinanceChargesReport charges={await getFinanceCharges()} />,
  "finance-payments": async (sp) => {
    const p = payParams(sp);
    const data = await getFinancePayments(p);
    return <PaymentsReport {...data} params={p} filename="finance-payments-report" />;
  },
  "document-creation": async (sp) => {
    const p = docParams(sp);
    const data = await getFinanceDocuments(p);
    return <DocumentReport {...data} params={p} filename="document-creation-report.csv" />;
  },
  "payments-creation": async (sp) => {
    const p = payParams(sp);
    const data = await getFinancePayments(p);
    return <PaymentsReport {...data} params={p} filename="payments-creation-report" />;
  },
  "credit-card-transactions": async () => <CreditCardReport txns={await getCreditCardTransactions()} />,
  "orders": async (sp) => {
    const p = ordersParams(sp);
    const data = await getOrders(p);
    return <OrdersReport {...data} params={p} />;
  },
  "sold-packages": async (sp) => {
    const p: SoldItemsReportParams = { kind: "plan", ...soldParams(sp) };
    const [data, trainers, itemOptions] = await Promise.all([getSoldItems(p), getSoldItemsTrainerOptions(), getSoldPackageOptions()]);
    return <SoldItemsReport {...data} params={p} itemLabel="Packages" itemOptions={itemOptions} trainerOptions={trainers} filename="sold-packages-report.csv" />;
  },
  "sold-products": async (sp) => {
    const p: SoldItemsReportParams = { kind: "product", ...soldParams(sp) };
    const [data, trainers, itemOptions] = await Promise.all([getSoldItems(p), getSoldItemsTrainerOptions(), getSoldProductOptions()]);
    return <SoldItemsReport {...data} params={p} itemLabel="Products" itemOptions={itemOptions} trainerOptions={trainers} filename="sold-products-report.csv" emptyHint />;
  },
  // General
  "trainers-hours": async () => {
    const [rows, trainers] = await Promise.all([getTrainerHours(), getReportTrainers()]);
    return <TrainerHoursReport rows={rows} trainers={trainers} />;
  },
  "employee-presence": async () => {
    const [shifts, employees] = await Promise.all([getEmployeePresence(), getEmployeeOptions()]);
    return <EmployeePresenceReport shifts={shifts} employees={employees} />;
  },
  "new-classes-subscriptions": async () => <NewSubscriptionsReport rows={await getNewSubscriptions()} />,
  "messages": async () => <MessagesReportView rows={await getMessages()} />,
  "leads": async () => <LeadsReport rows={await getLeads()} />,
  "inactive-clients": async () => <InactiveClientsReport rows={await getInactiveClients()} />,
  "birthdays": async () => <BirthdaysReport rows={await getBirthdays()} />,
};

/** Pre-render a route for every report in the registry. */
export function generateStaticParams() {
  return ALL_REPORTS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = getReport(slug);
  return { title: report ? report.title : "Report" };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ReportSearchParams>;
}) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();

  const render = RENDERERS[slug];
  const sp = await searchParams;
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <Link href="/reports" className="hover:text-foreground">{t("Reports")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t(report.title)}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t(report.title)}</h1>

      {render ? (
        await render(sp)
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-center text-muted-foreground">
          <p className="text-base font-medium text-foreground">{t("This report is coming soon.")}</p>
          <p className="text-sm">{t("The {group} builder for this report will live here.", { group: t(report.groupTitle).toLowerCase() })}</p>
        </div>
      )}
    </div>
  );
}
