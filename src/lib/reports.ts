/**
 * Reports registry — the single source of truth for the Reports module.
 *
 * The dashboard, the per-report routes, and (later) the sidebar/search all read
 * from this one list, so adding a report is a one-line change here. Each report
 * maps to /reports/<slug>. There are 23 reports across three groups.
 */

export type ReportLink = {
  slug: string;
  title: string;
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
      { slug: "classes-main", title: "Classes main report" },
      { slug: "classes-expire", title: "Classes expire report" },
      { slug: "classes-absence", title: "Classes absence report" },
      { slug: "classes-renewal", title: "Classes renewal report" },
      { slug: "subscriptions-no-enrollments", title: "Report of subscriptions with no enrollments" },
      { slug: "subscriptions-balance", title: "Subscriptions Balance Report" },
      { slug: "direct-debit-subscriptions", title: "Direct Debit Subscriptions" },
    ],
  },
  {
    id: "finance",
    title: "Finance reports",
    reports: [
      { slug: "finance-document", title: "Finance document report" },
      { slug: "finance-charges", title: "Finance charges report" },
      { slug: "finance-payments", title: "Finance payments report" },
      { slug: "document-creation", title: "Document creation report" },
      { slug: "payments-creation", title: "Payments creation report" },
      { slug: "credit-card-transactions", title: "Credit Card Transactions" },
      { slug: "orders", title: "Orders report" },
      { slug: "sold-packages", title: "Sold Packages Report" },
      { slug: "sold-products", title: "Sold Products Report" },
    ],
  },
  {
    id: "general",
    title: "General reports",
    reports: [
      { slug: "trainers-hours", title: "Trainers hours report" },
      { slug: "employee-presence", title: "Employee Presence Report" },
      { slug: "new-classes-subscriptions", title: "New Classes Subscriptions Report" },
      { slug: "messages", title: "Messages Report" },
      { slug: "leads", title: "Leads Report" },
      { slug: "inactive-clients", title: "Inactive clients report" },
      { slug: "birthdays", title: "Birthdays report" },
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
