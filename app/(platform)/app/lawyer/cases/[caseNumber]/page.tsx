import { notFound } from "next/navigation";
import { LawyerCaseDetail } from "@/components/platform/lawyer/LawyerCaseDetail";
import { DEMO_IDENTITIES } from "@/lib/platform/demo";

export const dynamicParams = false;
const LAWYER_CASE_NUMBERS = DEMO_IDENTITIES.filter((identity) => identity.role === "CLIENT").flatMap((identity) => identity.caseNumber ? [identity.caseNumber] : []);
export function generateStaticParams() { return LAWYER_CASE_NUMBERS.map((caseNumber) => ({ caseNumber })); }
export default async function LawyerCasePage({ params }: { params: Promise<{ caseNumber: string }> }) { const { caseNumber } = await params; if (!LAWYER_CASE_NUMBERS.includes(caseNumber)) notFound(); return <LawyerCaseDetail caseNumber={caseNumber} />; }
