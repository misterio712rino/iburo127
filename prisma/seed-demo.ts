import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { requireReviewedStagingMutationPreflight } from "../scripts/staging-mutation-preflight";
import { seedDemoData } from "../server/staging/domain-fixtures";

const { target } = await requireReviewedStagingMutationPreflight({
  env: process.env,
  confirmation: {
    variableName: "IB_STAGING_DEMO_SEED_CONFIRM",
    expectedValue: (stagingTarget) => `DEMO-SEED:${stagingTarget.expectedDatabaseName}`,
  },
});

const adapter = new PrismaPg({ connectionString: target.databaseUrl });
const prisma = new PrismaClient({ adapter });

try {
  await prisma.$transaction(async (tx) => seedDemoData(tx), { timeout: 30_000 });
  console.log("STAGING_DEMO_SEED_PASS");
} finally {
  await prisma.$disconnect();
}
