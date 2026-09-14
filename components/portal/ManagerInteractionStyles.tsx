export function ManagerInteractionStyles() {
  return (
    <style>{`
      .manager-interaction-shell {
        background: #f3f5f6;
      }

      .manager-interaction-shell :is(a, button) {
        min-height: 44px;
      }

      .manager-interaction-shell :is(a, button):focus-visible {
        outline: 3px solid #8f1720;
        outline-offset: 3px;
        border-radius: 12px;
      }

      .manager-interaction-shell aside :is(a, button):focus-visible {
        outline-color: #ffffff;
      }

      .manager-interaction-shell aside {
        background: #202b33;
      }

      .manager-interaction-shell > div > header {
        border-color: #e2e5e7;
        background: rgba(243, 245, 246, 0.96);
      }

      .manager-interaction-shell [class*="shadow-[0_16px_45px"] {
        border-color: #e2e5e7 !important;
        border-radius: 20px !important;
        box-shadow: none !important;
      }

      .manager-interaction-shell [class*="hover:-translate-y-0.5"]:hover {
        transform: none !important;
      }

      .manager-interaction-shell [class*="rounded-full"][class*="border-[#dfe3e6]"] {
        border-radius: 12px !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .manager-interaction-shell :is(a, button) {
          transition: none !important;
        }
      }
    `}</style>
  );
}
