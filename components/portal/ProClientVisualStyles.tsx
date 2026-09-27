export function ProClientVisualStyles() {
  return (
    <style>{`
      .client-case-shell[data-client-plan="pro"] {
        --ib-pro-accent:var(--ib-plan-accent);
        --ib-pro-accent-bright:var(--ib-plan-accent-bright);
        --ib-pro-accent-soft:rgba(var(--ib-plan-accent-rgb),.11);
        --ib-pro-line:rgba(var(--ib-plan-accent-rgb),.20);
        --ib-accent:var(--ib-plan-accent);
        --ib-shell:#0f2234;
        --ib-sidebar:#0a1b2a;
        --ib-header:#10283a;
        --ib-card:#132b3e;
        --ib-card-border:rgba(var(--ib-plan-accent-rgb),.12);
        --ib-text:#f3f8fc;
        --ib-muted:#94afc3;
        --ib-line:#28465d;
        --ib-shadow:0 18px 52px rgba(2,14,25,.22);
      }

      .client-case-shell[data-client-plan="pro"] > aside {
        background:
          radial-gradient(circle at 8% 4%, rgba(var(--ib-plan-accent-rgb),.08), transparent 31%),
          var(--ib-sidebar)!important;
        box-shadow:inset -1px 0 0 rgba(var(--ib-plan-accent-rgb),.08);
      }

      .client-case-shell[data-client-plan="pro"] nav a[aria-current="page"] {
        border-color:var(--ib-pro-line)!important;
        background:linear-gradient(90deg, rgba(var(--ib-plan-accent-rgb),.11), rgba(255,255,255,.025))!important;
        box-shadow:inset 0 0 0 1px rgba(var(--ib-plan-accent-rgb),.025), 0 10px 28px rgba(0,0,0,.13)!important;
      }

      .client-case-shell[data-client-plan="pro"] nav a[aria-current="page"] svg {
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] .client-user-chip {
        border-color:rgba(var(--ib-plan-accent-rgb),.16);
        background:linear-gradient(135deg, rgba(var(--ib-plan-accent-rgb),.07), rgba(255,255,255,.022));
      }

      .client-case-shell[data-client-plan="pro"] .client-user-avatar {
        background:linear-gradient(145deg, color-mix(in srgb,var(--ib-plan-accent) 38%,white), color-mix(in srgb,var(--ib-plan-accent) 72%,#0a1b2a))!important;
        color:#0a1b2a!important;
        box-shadow:0 0 0 1px rgba(var(--ib-plan-accent-rgb),.16);
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:first-child span:first-child {
        border-color:var(--ib-pro-line)!important;
        background:var(--ib-pro-accent-soft)!important;
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child {
        background:
          radial-gradient(circle at 94% 8%, rgba(var(--ib-plan-accent-rgb),.24), transparent 34%),
          linear-gradient(135deg, color-mix(in srgb,var(--ib-plan-accent) 72%,#0a1b2a), color-mix(in srgb,var(--ib-plan-accent) 52%,#0a1b2a))!important;
        color:#f7fbff!important;
        border:1px solid rgba(var(--ib-plan-accent-rgb),.15)!important;
        box-shadow:0 24px 65px rgba(3,30,50,.28)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child p {
        color:rgba(255,255,255,.82)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child a {
        background:#f3f9fd!important;
        color:var(--ib-plan-accent)!important;
        box-shadow:0 10px 28px rgba(2,23,39,.18)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > article {
        background:
          radial-gradient(circle at 100% 0%, rgba(var(--ib-plan-accent-rgb),.075), transparent 40%),
          var(--ib-card)!important;
        border-color:var(--ib-pro-line)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > article span {
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(3) {
        border-color:rgba(var(--ib-plan-accent-rgb),.11)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(-n+4),
      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) {
        background:rgba(19,43,62,.80)!important;
        border-color:rgba(var(--ib-plan-accent-rgb),.10)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) {
        border-color:rgba(var(--ib-plan-accent-rgb),.28)!important;
        background:
          radial-gradient(circle at 92% 8%, rgba(var(--ib-plan-accent-rgb),.15), transparent 42%),
          linear-gradient(145deg, color-mix(in srgb,var(--ib-plan-accent) 52%,#0a1b2a), color-mix(in srgb,var(--ib-plan-accent) 42%,#0a1b2a))!important;
        box-shadow:inset 0 0 0 1px rgba(var(--ib-plan-accent-rgb),.035)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) [class*="bg-muted"] {
        background:var(--ib-pro-accent-soft)!important;
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(5):hover {
        border-color:rgba(var(--ib-plan-accent-rgb),.42)!important;
        box-shadow:0 18px 48px rgba(1,19,32,.25)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(5) > article:last-child {
        background:
          linear-gradient(145deg, rgba(var(--ib-plan-accent-rgb),.055), transparent 44%),
          var(--ib-card)!important;
        border-color:rgba(var(--ib-plan-accent-rgb),.15)!important;
      }

      @media (max-width: 1023px) {
        .client-case-shell[data-client-plan="pro"] nav[aria-label="Мобильная навигация клиентского кабинета"] a[aria-current="page"] {
          color:var(--ib-pro-accent-bright)!important;
          border-color:var(--ib-pro-line)!important;
          background:var(--ib-pro-accent-soft)!important;
        }
      }
    `}</style>
  );
}
