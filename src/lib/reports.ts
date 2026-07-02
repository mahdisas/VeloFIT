/**
 * Reports registry — the single source of truth for the Reports module.
 *
 * The dashboard, the per-report routes, and (later) the sidebar/search all read
 * from this one list, so adding a report is a one-line change here. Each report
 * maps to /reports/<slug>. There are 23 reports across three groups.
 *
 * `description` is the client-facing one-liner shown on the reports index and
 * under the report title — it states exactly what the data means (including the
 * paid/unpaid semantics of the finance reports), so keep it in sync with the
 * fetchers in lib/reports/server.ts.
 */

export type ReportLink = {
  slug: string;
  title: string;
  description: string;
};

export type ReportGroup = {
  id: string;
  title: string;
  reports: ReportLink[];
};

export const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "classes",
    title: "Classes reports",
    reports: [
      {
        slug: "classes-main",
        title: "Classes main report",
        description: "Every subscription ever sold — status, group, dates and price, for the full membership picture.",
      },
      {
        slug: "classes-expire",
        title: "Classes expire report",
        description: "Subscriptions sorted by expiry — see whose membership ends soon so you can renew them in time.",
      },
      {
        slug: "classes-absence",
        title: "Classes absence report",
        description: "Active members and their last recorded entrance — spot who stopped showing up.",
      },
      {
        slug: "classes-renewal",
        title: "Classes renewal report",
        description: "Currently active subscriptions, split between first-timers and renewals.",
      },
      {
        slug: "subscriptions-no-enrollments",
        title: "Report of subscriptions with no enrollments",
        description: "Active subscriptions that never booked a single class — paying members who aren't attending.",
      },
      {
        slug: "subscriptions-balance",
        title: "Subscriptions Balance Report",
        description: "Class credits per active subscription: classes booked vs the plan's limit. About classes, not money.",
      },
      {
        slug: "direct-debit-subscriptions",
        title: "Direct Debit Subscriptions",
        description: "All subscriptions charged by direct debit, with installments paid vs total.",
      },
    ],
  },
  {
    id: "finance",
    title: "Finance reports",
    reports: [
      {
        slug: "finance-document",
        title: "Finance document report",
        description: "Your financial snapshot: every paid accounting document. Unpaid invoices and bids are excluded — money owed lives in the Finance charges report.",
      },
      {
        slug: "finance-charges",
        title: "Finance charges report",
        description: "Outstanding debt per client — everything billed minus everything paid. This is the money the gym is still owed.",
      },
      {
        slug: "finance-payments",
        title: "Finance payments report",
        description: "Every payment that actually came in, by method — cash, card, cheque or transfer.",
      },
      {
        slug: "document-creation",
        title: "Document creation report",
        description: "The full paper trail of every document created — including unpaid invoices and bids. A log, not a revenue figure.",
      },
      {
        slug: "payments-creation",
        title: "Payments creation report",
        description: "A log of every payment recorded, newest first.",
      },
      {
        slug: "credit-card-transactions",
        title: "Credit Card Transactions",
        description: "All credit-card payments with amount, card digits, approval code and status.",
      },
      {
        slug: "orders",
        title: "Orders report",
        description: "Every shop order and its status — completed, pending or canceled.",
      },
      {
        slug: "sold-packages",
        title: "Sold Packages Report",
        description: "Every subscription package sold, by whom and to whom. Canceled orders don't count.",
      },
      {
        slug: "sold-products",
        title: "Sold Products Report",
        description: "Every product sold, by whom and to whom. Canceled orders don't count.",
      },
    ],
  },
  {
    id: "general",
    title: "General reports",
    reports: [
      {
        slug: "trainers-hours",
        title: "Trainers hours report",
        description: "Scheduled class hours per trainer, from the calendar.",
      },
      {
        slug: "employee-presence",
        title: "Employee Presence Report",
        description: "Staff shifts — when each employee clocked in and out.",
      },
      {
        slug: "new-classes-subscriptions",
        title: "New Classes Subscriptions Report",
        description: "New subscriptions by joining date — your sign-up flow over time.",
      },
      {
        slug: "messages",
        title: "Messages Report",
        description: "Every message sent to clients.",
      },
      {
        slug: "leads",
        title: "Leads Report",
        description: "Leads per marketing campaign and whether they became clients.",
      },
      {
        slug: "inactive-clients",
        title: "Inactive clients report",
        description: "Former members: clients whose subscriptions have all ended — a win-back list.",
      },
      {
        slug: "birthdays",
        title: "Birthdays report",
        description: "Upcoming client birthdays — a reason to reach out.",
      },
    ],
  },
];

/** Flat list of every report with its owning group — handy for routing/search. */
export const ALL_REPORTS = REPORT_GROUPS.flatMap((g) =>
  g.reports.map((r) => ({ ...r, groupId: g.id, groupTitle: g.title }))
);

export type ResolvedReport = (typeof ALL_REPORTS)[number];

export function getReport(slug: string): ResolvedReport | undefined {
  return ALL_REPORTS.find((r) => r.slug === slug);
}
