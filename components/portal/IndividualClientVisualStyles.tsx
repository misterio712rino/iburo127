export function IndividualClientVisualStyles() {
  return (
    <style>{`
      .client-case-shell[data-client-plan="individual"] {
        --ib-gold:#c9a66b;
        --ib-gold-bright:#e2c48b;
        --ib-gold-soft:rgba(201,166,107,.11);
        --ib-gold-line:rgba(201,166,107,.23);
        --ib-accent:#c82934;
        --ib-card:#25262b;
        --ib-card-border:rgba(255,255,255,.075);
        --ib-shell:#1d1e22;
        --ib-sidebar:#18191d;
        --ib-header:#222328;
      }

      .client-case-shell[data-client-plan="individual"] > aside {
        background:
          radial-gradient(circle at 10% 4%, rgba(201,166,107,.07), transparent 30%),
          var(--ib-sidebar)!important;
        box-shadow:inset -1px 0 0 rgba(201,166,107,.08);
      }

      .client-case-shell[data-client-plan="individual"] > aside > p {
        color:rgba(226,196,139,.52)!important;
      }

      .client-case-shell[data-client-plan="individual"] nav a[aria-current="page"] {
        border-color:var(--ib-gold-line)!important;
        background:linear-gradient(90deg, rgba(201,166,107,.10), rgba(255,255,255,.025))!important;
        box-shadow:inset 0 0 0 1px rgba(201,166,107,.03), 0 10px 28px rgba(0,0,0,.14)!important;
      }

      .client-case-shell[data-client-plan="individual"] nav a[aria-current="page"] svg {
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] header {
        box-shadow:0 1px 0 rgba(201,166,107,.05);
      }

      .client-case-shell[data-client-plan="individual"] .client-user-chip {
        border-color:rgba(201,166,107,.17);
        background:linear-gradient(135deg, rgba(201,166,107,.08), rgba(255,255,255,.025));
      }

      .client-case-shell[data-client-plan="individual"] .client-user-avatar {
        background:linear-gradient(145deg, #d7b474, #a98247)!important;
        color:#191a1d!important;
        box-shadow:0 0 0 1px rgba(255,236,192,.18);
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:first-child span:first-child {
        border-color:var(--ib-gold-line)!important;
        background:var(--ib-gold-soft)!important;
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > div:first-child {
        background:
          linear-gradient(135deg, rgba(196,32,43,.98), rgba(138,20,29,.98))!important;
        border:1px solid rgba(255,255,255,.06)!important;
        box-shadow:0 22px 60px rgba(126,15,24,.22)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > article {
        border-color:var(--ib-gold-line)!important;
        background:
          radial-gradient(circle at 100% 0%, rgba(201,166,107,.08), transparent 42%),
          var(--ib-card)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(2) > article span {
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(3) {
        border-color:rgba(201,166,107,.12)!important;
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
          radial-gradient(circle at 90% 8%, rgba(201,166,107,.11), transparent 40%),
          linear-gradient(145deg, #29292f, #232429)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(5) [class*="bg-muted"],
      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(6) [class*="bg-muted"] {
        background:var(--ib-gold-soft)!important;
        color:var(--ib-gold-bright)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(5):hover,
      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(4) > div:last-child > :nth-child(6):hover {
        border-color:rgba(226,196,139,.38)!important;
        box-shadow:0 18px 48px rgba(0,0,0,.22)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(5) > article:last-child {
        border-color:var(--ib-gold-line)!important;
        background:
          linear-gradient(145deg, rgba(201,166,107,.07), transparent 44%),
          var(--ib-card)!important;
      }

      .client-case-shell[data-client-plan="individual"] main > div > section:nth-child(5) > article:last-child [class*="rounded-full"]:first-of-type {
        box-shadow:0 0 0 1px rgba(201,166,107,.20);
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
