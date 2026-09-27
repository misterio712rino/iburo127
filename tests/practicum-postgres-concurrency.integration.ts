import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrismaClient } from "@/server/database/prisma";
import {
  PRACTICUM_WORKSPACE_STATE_CONFLICT,
} from "@/server/domain/practicum/workspace-contracts";
import { PrismaPracticumWorkspaceRepository } from "@/server/repositories/prisma/practicum-workspace-repository";

const prisma = getPrismaClient();
const repository = new PrismaPracticumWorkspaceRepository();
const runId = randomUUID();
const lessonId = "lesson-concurrency";

type Fixture = {
  clientId: string;
  lawyerId: string;
  clientCaseId: string;
};

function isStateConflict(reason: unknown) {
  return reason instanceof Error && reason.message === PRACTICUM_WORKSPACE_STATE_CONFLICT;
}

async function exactlyOneWins<T>(left: Promise<T>, right: Promise<T>) {
  const results = await Promise.allSettled([left, right]);
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<T> => result.status === "fulfilled",
  );
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const safeReasons = rejected.map((result) => {
    const reason = result.reason as { code?: unknown; name?: unknown; message?: unknown } | unknown;
    if (reason && typeof reason === "object") {
      return {
        name: "name" in reason ? String(reason.name) : "unknown",
        code: "code" in reason ? String(reason.code) : null,
        message: "message" in reason ? String(reason.message) : "unknown",
      };
    }
    return { name: typeof reason, code: null, message: String(reason) };
  });
  assert.equal(
    fulfilled.length,
    1,
    `exactly one concurrent mutation must commit; rejected=${JSON.stringify(safeReasons)}`,
  );
  assert.equal(
    rejected.length,
    1,
    `exactly one concurrent mutation must lose the CAS race; rejected=${JSON.stringify(safeReasons)}`,
  );
  assert.ok(
    isStateConflict(rejected[0].reason),
    `losing mutation must surface state conflict, got: ${
      rejected[0].reason instanceof Error ? rejected[0].reason.message : String(rejected[0].reason)
    }`,
  );
  return fulfilled[0].value;
}

async function makeFixture(label: string): Promise<Fixture> {
  const client = await prisma.user.create({
    data: {
      email: `concurrency-client-${label}-${runId}@example.test`,
      displayName: "Concurrency Client",
    },
    select: { id: true },
  });
  const lawyer = await prisma.user.create({
    data: {
      email: `concurrency-lawyer-${label}-${runId}@example.test`,
      displayName: "Concurrency Lawyer",
    },
    select: { id: true },
  });

  const plan = await prisma.plan.upsert({
    where: { code: "PRO" },
    update: { name: "Про" },
    create: { code: "PRO", name: "Про" },
    select: { id: true },
  });
  const stage = await prisma.caseStage.upsert({
    where: { code: "PRACTICUM_CONCURRENCY_TEST" },
    update: { name: "Practicum concurrency", sortOrder: 9999, isActive: true },
    create: {
      code: "PRACTICUM_CONCURRENCY_TEST",
      name: "Practicum concurrency",
      sortOrder: 9999,
      isActive: true,
    },
    select: { id: true },
  });

  const clientCase = await prisma.clientCase.create({
    data: {
      caseNumber: `CONC-${label}-${runId}`,
      clientId: client.id,
      assignedLawyerId: lawyer.id,
      planId: plan.id,
      stageId: stage.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return {
    clientId: client.id,
    lawyerId: lawyer.id,
    clientCaseId: clientCase.id,
  };
}

async function seedHomework(
  fixture: Fixture,
  input: {
    status: "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED";
    version: number;
    answerText?: string;
    reviewedDecision?: "CHANGES_REQUESTED" | "ACCEPTED" | null;
  },
) {
  const homework = await prisma.casePracticumHomework.create({
    data: {
      clientCaseId: fixture.clientCaseId,
      lessonId,
      status: input.status,
      draftText: input.answerText ?? "Initial answer",
      version: input.version,
      submittedAt: input.status === "DRAFT" ? null : new Date(),
      reviewedAt: input.status === "CHANGES_REQUESTED" ? new Date() : null,
    },
  });

  if (input.status !== "DRAFT") {
    await prisma.casePracticumHomeworkRevision.create({
      data: {
        homeworkId: homework.id,
        revisionNumber: 1,
        submittedByUserId: fixture.clientId,
        answerText: input.answerText ?? "Initial answer",
        submittedAt: new Date(),
        ...(input.reviewedDecision
          ? {
              reviewedByUserId: fixture.lawyerId,
              reviewDecision: input.reviewedDecision,
              reviewComment: "Initial review",
              reviewedAt: new Date(),
            }
          : {}),
      },
    });
  }

  return homework;
}

async function scenarioInitialCreateRace() {
  const fixture = await makeFixture("initial");

  await exactlyOneWins(
    repository.saveHomeworkDraft({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Concurrent draft",
      expectedVersion: null,
      actorUserId: fixture.clientId,
    }),
    repository.submitHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Concurrent submit",
      expectedVersion: null,
      actorUserId: fixture.clientId,
    }),
  );

  const homework = await prisma.casePracticumHomework.findUniqueOrThrow({
    where: {
      clientCaseId_lessonId: {
        clientCaseId: fixture.clientCaseId,
        lessonId,
      },
    },
  });
  const revisions = await prisma.casePracticumHomeworkRevision.count({
    where: { homeworkId: homework.id },
  });
  const submittedEvents = await prisma.caseActivityEvent.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      type: "practicum.homework.submitted",
    },
  });

  assert.equal(homework.version, 1);
  assert.ok(homework.status === "DRAFT" || homework.status === "SUBMITTED");
  if (homework.status === "SUBMITTED") {
    assert.equal(revisions, 1);
    assert.equal(submittedEvents, 1);
  } else {
    assert.equal(revisions, 0);
    assert.equal(submittedEvents, 0);
  }
}

