import "server-only";

import { ClientCaseService } from "@/server/domain/client-cases/service";
import { PrismaClientCaseRepository } from "@/server/repositories/prisma/client-case-repository";

const clientCaseRepository = new PrismaClientCaseRepository();

export const clientCaseService = new ClientCaseService(clientCaseRepository);
