import { notFound } from "next/navigation";
import { ManagerCaseDetail } from "@/components/platform/manager/ManagerWorkspace";
import { MANAGER_CLIENTS, getManagerCase } from "@/lib/platform/demo";

export function generateStaticParams() { return MANAGER_CLIENTS.map((client) => ({ caseNumber: client.clientCase.caseNumber })); }
export default async function Page({ params }: { params: Promise<{ caseNumber: string }> }) {
  const { caseNumber } = await params;
  if (!getManagerCase(caseNumber)) notFound();
  return <ManagerCaseDetail caseNumber={caseNumber} />;
}