async function scenarioDraftVersusSubmit() {
  const fixture = await makeFixture("draft-submit");
  const homework = await seedHomework(fixture, { status: "DRAFT", version: 1 });

  await exactlyOneWins(
    repository.saveHomeworkDraft({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Late draft",
      expectedVersion: 1,
      actorUserId: fixture.clientId,
    }),
    repository.submitHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Submitted answer",
      expectedVersion: 1,
      actorUserId: fixture.clientId,
    }),
  );

  const finalHomework = await prisma.casePracticumHomework.findUniqueOrThrow({
    where: { id: homework.id },
  });
  const revisions = await prisma.casePracticumHomeworkRevision.count({
    where: { homeworkId: homework.id },
  });
  const submittedEvents = await prisma.caseActivityEvent.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      type: "practicum.homework.submitted",
    },
  });

  assert.equal(finalHomework.version, 2);
  assert.ok(finalHomework.status === "DRAFT" || finalHomework.status === "SUBMITTED");
  if (finalHomework.status === "SUBMITTED") {
    assert.equal(finalHomework.draftText, "Submitted answer");
    assert.equal(revisions, 1);
    assert.equal(submittedEvents, 1);
  } else {
    assert.equal(finalHomework.draftText, "Late draft");
    assert.equal(revisions, 0);
    assert.equal(submittedEvents, 0);
  }
}

async function scenarioTwoSubmits() {
  const fixture = await makeFixture("two-submits");
  const homework = await seedHomework(fixture, { status: "DRAFT", version: 1 });

  await exactlyOneWins(
    repository.submitHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Submit A",
      expectedVersion: 1,
      actorUserId: fixture.clientId,
    }),
    repository.submitHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Submit B",
      expectedVersion: 1,
      actorUserId: fixture.clientId,
    }),
  );

  const finalHomework = await prisma.casePracticumHomework.findUniqueOrThrow({
    where: { id: homework.id },
  });
  const revisions = await prisma.casePracticumHomeworkRevision.findMany({
    where: { homeworkId: homework.id },
  });
  const submittedEvents = await prisma.caseActivityEvent.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      type: "practicum.homework.submitted",
    },
  });
  const notifications = await prisma.notification.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      userId: fixture.lawyerId,
      type: "practicum.homework.submitted",
    },
  });

  assert.equal(finalHomework.status, "SUBMITTED");
  assert.equal(finalHomework.version, 2);
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].revisionNumber, 1);
  assert.equal(submittedEvents, 1);
  assert.equal(notifications, 1);
}

