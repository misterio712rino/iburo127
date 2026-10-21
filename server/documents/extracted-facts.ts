import "server-only";

import { requireServerActor } from "@/server/auth/runtime";
import type { SessionProvider } from "@/server/auth/contracts";
import { clientCaseService } from "@/server/client-cases/runtime";
import { getPrismaClient } from "@/server/database/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseExtractedFactCandidate } from "@/server/domain/documents/extracted-fact-contract";
import {
  buildConfirmedFactDraft,
  type ConfirmedFactDraft,
  type ConfirmedFactForDraft,
} from "@/server/domain/documents/confirmed-fact-draft";

export const EXTRACTED_FACTS_NOT_FOUND = "EXTRACTED_FACTS_NOT_FOUND";
export const EXTRACTED_FACTS_FORBIDDEN = "EXTRACTED_FACTS_FORBIDDEN";
export const EXTRACTED_FACTS_INVALID = "EXTRACTED_FACTS_INVALID";
export const EXTRACTED_FACTS_CONFLICT = "EXTRACTED_FACTS_CONFLICT";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function requireClientOwner(sessionProvider: SessionProvider, caseId: string) {
  if (!isUuid(caseId)) throw new Error(EXTRACTED_FACTS_NOT_FOUND);
  const actor = await requireServerActor(sessionProvider);
  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase) throw new Error(EXTRACTED_FACTS_NOT_FOUND);
  if (!actor.roles.includes("CLIENT") || clientCase.clientId !== actor.userId) {
    throw new Error(EXTRACTED_FACTS_FORBIDDEN);
  }
  return actor;
}

export async function listExtractedFacts(sessionProvider: SessionProvider, caseId: string) {
  await requireClientOwner(sessionProvider, caseId);
  return getPrismaClient().extractedFactCandidate.findMany({
    where: { clientCaseId: caseId, sourceFile: { is: { status: "READY" } } },
    orderBy: [
      { sourceFile: { createdAt: "asc" } },
      { sourcePage: "asc" },
      { recordKey: "asc" },
      { fieldPath: "asc" },
    ],
    select: {
      id: true,
      sourceFileId: true,
      fieldPath: true,
      recordKey: true,
      sourcePage: true,
      value: true,
      confidence: true,
      reviewStatus: true,
      reviewedAt: true,
      sourceFile: { select: { fileName: true } },
    },
  });
}

export async function getConfirmedFactDraftPreview(
  sessionProvider: SessionProvider,
  caseId: string,
  documentCode: ConfirmedFactDraft["documentCode"],
) {
  await requireClientOwner(sessionProvider, caseId);
  if (!["bankruptcy-application", "property-inventory", "creditors-list"].includes(documentCode)) {
    throw new Error(EXTRACTED_FACTS_INVALID);
  }
  const rows = await getPrismaClient().extractedFactCandidate.findMany({
    where: {
      clientCaseId: caseId,
      reviewStatus: "CONFIRMED",
      sourceFile: { is: { status: "READY" } },
    },
    orderBy: [
      { sourceFile: { createdAt: "asc" } },
      { sourcePage: "asc" },
      { recordKey: "asc" },
      { fieldPath: "asc" },
    ],
    select: {
      id: true, sourceFileId: true, fieldPath: true, recordKey: true,
      sourcePage: true, value: true, confidence: true,
      sourceFile: { select: { fileName: true } },
    },
  });
  const facts: ConfirmedFactForDraft[] = rows.map((row) => {
    const parsed = parseExtractedFactCandidate({
      caseId,
      sourceFileId: row.sourceFileId,
      fieldPath: row.fieldPath,
      recordKey: row.recordKey,
      sourcePage: row.sourcePage,
      value: row.value,
      confidence: row.confidence,
      reviewStatus: "NEEDS_REVIEW",
    });
    return {
      id: row.id,
      fieldPath: parsed.fieldPath,
      recordKey: parsed.recordKey,
      sourceFileId: row.sourceFileId,
      sourceFileName: row.sourceFile.fileName,
      sourcePage: parsed.sourcePage,
      reviewStatus: "CONFIRMED",
      value: parsed.value,
    };
  });
  return buildConfirmedFactDraft({ documentCode, facts });
}

export async function reviewExtractedFact(
  sessionProvider: SessionProvider,
  input: { caseId: string; factId: string; decision: "CONFIRMED" | "REJECTED"; value?: unknown },
) {
  const actor = await requireClientOwner(sessionProvider, input.caseId);
  if (!isUuid(input.factId) || !["CONFIRMED", "REJECTED"].includes(input.decision)) {
    throw new Error(EXTRACTED_FACTS_INVALID);
  }
  if (input.value !== undefined && input.decision !== "CONFIRMED") {
    throw new Error(EXTRACTED_FACTS_INVALID);
  }
  const prisma = getPrismaClient();
  const existing = await prisma.extractedFactCandidate.findFirst({
    where: {
      id: input.factId,
      clientCaseId: input.caseId,
      reviewStatus: "NEEDS_REVIEW",
      sourceFile: { is: { status: "READY" } },
    },
    select: {
      id: true, clientCaseId: true, sourceFileId: true, fieldPath: true,
      recordKey: true, sourcePage: true, value: true, confidence: true,
    },
  });
  if (!existing) throw new Error(EXTRACTED_FACTS_CONFLICT);
  let value: Prisma.InputJsonValue;
  try {
    value = parseExtractedFactCandidate({
      caseId: existing.clientCaseId,
      sourceFileId: existing.sourceFileId,
      fieldPath: existing.fieldPath,
      recordKey: existing.recordKey,
      sourcePage: existing.sourcePage,
      value: existing.value,
      confidence: existing.confidence,
      reviewStatus: "NEEDS_REVIEW",
    }).value;
  } catch {
    throw new Error(EXTRACTED_FACTS_INVALID);
  }
  if (input.value !== undefined) {
    let parsed;
    try {
      parsed = parseExtractedFactCandidate({
        caseId: existing.clientCaseId,
        sourceFileId: existing.sourceFileId,
        fieldPath: existing.fieldPath,
        recordKey: existing.recordKey,
        sourcePage: existing.sourcePage,
        value: input.value,
        confidence: existing.confidence,
        reviewStatus: "NEEDS_REVIEW",
      });
    } catch {
      throw new Error(EXTRACTED_FACTS_INVALID);
    }
    const oldKind = (existing.value as { kind?: unknown } | null)?.kind;
    if (parsed.value.kind !== oldKind) throw new Error(EXTRACTED_FACTS_INVALID);
    value = parsed.value;
  }
  const result = await prisma.extractedFactCandidate.updateMany({
    where: {
      id: input.factId,
      clientCaseId: input.caseId,
      reviewStatus: "NEEDS_REVIEW",
      sourceFile: { is: { status: "READY" } },
    },
    data: {
      reviewStatus: input.decision,
      value,
      reviewedAt: new Date(),
      reviewedById: actor.userId,
    },
  });
  if (result.count !== 1) throw new Error(EXTRACTED_FACTS_CONFLICT);
  return prisma.extractedFactCandidate.findFirst({
    where: { id: input.factId, clientCaseId: input.caseId },
    select: { id: true, reviewStatus: true, reviewedAt: true },
  });
}
