/**
 * Employee Presence report type — staff work shifts (clock-in/out). Real,
 * RLS-scoped data is fetched in lib/reports/server.ts (the staff_shifts table).
 */

export type Shift = {
  id: string;
  employeeId: string;
  employeeName: string;
  start: string; // yyyy-mm-dd HH:MM
  end: string;
  hourlyRate: number;
  duration: number; // hours
  total: number;
  status: "active" | "completed";
};
