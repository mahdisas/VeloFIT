/**
 * Tasks types + status legend. A task is a follow-up action attached to a client
 * (payment reminders, calls, etc.); a `blocking_entry` task blocks the client's
 * door check-in until resolved. Real, RLS-scoped reads/writes live in
 * lib/tasks-server.ts and app/(app)/tasks/actions.ts.
 */

export type TaskStatus = "new" | "in_progress" | "canceled" | "finished";

export const TASK_STATUSES: { value: TaskStatus; label: string; className: string }[] = [
  { value: "new", label: "New", className: "bg-teal-100 text-teal-700" },
  { value: "in_progress", label: "In Progress", className: "bg-amber-100 text-amber-700" },
  { value: "canceled", label: "Canceled", className: "bg-rose-100 text-rose-700" },
  { value: "finished", label: "Finished", className: "bg-emerald-100 text-emerald-700" },
];

export function statusConfig(status: TaskStatus) {
  return TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0];
}

export type TaskRow = {
  id: string;
  clientId: string;
  clientName: string;
  date: string; // ISO date
  title: string;
  description: string;
  status: TaskStatus;
  reminderDate: string | null; // ISO date
  blockingEntry: boolean;
};

// getTasks() is a real, RLS-scoped query — see lib/tasks-server.ts.
