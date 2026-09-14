export function ClientCaseSwitcherStyles() {
  return (
    <style>{`
      .client-case-shell details[class~="group"][class~="bg-white/60"] {
        border-color:var(--ib-card-border)!important;
        background:color-mix(in srgb,var(--ib-card) 82%,transparent)!important;
        color:var(--ib-text)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > summary {
        display:flex;
        min-height:44px;
        align-items:center;
        color:var(--ib-text)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > summary > span {
        width:100%;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > summary > span > span:first-child > span:last-child {
        color:var(--ib-muted)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > summary > span > span:last-child {
        color:var(--ib-accent)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > div {
        border-color:var(--ib-card-border)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > div > a {
        display:flex!important;
        min-height:44px;
        flex-direction:column;
        justify-content:center;
        color:var(--ib-muted)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > div > a[aria-current="page"] {
        background:color-mix(in srgb,var(--ib-accent) 11%,var(--ib-card))!important;
        color:var(--ib-text)!important;
      }

      .client-case-shell details[class~="group"][class~="bg-white/60"] > div > a:hover {
        background:color-mix(in srgb,var(--ib-card) 76%,var(--ib-accent-soft))!important;
        color:var(--ib-text)!important;
      }

      .client-case-shell header > div:last-child > div[class~="text-xs"][class~="justify-between"] {
        min-height:44px;
        color:var(--ib-text)!important;
      }

      .client-case-shell header > div:last-child > div[class~="text-xs"][class~="justify-between"] > span:first-child {
        color:var(--ib-text)!important;
      }

      .client-case-shell header > div:last-child > div[class~="text-xs"][class~="justify-between"] > span:last-child {
        color:var(--ib-muted)!important;
      }
    `}</style>
  );
}
