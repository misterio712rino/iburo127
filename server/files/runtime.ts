import "server-only";

import { ClientCaseService } from "@/server/domain/client-cases/service";
import { StoredFileService } from "@/server/domain/files/service";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";
import { PrismaStoredFileRepository } from "@/server/repositories/prisma/stored-file-repository";

export const storedFileService = new StoredFileService(
  new ClientCaseService(new PrismaClientCaseRepository()),
  new PrismaStoredFileRepository(),
);
