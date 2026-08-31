import type { PrismaClient } from "../../generated/prisma/client";
import {
  PLATFORM_ROLE_CODES,
  type ActorRole,
} from "../domain/client-cases/contracts";

export type DomainFixtureDb = Pick<
  PrismaClient,
  | "role"
  | "plan"
  | "feature"
  | "planFeature"
  | "caseStage"
  | "user"
  | "userRole"
  | "clientCase"
>;

const roleMetadata: Record<ActorRole, { name: string; description: string }> = {
  CLIENT: { name: "Клиент", description: "Клиент платформы" },
  LAWYER: { name: "Юрист", description: "Юрист, сопровождающий дела" },
  MANAGER: { name: "Менеджер", description: "Менеджер клиентского сопровождения" },
};

export const STAGING_REFERENCE_ROLES = PLATFORM_ROLE_CODES.map((code) => ({
  code,
  ...roleMetadata[code],
}));

export const STAGING_REFERENCE_PLANS = [
  { code: "LITE", name: "Lite", description: "Базовый набор возможностей платформы" },
  { code: "PRO", name: "Pro", description: "Расширенный набор возможностей платформы" },
  {
    code: "INDIVIDUAL",
    name: "Individual",
    description: "Индивидуальный набор возможностей платформы",
  },
] as const;

export const STAGING_REFERENCE_FEATURES = [
  { code: "EDUCATION", name: "Обучение", description: "Образовательные материалы по процедуре" },
  { code: "QUESTIONNAIRE", name: "Анкета", description: "Заполнение данных по делу" },
  {
    code: "DOCUMENT_GENERATION",
    name: "Формирование документов",
    description: "Подготовка документов по данным дела",
  },
  {
    code: "MORTGAGE_ANALYSIS",
    name: "Анализ ипотеки",
    description: "Анализ ипотечной ситуации по делу",
  },
  {
    code: "AI_ASSISTANT",
    name: "AI-ассистент",
    description: "AI-помощник в рамках дела",
  },
] as const;

export const STAGING_REFERENCE_STAGES = [
  { code: "ONBOARDING", name: "Онбординг", sortOrder: 10 },
  { code: "EDUCATION", name: "Обучение", sortOrder: 20 },
  { code: "QUESTIONNAIRE", name: "Анкетирование", sortOrder: 30 },
  { code: "DOCUMENT_PREPARATION", name: "Подготовка документов", sortOrder: 40 },
  { code: "LAWYER_REVIEW", name: "Проверка юристом", sortOrder: 50 },
  { code: "FILING", name: "Подача документов", sortOrder: 60 },
  { code: "COURT", name: "Суд", sortOrder: 70 },
  { code: "PROCEDURE", name: "Процедура банкротства", sortOrder: 80 },
  { code: "COMPLETED", name: "Завершено", sortOrder: 90 },
] as const;

const planFeatureCodes = {
  LITE: ["EDUCATION", "QUESTIONNAIRE", "DOCUMENT_GENERATION"],
  PRO: ["EDUCATION", "QUESTIONNAIRE", "DOCUMENT_GENERATION", "MORTGAGE_ANALYSIS"],
  INDIVIDUAL: [
    "EDUCATION",
    "QUESTIONNAIRE",
    "DOCUMENT_GENERATION",
    "MORTGAGE_ANALYSIS",
    "AI_ASSISTANT",
  ],
} as const;

export const STAGING_DEMO_USERS = [
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

export const STAGING_DEMO_CASES = [
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

export type DomainFixtureInspection = {
  reference: {
    rolesPresent: number;
    rolesExpected: number;
    plansPresent: number;
    plansExpected: number;
    featuresPresent: number;
    featuresExpected: number;
    stagesPresent: number;
    stagesExpected: number;
    pass: boolean;
  };
  demo: {
    usersPresent: number;
    usersExpected: number;
    usersReady: number;
    casesPresent: number;
    casesExpected: number;
    casesReady: number;
    pass: boolean;
  };
  pass: boolean;
};

export async function seedReferenceData(db: DomainFixtureDb): Promise<void> {
  for (const role of STAGING_REFERENCE_ROLES) {
    await db.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }

  const planIds = new Map<string, string>();
  for (const plan of STAGING_REFERENCE_PLANS) {
    const seeded = await db.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, description: plan.description, isActive: true },
      create: { ...plan, isActive: true },
    });
    planIds.set(seeded.code, seeded.id);
  }

  const featureIds = new Map<string, string>();
  for (const feature of STAGING_REFERENCE_FEATURES) {
    const seeded = await db.feature.upsert({
      where: { code: feature.code },
      update: { name: feature.name, description: feature.description },
      create: feature,
    });
    featureIds.set(seeded.code, seeded.id);
  }

  for (const [planCode, featureCodes] of Object.entries(planFeatureCodes)) {
    const planId = planIds.get(planCode);
    if (!planId) throw new Error("Reference plan was not created.");

    for (const featureCode of featureCodes) {
      const featureId = featureIds.get(featureCode);
      if (!featureId) throw new Error("Reference feature was not created.");

      await db.planFeature.upsert({
        where: { planId_featureId: { planId, featureId } },
        update: {},
        create: { planId, featureId },
      });
    }
  }

  for (const stage of STAGING_REFERENCE_STAGES) {
    await db.caseStage.upsert({
      where: { code: stage.code },
      update: { name: stage.name, sortOrder: stage.sortOrder, isActive: true },
      create: { ...stage, isActive: true },
    });
  }
}

