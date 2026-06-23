/**
 * Messages report types + filter options. Real, RLS-scoped data is fetched in
 * lib/reports/server.ts (the messages log + recipients).
 */

export const MESSAGE_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "App Notification", label: "App Notification" },
  { value: "SMS", label: "SMS" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Email", label: "Email" },
];

export type MessageRecipient = { id: string; clientId: string; fullName: string; phone: string };

export type MessageRow = {
  id: string;
  type: string;
  date: string; // yyyy-mm-dd HH:MM:SS
  content: string;
  recipients: MessageRecipient[];
};
