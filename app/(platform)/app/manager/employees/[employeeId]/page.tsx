import { notFound } from "next/navigation";
import { ManagerEmployeeDetail } from "@/components/platform/manager/ManagerWorkspace";
import { MANAGER_EMPLOYEES, getManagerEmployee } from "@/lib/platform/demo";

export function generateStaticParams() { return MANAGER_EMPLOYEES.map((employee) => ({ employeeId: employee.id })); }
export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  if (!getManagerEmployee(employeeId)) notFound();
  return <ManagerEmployeeDetail employeeId={employeeId} />;
}