export async function seedDemoData(db: DomainFixtureDb): Promise<void> {
  const roles = await db.role.findMany({
    where: { code: { in: ["CLIENT", "LAWYER"] } },
  });
  const roleIds = new Map(roles.map((role) => [role.code, role.id]));
  if (!roleIds.has("CLIENT") || !roleIds.has("LAWYER")) {
    throw new Error("Reference roles are missing.");
  }

  const userIds = new Map<string, string>();
  for (const demoUser of STAGING_DEMO_USERS) {
    const user = await db.user.upsert({
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
    if (!roleId) throw new Error("Reference role is missing.");

    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
    userIds.set(demoUser.email, user.id);
  }

  const assignedLawyerId = userIds.get("lawyer.demo@example.test");
  if (!assignedLawyerId) throw new Error("Demo lawyer was not created.");

  const plans = await db.plan.findMany({
    where: { code: { in: STAGING_DEMO_CASES.map((demoCase) => demoCase.planCode) } },
  });
  const stages = await db.caseStage.findMany({
    where: { code: { in: STAGING_DEMO_CASES.map((demoCase) => demoCase.stageCode) } },
  });
  const planIds = new Map(plans.map((plan) => [plan.code, plan.id]));
  const stageIds = new Map(stages.map((stage) => [stage.code, stage.id]));

  for (const demoCase of STAGING_DEMO_CASES) {
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

    await db.clientCase.upsert({
      where: { caseNumber: demoCase.caseNumber },
      update: caseData,
      create: {
        caseNumber: demoCase.caseNumber,
        ...caseData,
      },
    });
  }
}

export async function inspectDomainFixtures(db: DomainFixtureDb): Promise<DomainFixtureInspection> {
  const [roles, plans, features, stages, users, cases] = await Promise.all([
    db.role.findMany({
      where: { code: { in: STAGING_REFERENCE_ROLES.map((item) => item.code) } },
      select: { code: true },
    }),
    db.plan.findMany({
      where: { code: { in: STAGING_REFERENCE_PLANS.map((item) => item.code) } },
      select: { code: true, isActive: true },
    }),
    db.feature.findMany({
      where: { code: { in: STAGING_REFERENCE_FEATURES.map((item) => item.code) } },
      select: { code: true },
    }),
    db.caseStage.findMany({
      where: { code: { in: STAGING_REFERENCE_STAGES.map((item) => item.code) } },
      select: { code: true, isActive: true },
    }),
    db.user.findMany({
      where: { email: { in: STAGING_DEMO_USERS.map((item) => item.email) } },
      select: { id: true, email: true, status: true },
    }),
    db.clientCase.findMany({
      where: { caseNumber: { in: STAGING_DEMO_CASES.map((item) => item.caseNumber) } },
      select: {
        caseNumber: true,
        clientId: true,
        assignedLawyerId: true,
        status: true,
        plan: { select: { code: true } },
        stage: { select: { code: true } },
      },
    }),
  ]);

  const userIds = users.map((user) => user.id);
  const userRoles = userIds.length
    ? await db.userRole.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, role: { select: { code: true } } },
      })
    : [];

  const rolesByUserId = new Map<string, string[]>();
  for (const userRole of userRoles) {
    const current = rolesByUserId.get(userRole.userId) ?? [];
    current.push(userRole.role.code);
    rolesByUserId.set(userRole.userId, current);
  }

  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  let usersReady = 0;
  for (const expected of STAGING_DEMO_USERS) {
    const user = usersByEmail.get(expected.email);
    if (!user || user.status !== "ACTIVE") continue;
    const platformRoles = (rolesByUserId.get(user.id) ?? []).filter((code) =>
      PLATFORM_ROLE_CODES.includes(code as ActorRole),
    );
    if (platformRoles.length === 1 && platformRoles[0] === expected.roleCode) usersReady += 1;
  }

  const assignedLawyerId = usersByEmail.get("lawyer.demo@example.test")?.id ?? null;
  const casesByNumber = new Map(cases.map((item) => [item.caseNumber, item]));
  let casesReady = 0;
  for (const expected of STAGING_DEMO_CASES) {
    const row = casesByNumber.get(expected.caseNumber);
    const clientId = usersByEmail.get(expected.clientEmail)?.id ?? null;
    if (
      row &&
      clientId &&
      assignedLawyerId &&
      row.clientId === clientId &&
      row.assignedLawyerId === assignedLawyerId &&
      row.status === "ACTIVE" &&
      row.plan.code === expected.planCode &&
      row.stage.code === expected.stageCode
    ) {
      casesReady += 1;
    }
  }

  const reference = {
    rolesPresent: roles.length,
    rolesExpected: STAGING_REFERENCE_ROLES.length,
    plansPresent: plans.filter((item) => item.isActive).length,
    plansExpected: STAGING_REFERENCE_PLANS.length,
    featuresPresent: features.length,
    featuresExpected: STAGING_REFERENCE_FEATURES.length,
    stagesPresent: stages.filter((item) => item.isActive).length,
    stagesExpected: STAGING_REFERENCE_STAGES.length,
    pass:
      roles.length === STAGING_REFERENCE_ROLES.length &&
      plans.filter((item) => item.isActive).length === STAGING_REFERENCE_PLANS.length &&
      features.length === STAGING_REFERENCE_FEATURES.length &&
      stages.filter((item) => item.isActive).length === STAGING_REFERENCE_STAGES.length,
  };

  const demo = {
    usersPresent: users.length,
    usersExpected: STAGING_DEMO_USERS.length,
    usersReady,
    casesPresent: cases.length,
    casesExpected: STAGING_DEMO_CASES.length,
    casesReady,
    pass: usersReady === STAGING_DEMO_USERS.length && casesReady === STAGING_DEMO_CASES.length,
  };

  return {
    reference,
    demo,
    pass: reference.pass && demo.pass,
  };
}
