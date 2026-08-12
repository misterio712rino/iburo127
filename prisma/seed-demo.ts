import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Investor demo seed is disabled in production.");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const demoUsers = [
  {
    email: "client.lite@example.test",
    displayName: "Александр Лебедев",
    roleCode: "CLIENT",
  },
  {
    email: "client.pro@example.test",
    displayName: "Мария Соколова",
    roleCode: "CLIENT",
  },
  {
    email: "client.individual@example.test",
    displayName: "Дмитрий Волков",
    roleCode: "CLIENT",
  },
  {
    email: "lawyer.demo@example.test",
    displayName: "Анна Орлова",
    roleCode: "LAWYER",
  },
] as const;

const demoCases = [
  {
    caseNumber: "IBR-2026-000101",
    clientEmail: "client.lite@example.test",
    planCode: "LITE",
    stageCode: "EDUCATION",
    openedAt: new Date("2026-01-15T09:00:00.000Z"),
  },
  {
    caseNumber: "IBR-2026-000102",
    clientEmail: "client.pro@example.test",
    planCode: "PRO",
    stageCode: "QUESTIONNAIRE",
    openedAt: new Date("2026-02-03T09:00:00.000Z"),
  },
  {
    caseNumber: "IBR-2026-000103",
    clientEmail: "client.individual@example.test",
    planCode: "INDIVIDUAL",
    stageCode: "DOCUMENT_PREPARATION",
    openedAt: new Date("2026-02-20T09:00:00.000Z"),
  },
] as const;

async function seedDemoData(): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { code: { in: ["CLIENT", "LAWYER"] } },
  });
  const roleIds = new Map(roles.map((role) => [role.code, role.id]));

  if (!roleIds.has("CLIENT") || !roleIds.has("LAWYER")) {
    throw new Error("Reference roles are missing. Run the reference seed first.");
  }

  const userIds = new Map<string, string>();

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        displayName: demoUser.displayName,
        status: "ACTIVE",
      },
      create: {
        email: demoUser.email,
        displayName: demoUser.displayName,
        status: "ACTIVE",
      },
    });

    const roleId = roleIds.get(demoUser.roleCode);

    if (!roleId) {
      throw new Error("Reference role is missing.");
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });

    userIds.set(demoUser.email, user.id);
  }

  const assignedLawyerId = userIds.get("lawyer.demo@example.test");

  if (!assignedLawyerId) {
    throw new Error("Demo lawyer was not created.");
  }

  const plans = await prisma.plan.findMany({
    where: { code: { in: demoCases.map((demoCase) => demoCase.planCode) } },
  });
  const stages = await prisma.caseStage.findMany({
    where: { code: { in: demoCases.map((demoCase) => demoCase.stageCode) } },
  });
  const planIds = new Map(plans.map((plan) => [plan.code, plan.id]));
  const stageIds = new Map(stages.map((stage) => [stage.code, stage.id]));

  for (const demoCase of demoCases) {
    const clientId = userIds.get(demoCase.clientEmail);
    const planId = planIds.get(demoCase.planCode);
    const stageId = stageIds.get(demoCase.stageCode);

    if (!clientId || !planId || !stageId) {
      throw new Error("Reference data or a demo client is missing.");
    }

    const caseData = {
      clientId,
      planId,
      stageId,
      assignedLawyerId,
      status: "ACTIVE" as const,
      openedAt: demoCase.openedAt,
      closedAt: null,
    };

    await prisma.clientCase.upsert({
      where: { caseNumber: demoCase.caseNumber },
      update: caseData,
      create: {
        caseNumber: demoCase.caseNumber,
        ...caseData,
      },
    });
  }
}

try {
  await seedDemoData();
} finally {
  await prisma.$disconnect();
}
