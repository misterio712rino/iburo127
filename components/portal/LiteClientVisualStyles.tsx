export function LiteClientVisualStyles() {
  return (
    <style>{`
      .client-case-shell[data-client-plan="lite"] {
        --ib-lite-accent:#9f2332;
        --ib-lite-accent-strong:#851c2a;
        --ib-lite-accent-soft:rgba(159,35,50,.065);
        --ib-lite-line:rgba(15,23,42,.085);
        --ib-accent:#9f2332;
        --ib-accent-soft:#f8ecee;
        --ib-shell:#f5f6f8;
        --ib-sidebar:#ffffff;
        --ib-header:#ffffff;
        --ib-card:#ffffff;
        --ib-card-border:rgba(15,23,42,.075);
        --ib-text:#18202b;
        --ib-muted:#707985;
        --ib-line:#e7e9ed;
        --ib-shadow:0 14px 38px rgba(15,23,42,.055);
      }

      .client-case-shell[data-client-plan="lite"] > aside {
        background:#ffffff!important;
        box-shadow:inset -1px 0 0 rgba(15,23,42,.055);
      }

      .client-case-shell[data-client-plan="lite"] header {
        background:rgba(255,255,255,.96)!important;
        box-shadow:0 1px 0 rgba(15,23,42,.035);
      }

      .client-case-shell[data-client-plan="lite"] nav a[aria-current="page"] {
        border-color:rgba(159,35,50,.13)!important;
        background:linear-gradient(90deg, rgba(159,35,50,.065), rgba(159,35,50,.018))!important;
        color:#18202b!important;
        box-shadow:none!important;
      }

      .client-case-shell[data-client-plan="lite"] nav a[aria-current="page"] svg {
        color:var(--ib-lite-accent)!important;
      }

      .client-case-shell[data-client-plan="lite"] .client-user-chip {
        border-color:rgba(15,23,42,.075);
        background:#ffffff;
        box-shadow:0 8px 22px rgba(15,23,42,.045);
      }

      .client-case-shell[data-client-plan="lite"] .client-user-avatar {
        background:#eef0f3!important;
        color:#303846!important;
        box-shadow:inset 0 0 0 1px rgba(15,23,42,.055);
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:first-child span:first-child {
        border-color:rgba(159,35,50,.12)!important;
        background:var(--ib-lite-accent-soft)!important;
        color:var(--ib-lite-accent)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(2) > div:first-child {
        background:
          linear-gradient(90deg, rgba(159,35,50,.045), transparent 58%),
          #ffffff!important;
        color:var(--ib-text)!important;
        border:1px solid rgba(159,35,50,.13)!important;
        box-shadow:0 16px 44px rgba(15,23,42,.055)!important;
        position:relative;
        overflow:hidden;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(2) > div:first-child::before {
        content:"";
        position:absolute;
        inset:0 auto 0 0;
        width:4px;
        background:var(--ib-lite-accent);
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(2) > div:first-child p {
        color:#67717e!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(2) > div:first-child a {
        background:var(--ib-lite-accent)!important;
        color:#ffffff!important;
        box-shadow:0 8px 22px rgba(159,35,50,.17)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(2) > div:first-child a:hover {
        background:var(--ib-lite-accent-strong)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(2) > article,
      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(3) {
        border-color:var(--ib-lite-line)!important;
        box-shadow:0 12px 34px rgba(15,23,42,.045)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(4) > div:last-child > :nth-child(-n+4) {
        background:#ffffff!important;
        border-color:var(--ib-lite-line)!important;
        box-shadow:0 8px 24px rgba(15,23,42,.035)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(4) > div:last-child > :nth-child(-n+4):hover {
        border-color:rgba(159,35,50,.14)!important;
        box-shadow:0 14px 34px rgba(15,23,42,.065)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) {
        background:#f1f2f4!important;
        border:1px dashed rgba(15,23,42,.12)!important;
        box-shadow:none!important;
        opacity:.72!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) [class*="bg-muted"] {
        background:#e5e7eb!important;
        color:#7b838d!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) {
        background:
          radial-gradient(circle at 100% 0%, rgba(159,35,50,.055), transparent 44%),
          #ffffff!important;
        border-color:rgba(159,35,50,.11)!important;
        box-shadow:0 8px 24px rgba(15,23,42,.035)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) [class*="bg-muted"] {
        background:var(--ib-lite-accent-soft)!important;
        color:var(--ib-lite-accent)!important;
      }

      .client-case-shell[data-client-plan="lite"] main > div > section:nth-child(5) > article {
        border-color:var(--ib-lite-line)!important;
        box-shadow:0 10px 30px rgba(15,23,42,.04)!important;
      }

      @media (max-width: 1023px) {
        .client-case-shell[data-client-plan="lite"] nav[aria-label="Мобильная навигация клиентского кабинета"] a {
          background:#ffffff!important;
          border-color:rgba(15,23,42,.07)!important;
          color:#5f6874!important;
        }

        .client-case-shell[data-client-plan="lite"] nav[aria-label="Мобильная навигация клиентского кабинета"] a[aria-current="page"] {
          color:var(--ib-lite-accent)!important;
          border-color:rgba(159,35,50,.14)!important;
          background:var(--ib-lite-accent-soft)!important;
        }
      }
    `}</style>
  );
}
