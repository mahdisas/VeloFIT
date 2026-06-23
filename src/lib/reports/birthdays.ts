/**
 * Birthdays report types. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (matches client birth month/day to the range).
 */

export type BirthdayRow = {
  id: string;
  clientId: string;
  fullName: string;
  phone: string;
  age: number;
  birthDate: string; // full yyyy-mm-dd (for display + age)
  date: string; // this year's birthday yyyy-mm-dd (for the date range filter)
};
