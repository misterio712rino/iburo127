export function ClientAccountVisualStyles() {
  return (
    <style>{`
      .client-case-shell .client-user-chip:focus-visible {
        outline:2px solid var(--ib-accent);
        outline-offset:3px;
      }

      .client-case-shell .client-account-surface [class~="bg-white"],
      .client-case-shell .client-account-surface [class~="bg-white/85"],
      .client-case-shell .client-account-surface [class~="bg-white/90"] {
        background:var(--ib-card)!important;
      }

      .client-case-shell .client-account-surface [class~="bg-slate-50"],
      .client-case-shell .client-account-surface [class~="bg-slate-50/70"] {
        background:color-mix(in srgb,var(--ib-card) 82%,var(--ib-line))!important;
      }

      .client-case-shell .client-account-surface [class~="border-white/80"],
      .client-case-shell .client-account-surface [class~="border-slate-100"],
      .client-case-shell .client-account-surface [class~="border-slate-200"],
      .client-case-shell .client-account-surface [class~="border-slate-300"] {
        border-color:var(--ib-card-border)!important;
      }

      .client-case-shell .client-account-surface [class~="text-slate-900"],
      .client-case-shell .client-account-surface [class~="text-slate-800"],
      .client-case-shell .client-account-surface [class~="text-slate-700"],
      .client-case-shell .client-account-surface [class~="text-slate-600"] {
        color:var(--ib-text)!important;
      }

      .client-case-shell .client-account-surface [class~="text-slate-500"],
      .client-case-shell .client-account-surface [class~="text-slate-400"] {
        color:var(--ib-muted)!important;
      }

      .client-case-shell .client-account-surface [class~="bg-[#f0eeea]"] {
        background:color-mix(in srgb,var(--ib-accent) 11%,var(--ib-card))!important;
      }

      .client-case-shell .client-account-surface [class~="text-[#b9202b]"],
      .client-case-shell .client-account-surface [class~="text-[#7B2330]"] {
        color:var(--ib-accent)!important;
      }

      .client-case-shell .client-account-surface [class~="bg-[#17202a]"] {
        background:var(--ib-accent)!important;
        color:#fff!important;
      }

      .client-case-shell[data-client-plan="pro"] .client-account-surface [class~="bg-[#17202a]"] {
        color:#102e49!important;
      }

      .client-case-shell .client-account-surface [class~="bg-[#17202a]"]:hover {
        background:color-mix(in srgb,var(--ib-accent) 88%,var(--ib-text))!important;
      }

      .client-case-shell .client-account-surface input[class*="border-slate"] {
        border-color:var(--ib-card-border)!important;
        background:color-mix(in srgb,var(--ib-card) 92%,var(--ib-shell))!important;
        color:var(--ib-text)!important;
      }

      .client-case-shell .client-account-surface input[class*="border-slate"]:focus {
        border-color:var(--ib-accent)!important;
        box-shadow:0 0 0 4px color-mix(in srgb,var(--ib-accent) 14%,transparent)!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) .client-account-surface [class~="border-amber-200"] {
        border-color:rgba(245,158,11,.24)!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) .client-account-surface [class~="text-amber-950"],
      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) .client-account-surface [class~="text-amber-900/70"] {
        color:#f6d98b!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) .client-account-surface [class~="bg-red-50"] {
        background:color-mix(in srgb,#ef4444 10%,var(--ib-card))!important;
      }

      .client-case-shell:is([data-client-plan="pro"],[data-client-plan="individual"]) .client-account-surface [class~="text-red-700"] {
        color:#fca5a5!important;
      }
    `}</style>
  );
}
