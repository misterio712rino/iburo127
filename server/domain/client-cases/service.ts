import { canAccessClientCase } from "./access-policy";
import type { AuthenticatedActor, ClientCaseRecord, ClientCaseRepository } from "./contracts";

export class ClientCaseService {
  constructor(private readonly repository: ClientCaseRepository) {}

  async getCase(actor: AuthenticatedActor, selector: { caseId?: string; caseNumber?: string }) {
    const clientCase = await this.repository.findAccessibleCase({ actor, ...selector });
    if (!clientCase || !canAccessClientCase(actor, clientCase)) return null;
    return clientCase;
  }

  async listCases(actor: AuthenticatedActor): Promise<readonly ClientCaseRecord[]> {
    const cases = await this.repository.listAccessibleCases(actor);
    return cases.filter((clientCase) => canAccessClientCase(actor, clientCase));
  }
}
