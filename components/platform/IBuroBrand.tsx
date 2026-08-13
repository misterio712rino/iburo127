import { cn } from "@/lib/utils";

type IBuroBrandProps = {
  className?: string;
  dot?: boolean;
};

export function IBuroBrand({ className, dot = false }: IBuroBrandProps) {
  const label = dot ? "iБюро." : "iБюро";

  return (
    <span className={cn("inline-flex", className)}>
      <span className="sr-only">{label}</span>
      <span className="text-[var(--iburo-brand-red)]" aria-hidden="true">
        i
      </span>
      <span aria-hidden="true">Бюро</span>
      {dot ? (
        <span className="text-[var(--iburo-brand-red)]" aria-hidden="true">
          .
        </span>
      ) : null}
    </span>
  );
}
