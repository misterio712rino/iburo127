import type { ReactNode } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";

export function PortalSystemState({
  variant,
  title,
  description,
  action,
}: {
  variant: "loading" | "error";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const loading = variant === "loading";
  const Icon = loading ? LoaderCircle : CircleAlert;

  return (
    <main className="min-h-screen bg-[#f5f6f7] px-5 py-8 text-[#202326] sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center sm:min-h-[calc(100vh-6rem)]">
        <section
          role={loading ? "status" : "alert"}
          aria-live={loading ? "polite" : "assertive"}
          aria-busy={loading ? true : undefined}
          className="w-full max-w-xl rounded-[28px] border border-[#e3e5e7] bg-white p-6 shadow-[0_20px_65px_rgba(15,23,42,0.08)] sm:p-8"
        >
          <IBuroBrand className="font-[var(--font-iburo-display)] text-2xl font-semibold tracking-[-0.03em]" />

          <div className="mt-8 flex min-w-0 items-start gap-4">
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                loading ? "bg-[#f0eeea] text-[#8f1720]" : "bg-red-50 text-red-700"
              }`}
              aria-hidden="true"
            >
              <Icon className={`size-5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="break-words font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-0.03em] text-[#202326] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-md break-words text-sm leading-6 text-[#6f7880] sm:text-[15px]">{description}</p>
            </div>
          </div>

          {action ? <div className="mt-7 flex min-w-0 flex-wrap gap-3 border-t border-[#eceeef] pt-6">{action}</div> : null}
        </section>
      </div>
    </main>
  );
}
