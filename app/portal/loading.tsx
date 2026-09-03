import { PortalSystemState } from "@/components/portal/PortalSystemState";

export default function PortalLoading() {
  return (
    <PortalSystemState
      variant="loading"
      title="Загружаем кабинет"
      description="Подготавливаем защищённый раздел iБюро и актуальные данные вашей учётной записи."
    />
  );
}
