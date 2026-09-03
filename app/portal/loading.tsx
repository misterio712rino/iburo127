import { PortalSystemState } from "@/components/portal/PortalSystemState";

export default function PortalLoading() {
  return (
    <PortalSystemState
      variant="loading"
      compact
      title="Загружаем раздел"
      description="Обновляем данные кабинета."
    />
  );
}
