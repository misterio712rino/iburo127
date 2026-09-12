export function ProClientVisualStyles() {
  return (
    <style>{`
      .client-case-shell[data-client-plan="pro"] {
        --ib-pro-accent:#82b9e9;
        --ib-pro-accent-bright:#a7d1f4;
        --ib-pro-accent-soft:rgba(130,185,233,.11);
        --ib-pro-line:rgba(130,185,233,.20);
        --ib-accent:#82b9e9;
        --ib-shell:#0f2234;
        --ib-sidebar:#0a1b2a;
        --ib-header:#10283a;
        --ib-card:#132b3e;
        --ib-card-border:rgba(151,201,241,.12);
        --ib-text:#f3f8fc;
        --ib-muted:#94afc3;
        --ib-line:#28465d;
        --ib-shadow:0 18px 52px rgba(2,14,25,.22);
      }

      .client-case-shell[data-client-plan="pro"] > aside {
        background:
          radial-gradient(circle at 8% 4%, rgba(130,185,233,.08), transparent 31%),
          var(--ib-sidebar)!important;
        box-shadow:inset -1px 0 0 rgba(130,185,233,.08);
      }

      .client-case-shell[data-client-plan="pro"] nav a[aria-current="page"] {
        border-color:var(--ib-pro-line)!important;
        background:linear-gradient(90deg, rgba(130,185,233,.11), rgba(255,255,255,.025))!important;
        box-shadow:inset 0 0 0 1px rgba(130,185,233,.025), 0 10px 28px rgba(0,0,0,.13)!important;
      }

      .client-case-shell[data-client-plan="pro"] nav a[aria-current="page"] svg {
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] .client-user-chip {
        border-color:rgba(130,185,233,.16);
        background:linear-gradient(135deg, rgba(130,185,233,.07), rgba(255,255,255,.022));
      }

      .client-case-shell[data-client-plan="pro"] .client-user-avatar {
        background:linear-gradient(145deg, #9ac9ef, #65a4d8)!important;
        color:#0a2133!important;
        box-shadow:0 0 0 1px rgba(202,229,250,.16);
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:first-child span:first-child {
        border-color:var(--ib-pro-line)!important;
        background:var(--ib-pro-accent-soft)!important;
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child {
        background:
          radial-gradient(circle at 94% 8%, rgba(167,209,244,.18), transparent 34%),
          linear-gradient(135deg, #286e9f, #17496e)!important;
        color:#f7fbff!important;
        border:1px solid rgba(167,209,244,.15)!important;
        box-shadow:0 24px 65px rgba(3,30,50,.28)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child p {
        color:#d2e8f8!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > div:first-child a {
        background:#f3f9fd!important;
        color:#123a59!important;
        box-shadow:0 10px 28px rgba(2,23,39,.18)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > article {
        background:
          radial-gradient(circle at 100% 0%, rgba(130,185,233,.075), transparent 40%),
          var(--ib-card)!important;
        border-color:var(--ib-pro-line)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(2) > article span {
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(3) {
        border-color:rgba(130,185,233,.11)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(-n+4),
      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) {
        background:rgba(19,43,62,.80)!important;
        border-color:rgba(151,201,241,.10)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) {
        border-color:rgba(130,185,233,.28)!important;
        background:
          radial-gradient(circle at 92% 8%, rgba(130,185,233,.15), transparent 42%),
          linear-gradient(145deg, #173b55, #122f45)!important;
        box-shadow:inset 0 0 0 1px rgba(130,185,233,.035)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) [class*="bg-muted"] {
        background:var(--ib-pro-accent-soft)!important;
        color:var(--ib-pro-accent-bright)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(4) > div:last-child > :nth-child(5):hover {
        border-color:rgba(167,209,244,.42)!important;
        box-shadow:0 18px 48px rgba(1,19,32,.25)!important;
      }

      .client-case-shell[data-client-plan="pro"] main > div > section:nth-child(5) > article:last-child {
        background:
          linear-gradient(145deg, rgba(130,185,233,.055), transparent 44%),
          var(--ib-card)!important;
        border-color:rgba(130,185,233,.15)!important;
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
