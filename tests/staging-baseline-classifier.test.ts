import assert from "node:assert/strict";
import {
  classifyStagingBaseline,
  REQUIRED_BETTER_AUTH_TABLES,
} from "../scripts/staging-baseline-classifier";
import {
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
} from "../scripts/staging-schema-contract";

const empty = classifyStagingBaseline({
  totalUserTableCount: 0,
  domainTableCount: 0,
  domainEnumCount: 0,
  betterAuthTableCount: 0,
  prismaMigrationHistory: {
    tablePresent: false,
    appliedCount: 0,
    unfinishedCount: 0,
  },
});
assert.equal(empty.strategy, "A_EMPTY_DATABASE");
assert.equal(empty.requiresFullStructuralReview, false);
assert.equal(empty.domainSchemaPresent, false);
assert.equal(empty.betterAuthSchemaPresent, false);

const existingDomain = classifyStagingBaseline({
  totalUserTableCount: 4,
  domainTableCount: 4,
  domainEnumCount: 2,
  betterAuthTableCount: 0,
  prismaMigrationHistory: {
    tablePresent: false,
    appliedCount: 0,
    unfinishedCount: 0,
  },
});
assert.equal(existingDomain.strategy, "B_EXISTING_DOMAIN_SCHEMA");
assert.equal(existingDomain.domainSchemaPresent, true);
assert.equal(existingDomain.domainSchemaComplete, false);
assert.equal(existingDomain.requiresFullStructuralReview, true);

const completeDomainWithHistory = classifyStagingBaseline({
  totalUserTableCount: REQUIRED_STAGING_DOMAIN_TABLES.length + 1,
  domainTableCount: REQUIRED_STAGING_DOMAIN_TABLES.length,
  domainEnumCount: REQUIRED_STAGING_ENUMS.length,
  betterAuthTableCount: 0,
  prismaMigrationHistory: {
    tablePresent: true,
    appliedCount: 3,
    unfinishedCount: 0,
  },
});
assert.equal(completeDomainWithHistory.strategy, "C_PRISMA_HISTORY_PRESENT");
assert.equal(completeDomainWithHistory.domainSchemaComplete, true);
assert.equal(completeDomainWithHistory.prismaHistoryPresent, true);

const authOnly = classifyStagingBaseline({
  totalUserTableCount: REQUIRED_BETTER_AUTH_TABLES.length,
  domainTableCount: 0,
  domainEnumCount: 0,
  betterAuthTableCount: REQUIRED_BETTER_AUTH_TABLES.length,
  prismaMigrationHistory: {
    tablePresent: false,
    appliedCount: 0,
    unfinishedCount: 0,
  },
});
assert.equal(authOnly.strategy, "D_AUTH_SCHEMA_ONLY");
assert.equal(authOnly.betterAuthSchemaPresent, true);
assert.equal(authOnly.betterAuthSchemaComplete, true);
assert.equal(authOnly.requiresFullStructuralReview, true);

const domainAndAuth = classifyStagingBaseline({
  totalUserTableCount: 3,
  domainTableCount: 1,
  domainEnumCount: 0,
  betterAuthTableCount: 2,
  prismaMigrationHistory: {
    tablePresent: false,
    appliedCount: 0,
    unfinishedCount: 0,
  },
});
assert.equal(domainAndAuth.strategy, "B_EXISTING_DOMAIN_SCHEMA");
assert.equal(domainAndAuth.betterAuthSchemaPresent, true);

const unknown = classifyStagingBaseline({
  totalUserTableCount: 2,
  domainTableCount: 0,
  domainEnumCount: 0,
  betterAuthTableCount: 0,
  prismaMigrationHistory: {
    tablePresent: false,
    appliedCount: 0,
    unfinishedCount: 0,
  },
});
assert.equal(unknown.strategy, "REVIEW_NONEMPTY_OTHER_SCHEMA");
assert.equal(unknown.requiresFullStructuralReview, true);

const partialAuthPlusUnknown = classifyStagingBaseline({
  totalUserTableCount: 3,
  domainTableCount: 0,
  domainEnumCount: 0,
  betterAuthTableCount: 2,
  prismaMigrationHistory: {
    tablePresent: false,
    appliedCount: 0,
    unfinishedCount: 0,
  },
});
assert.equal(partialAuthPlusUnknown.strategy, "REVIEW_NONEMPTY_OTHER_SCHEMA");
assert.equal(partialAuthPlusUnknown.betterAuthSchemaPresent, true);
assert.equal(partialAuthPlusUnknown.betterAuthSchemaComplete, false);

assert.throws(
  () =>
    classifyStagingBaseline({
      totalUserTableCount: 0,
      domainTableCount: 1,
      domainEnumCount: 0,
      betterAuthTableCount: 0,
      prismaMigrationHistory: {
        tablePresent: false,
        appliedCount: 0,
        unfinishedCount: 0,
      },
    }),
  /known table count exceeds total user table count/,
);

assert.throws(
  () =>
    classifyStagingBaseline({
      totalUserTableCount: 0,
      domainTableCount: -1,
      domainEnumCount: 0,
      betterAuthTableCount: 0,
      prismaMigrationHistory: {
        tablePresent: false,
        appliedCount: 0,
        unfinishedCount: 0,
      },
    }),
  /domainTableCount must be a non-negative safe integer/,
);

console.log("STAGING_BASELINE_CLASSIFIER_TEST_PASS");
