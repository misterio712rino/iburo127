export function IndividualClientVisualStyles() {
  return (
    <style>{`
      .client-case-shell[data-client-plan="individual"] {
        --ib-gold:var(--ib-plan-accent);
        --ib-gold-bright:var(--ib-plan-accent-bright);
        --ib-gold-soft:rgba(var(--ib-plan-accent-rgb),.11);
        --ib-gold-line:rgba(var(--ib-plan-accent-rgb),.23);
        --ib-accent:var(--ib-plan-accent);
        --ib-card:#25262b;
        --ib-card-border:rgba(255,255,255,.075);
        --ib-shell:#1d1e22;
        --ib-sidebar:#18191d;
        --ib-header:#222328;
      }

      .client-case-shell[data-client-plan="individual"] > aside {
        background:
          radial-gradient(circle at 10% 4%, rgba(var(--ib-plan-accent-rgb),.07), transparent 30%),
          var(--ib-sidebar)!important;
        box-shadow:inset -1px 0 0 rgba(var(--ib-plan-accent-rgb),.08);
      }

      .client-case-shell[data-client-plan="individual"] > aside > p {
        color:rgba(var(--ib-plan-accent-rgb),.52)!important;
      }

      .client-case-shell[data-client-plan="individual"] nav a[aria-current="page"] {
        border-color:var(--ib-gold-line)!important;
        background:linear-gradient(90deg, rgba(var(--ib-plan-accent-rgb),.10), rgba(255,255,255,.025))!important;
        box-shadow:inset 0 0 0 1px rgba(var(--ib-plan-accent-rgb),.03), 0 10px 28px rgba(0,0,0,.14)!important;
      }

      .client-case-shell[data-client-plan="individual"] nav a[aria-current="page"] svg {
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] header {
        box-shadow:0 1px 0 rgba(var(--ib-plan-accent-rgb),.05);
      }

      .client-case-shell[data-client-plan="individual"] .client-user-chip {
        border-color:rgba(var(--ib-plan-accent-rgb),.17);
        background:linear-gradient(135deg, rgba(var(--ib-plan-accent-rgb),.08), rgba(255,255,255,.025));
      }

      .client-case-shell[data-client-plan="individual"] .client-user-avatar {
        background:linear-gradient(145deg, color-mix(in srgb,var(--ib-plan-accent) 38%,white), color-mix(in srgb,var(--ib-plan-accent) 72%,#18191d))!important;
        color:white!important;
        box-shadow:0 0 0 1px rgba(var(--ib-plan-accent-rgb),.18);
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:first-child span:first-child {
        border-color:var(--ib-gold-line)!important;
        background:var(--ib-gold-soft)!important;
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > div:first-child {
        background:
          linear-gradient(135deg,color-mix(in srgb,var(--ib-plan-accent) 78%,white),var(--ib-plan-accent-hover))!important;
        border:1px solid rgba(255,255,255,.06)!important;
        box-shadow:0 22px 60px rgba(var(--ib-plan-accent-rgb),.22)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > article {
        border-color:var(--ib-gold-line)!important;
        background:
          radial-gradient(circle at 100% 0%, rgba(var(--ib-plan-accent-rgb),.08), transparent 42%),
          var(--ib-card)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > article span {
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(3) {
        border-color:rgba(var(--ib-plan-accent-rgb),.12)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(3) li span[class*="bg-white"] {
        color:var(--ib-gold-bright)!important;
        border-color:var(--ib-gold-line)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > a,
      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > article {
        transition:transform .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(-n+4) {
        background:rgba(39,39,45,.72)!important;
        border-color:rgba(255,255,255,.065)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(5),
      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) {
        border-color:var(--ib-gold-line)!important;
        background:
          radial-gradient(circle at 90% 8%, rgba(var(--ib-plan-accent-rgb),.11), transparent 40%),
          linear-gradient(145deg, #29292f, #232429)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) [class*="bg-muted"],
      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) [class*="bg-muted"] {
        background:var(--ib-gold-soft)!important;
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(5):hover,
      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(6):hover {
        border-color:rgba(var(--ib-plan-accent-rgb),.38)!important;
        box-shadow:0 18px 48px rgba(0,0,0,.22)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(5) > article:last-child {
        border-color:var(--ib-gold-line)!important;
        background:
          linear-gradient(145deg, rgba(var(--ib-plan-accent-rgb),.07), transparent 44%),
          var(--ib-card)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(5) > article:last-child [class*="rounded-full"]:first-of-type {
        box-shadow:0 0 0 1px rgba(var(--ib-plan-accent-rgb),.20);
      }

      @media (max-width: 1023px) {
        .client-case-shell[data-client-plan="individual"] nav[aria-label="Мобильная навигация клиентского кабинета"] a[aria-current="page"] {
          color:var(--ib-gold-bright)!important;
          border-color:var(--ib-gold-line)!important;
          background:var(--ib-gold-soft)!important;
        }
      }
    `}</style>
  );
}
