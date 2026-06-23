/**
 * Messages Center types + helpers. Broadcasts to clients filtered by group +
 * subscription status, with reusable templates. Real, RLS-scoped reads/writes
 * live in lib/messages-server.ts and app/(app)/messages/actions.ts.
 *
 * PHASE 2: SMS delivery is a provider integration (e.g. Twilio). Broadcasts
 * currently enqueue `messages` rows in status 'queued'; nothing sends them yet.
 */

export type MessageTemplate = {
  id: string;
  title: string;
  content: string;
};

export type GroupOption = { value: string; label: string };

export const SUBSCRIPTION_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All Subscriptions" },
  { value: "active", label: "Active Subscriptions" },
  { value: "inactive", label: "InActive Subscriptions" },
];

/** Placeholder replaced with the recipient's name when each SMS is rendered. */
export const NAME_PLACEHOLDER = "{{1}}";

// getGroups() and getTemplates() are real, RLS-scoped queries — see
// lib/messages-server.ts. Broadcast sending lives in app/(app)/messages/actions.ts.

/**
 * SMS segment math. Hebrew/Arabic (non-GSM) text uses UCS-2 (70 chars/segment,
 * 67 for multipart); plain ASCII uses GSM-7 (160 / 153).
 */
export function smsInfo(text: string): { remaining: number; messages: number } {
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const single = isUnicode ? 70 : 160;
  const multi = isUnicode ? 67 : 153;
  const len = text.length;
  if (len === 0) return { remaining: single, messages: 0 };
  const messages = len <= single ? 1 : Math.ceil(len / multi);
  const capacity = messages === 1 ? single : multi * messages;
  return { remaining: Math.max(0, capacity - len), messages };
}
