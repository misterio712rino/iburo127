import type {
  ActorRepository,
  AuthSession,
  SessionProvider,
} from "@/server/auth/contracts";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";

export type MfaEnabledReader = () => Promise<boolean>;

export function isStaffActor(actor: AuthenticatedActor) {
  return actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");
}

export function requiresStaffMfa(actor: AuthenticatedActor, mfaEnabled: boolean) {
  return isStaffActor(actor) && !mfaEnabled;
}

/**
 * Fail-closed production boundary for mandatory staff MFA.
 *
 * Downstream routes continue to consume the provider-neutral SessionProvider.
 * A LAWYER or MANAGER whose verified external account does not have MFA enabled
 * receives no admitted platform session, so browser-provided role/case data can
 * never bypass this check.
 */
export class StaffMfaEnforcingSessionProvider implements SessionProvider {
  constructor(
    private readonly inner: SessionProvider,
    private readonly actors: ActorRepository,
    private readonly readMfaEnabled: MfaEnabledReader,
  ) {}

  async getSession(): Promise<AuthSession | null> {
    const session = await this.inner.getSession();
    if (!session) return null;

    const actor = await this.actors.getActiveActor(session.userId);
    if (!actor) return null;
    if (!isStaffActor(actor)) return session;

    return (await this.readMfaEnabled()) ? session : null;
  }
}
