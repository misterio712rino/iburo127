export function DarkClientStatusStyles() {
  return (
    <style>{`
      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="bg-emerald-50"],
      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="bg-emerald-50/70"] {
        background:color-mix(in srgb,#34d399 11%,var(--ib-card))!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="border-emerald-200"] {
        border-color:rgba(52,211,153,.24)!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="text-emerald-700"],
      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="text-emerald-800"],
      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="text-emerald-900"] {
        color:#8de3b8!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="bg-sky-50"] {
        background:color-mix(in srgb,#38bdf8 12%,var(--ib-card))!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="text-sky-700"] {
        color:#8ad8f7!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="bg-amber-50"] {
        background:color-mix(in srgb,#f59e0b 12%,var(--ib-card))!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) [class~="text-amber-700"] {
        color:#f6d36f!important;
      }
    `}</style>
  );
}
