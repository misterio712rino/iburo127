import { notFound } from "next/navigation";
import { LawyerCaseDetail } from "@/components/platform/lawyer/LawyerCaseDetail";
import { DEMO_CASES } from "@/lib/platform/demo";

export const dynamicParams = false;
export function generateStaticParams() { return DEMO_CASES.map((item) => ({ caseNumber: item.caseNumber })); }
export default async function LawyerCasePage({ params }: { params: Promise<{ caseNumber: string }> }) { const { caseNumber } = await params; if (!DEMO_CASES.some((item) => item.caseNumber === caseNumber)) notFound(); return <LawyerCaseDetail caseNumber={caseNumber} />; }
