import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { listPotentialClientLeadsForManager } from "@/server/prospect-leads/operations";

const STATUS_LABELS = {
  NEW: "Новый",
  CONVERTED: "Конвертирован",
  ARCHIVED: "Архив",
} as const;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const sessionProvider = createProductionSessionProvider();
  try {
    const actor = await getCurrentPlatformActor(sessionProvider);
    if (!actor.roles.includes("MANAGER")) {
      return Response.json({ code: "FORBIDDEN" }, { status: 403 });
    }

    const leads = await listPotentialClientLeadsForManager(sessionProvider);
    const rows = [
      ["Контакт", "Статус", "Тип", "Попыток", "Первое обращение", "Последнее обращение"],
      ...leads.map((lead) => [
        lead.email ?? lead.phone ?? "",
        STATUS_LABELS[lead.status],
        lead.contactType === "EMAIL" ? "Email" : "Телефон",
        String(lead.attemptCount),
        lead.firstSeenAt.toISOString(),
        lead.lastSeenAt.toISOString(),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="iburo-potential-clients-${date}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      return Response.json({ code: UNAUTHENTICATED }, { status: 401 });
    }
    throw error;
  }
}
