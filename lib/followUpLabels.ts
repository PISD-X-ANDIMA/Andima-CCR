type Translate = (key: string, fallback?: string) => string;

const STATUS_TRANSLATIONS: Record<string, [string, string]> = {
  IN_PROGRESS: ["overdue.statusInProgress", "In Progress"],
  PROMISE_TO_PAY: ["overdue.statusPromiseToPay", "Promise to Pay"],
  COMPLETED: ["overdue.statusCompleted", "Completed"],
  DISPUTE: ["overdue.statusDispute", "Dispute"],
  CANCELLED: ["overdue.statusCancelled", "Cancelled"],
};

const ACTION_TRANSLATIONS: Record<string, [string, string]> = {
  "chat (whatsapp / others)": ["overdue.chatWhatsapp", "Chat (WhatsApp / Others)"],
  chat: ["overdue.chatWhatsapp", "Chat (WhatsApp / Others)"],
  whatsapp: ["overdue.actionWhatsapp", "WhatsApp"],
  call: ["overdue.actionCall", "Call"],
  email: ["overdue.actionEmail", "Email"],
  "direct visit": ["overdue.directVisit", "Direct Visit"],
  visit: ["overdue.directVisit", "Direct Visit"],
  "online meeting": ["overdue.onlineMeeting", "Online Meeting"],
  negotiation: ["overdue.actionNegotiation", "Negotiation"],
};

function humanizeUnknownValue(value: string) {
  return value
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function followUpStatusLabel(status: string, t: Translate): string | null {
  const normalized = status.trim().toUpperCase();
  if (!normalized || normalized === "ASSIGNED") return null;

  const translation = STATUS_TRANSLATIONS[normalized];
  return translation ? t(translation[0], translation[1]) : humanizeUnknownValue(status);
}

export function followUpActionLabel(action: string, t: Translate): string {
  const normalized = action.trim().toLowerCase();
  if (!normalized) return "";

  const translation = ACTION_TRANSLATIONS[normalized];
  return translation ? t(translation[0], translation[1]) : humanizeUnknownValue(action);
}