async function scenarioOppositeReviews() {
  const fixture = await makeFixture("reviews");
  const homework = await seedHomework(fixture, {
    status: "SUBMITTED",
    version: 2,
  });

  await exactlyOneWins(
    repository.reviewHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      decision: "ACCEPTED",
      comment: "",
      expectedVersion: 2,
      actorUserId: fixture.lawyerId,
    }),
    repository.reviewHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      decision: "CHANGES_REQUESTED",
      comment: "Please revise",
      expectedVersion: 2,
      actorUserId: fixture.lawyerId,
    }),
  );

  const finalHomework = await prisma.casePracticumHomework.findUniqueOrThrow({
    where: { id: homework.id },
  });
  const revision = await prisma.casePracticumHomeworkRevision.findFirstOrThrow({
    where: { homeworkId: homework.id, revisionNumber: 1 },
  });
  const reviewedEvents = await prisma.caseActivityEvent.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      type: "practicum.homework.reviewed",
    },
  });
  const notifications = await prisma.notification.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      userId: fixture.clientId,
      type: "practicum.homework.reviewed",
    },
  });

  assert.equal(finalHomework.version, 3);
  assert.ok(
    finalHomework.status === "ACCEPTED" ||
      finalHomework.status === "CHANGES_REQUESTED",
  );
  assert.equal(revision.reviewDecision, finalHomework.status);
  assert.ok(revision.reviewedAt instanceof Date);
  assert.equal(reviewedEvents, 1);
  assert.equal(notifications, 1);
}

async function scenarioResubmitVersusStaleReview() {
  const fixture = await makeFixture("resubmit");
  const homework = await seedHomework(fixture, {
    status: "CHANGES_REQUESTED",
    version: 3,
    reviewedDecision: "CHANGES_REQUESTED",
  });

  const results = await Promise.allSettled([
    repository.submitHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      answerText: "Revision two",
      expectedVersion: 3,
      actorUserId: fixture.clientId,
    }),
    repository.reviewHomework({
      clientCaseId: fixture.clientCaseId,
      lessonId,
      decision: "ACCEPTED",
      comment: "",
      expectedVersion: 2,
      actorUserId: fixture.lawyerId,
    }),
  ]);

  const submit = results[0];
  const staleReview = results[1];
  assert.equal(submit.status, "fulfilled");
  assert.equal(staleReview.status, "rejected");
  if (staleReview.status === "rejected") {
    assert.ok(isStateConflict(staleReview.reason));
  }

  const finalHomework = await prisma.casePracticumHomework.findUniqueOrThrow({
    where: { id: homework.id },
  });
  const revisions = await prisma.casePracticumHomeworkRevision.findMany({
    where: { homeworkId: homework.id },
    orderBy: { revisionNumber: "asc" },
  });
  const reviewedEvents = await prisma.caseActivityEvent.count({
    where: {
      clientCaseId: fixture.clientCaseId,
      type: "practicum.homework.reviewed",
    },
  });

  assert.equal(finalHomework.status, "SUBMITTED");
  assert.equal(finalHomework.version, 4);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[1].revisionNumber, 2);
  assert.equal(revisions[1].reviewDecision, null);
  assert.equal(revisions[1].reviewedAt, null);
  assert.equal(reviewedEvents, 0);
}

try {
  await scenarioInitialCreateRace();
  await scenarioDraftVersusSubmit();
  await scenarioTwoSubmits();
  await scenarioOppositeReviews();
  await scenarioResubmitVersusStaleReview();
  console.log("PRACTICUM_POSTGRES_CONCURRENCY_PASS");
} finally {
  await prisma.$disconnect();
}
