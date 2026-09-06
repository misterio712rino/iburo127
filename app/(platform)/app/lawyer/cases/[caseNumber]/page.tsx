import { notFound } from "next/navigation";
import { LawyerCaseDetail } from "@/components/platform/lawyer/LawyerCaseDetail";
import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";
import { DEMO_CASES } from "@/lib/platform/demo";

export const dynamicParams = false;
const LAWYER_CASE_NUMBERS = DEMO_CASES
  .filter((clientCase) => clientPlanHasHumanSupport(clientCase.plan))
  .map((clientCase) => clientCase.caseNumber);

export function generateStaticParams() {
  return LAWYER_CASE_NUMBERS.map((caseNumber) => ({ caseNumber }));
}

export default async function LawyerCasePage({ params }: { params: Promise<{ caseNumber: string }> }) {
  const { caseNumber } = await params;
  if (!LAWYER_CASE_NUMBERS.includes(caseNumber)) notFound();
  return <LawyerCaseDetail caseNumber={caseNumber} />;
}
