import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {
  requireStagingDatabaseTarget,
  requireStagingMutationConfirmation,
} from "../scripts/staging-target-guard";

const target = requireStagingDatabaseTarget();
requireStagingMutationConfirmation(
  process.env,
  "IB_STAGING_REFERENCE_SEED_CONFIRM",
  "REFERENCE-SEED",
  target.expectedDatabaseName,
);

const adapter = new PrismaPg({ connectionString: target.databaseUrl });
const prisma = new PrismaClient({ adapter });

const roles = [
  { code: "CLIENT", name: "Клиент", description: "Клиент платформы" },
  { code: "LAWYER", name: "Юрист", description: "Юрист, сопровождающий дела" },
  { code: "MANAGER", name: "Менеджер", description: "Менеджер клиентского сопровождения" },
  { code: "ADMIN", name: "Администратор", description: "Администратор платформы" },
] as const;

const plans = [
  { code: "LITE", name: "Lite", description: "Базовый набор возможностей платформы" },
  { code: "PRO", name: "Pro", description: "Расширенный набор возможностей платформы" },
  { code: "INDIVIDUAL", name: "Individual", description: "Индивидуальный набор возможностей платформы" },
] as const;

const features = [
  { code: "EDUCATION", name: "Обучение", description: "Образовательные материалы по процедуре" },
  { code: "QUESTIONNAIRE", name: "Анкета", description: "Заполнение данных по делу" },
  { code: "DOCUMENT_GENERATION", name: "Формирование документов", description: "Подготовка документов по данным дела" },
  { code: "MORTGAGE_ANALYSIS", name: "Анализ ипотеки", description: "Анализ ипотечной ситуации по делу" },
  { code: "AI_ASSISTANT", name: "AI-ассистент", description: "AI-помощник в рамках дела" },
] as const;

const stages = [
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

async function seedReferenceData(): Promise<void> {
  await prisma.$transaction(
    roles.map((role) =>
      prisma.role.upsert({
        where: { code: role.code },
        update: { name: role.name, description: role.description },
        create: role,
      }),
    ),
  );

  const seededPlans = await prisma.$transaction(
    plans.map((plan) =>
      prisma.plan.upsert({
        where: { code: plan.code },
        update: { name: plan.name, description: plan.description, isActive: true },
        create: { ...plan, isActive: true },
      }),
    ),
  );

  const seededFeatures = await prisma.$transaction(
    features.map((feature) =>
      prisma.feature.upsert({
        where: { code: feature.code },
        update: { name: feature.name, description: feature.description },
        create: feature,
      }),
    ),
  );

  const planIds = new Map(seededPlans.map((plan) => [plan.code, plan.id]));
  const featureIds = new Map(seededFeatures.map((feature) => [feature.code, feature.id]));

  const planFeatures = Object.entries(planFeatureCodes).flatMap(([planCode, featureCodes]) =>
    featureCodes.map((featureCode) => {
      const planId = planIds.get(planCode);
      const featureId = featureIds.get(featureCode);

      if (!planId || !featureId) {
        throw new Error("Reference plan or feature was not created.");
      }

      return prisma.planFeature.upsert({
        where: { planId_featureId: { planId, featureId } },
        update: {},
        create: { planId, featureId },
      });
    }),
  );

  await prisma.$transaction(planFeatures);

  await prisma.$transaction(
    stages.map((stage) =>
      prisma.caseStage.upsert({
        where: { code: stage.code },
        update: { name: stage.name, sortOrder: stage.sortOrder, isActive: true },
        create: { ...stage, isActive: true },
      }),
    ),
  );
}

try {
  await seedReferenceData();
  console.log("STAGING_REFERENCE_SEED_PASS");
} finally {
  await prisma.$disconnect();
}
