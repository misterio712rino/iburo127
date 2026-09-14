export const MANAGER_LEAD_STATUSES = ["NEW", "CONVERTED", "ARCHIVED"] as const;

export type ManagerLeadStatus = (typeof MANAGER_LEAD_STATUSES)[number];
export type ManagerLeadContactType = "EMAIL" | "PHONE";

type PotentialClientLeadSummary = {
  id: string;
  contactType: ManagerLeadContactType;
  email: string | null;
  phone: string | null;
  status: ManagerLeadStatus;
  attemptCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export type ManagerLeadView = {
  id: string;
  contact: string;
  contactType: ManagerLeadContactType;
  contactTypeLabel: string;
  status: ManagerLeadStatus;
  statusLabel: string;
  attemptCount: number;
  firstSeenLabel: string;
  lastSeenLabel: string;
  normalizedSearchText: string;
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

const STATUS_LABELS: Record<ManagerLeadStatus, string> = {
  NEW: "Новый",
  CONVERTED: "Конвертирован",
  ARCHIVED: "Архив",
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/gu, " ")
    .trim();
}

export function buildManagerLeadViews(
  leads: readonly PotentialClientLeadSummary[],
): ManagerLeadView[] {
  return leads.map((lead) => {
    const contact = lead.email ?? lead.phone ?? "Контакт не указан";
    const contactTypeLabel = lead.contactType === "EMAIL" ? "Email" : "Телефон";

    return {
      id: lead.id,
      contact,
      contactType: lead.contactType,
      contactTypeLabel,
      status: lead.status,
      statusLabel: STATUS_LABELS[lead.status],
      attemptCount: lead.attemptCount,
      firstSeenLabel: DATE_TIME_FORMATTER.format(lead.firstSeenAt),
      lastSeenLabel: DATE_TIME_FORMATTER.format(lead.lastSeenAt),
      normalizedSearchText: normalizeSearchText(
        [lead.email, lead.phone, contact, contactTypeLabel, STATUS_LABELS[lead.status]]
          .filter(Boolean)
          .join(" "),
      ),
    };
  });
}
