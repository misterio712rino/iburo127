export function PortalMotionStyles() {
  return (
    <style>{`
      .portal-motion-shell {
        --iburo-motion-fast: 180ms;
        --iburo-motion-card: 200ms;
        --iburo-motion-page: 450ms;
      }

      .portal-motion-shell > aside {
        animation: iburo-portal-sidebar-enter 360ms cubic-bezier(.22,1,.36,1) both;
      }

      .portal-motion-shell > header,
      .portal-motion-shell > div > header {
        animation: iburo-portal-topbar-enter 360ms ease-out both;
      }

      .portal-motion-content {
        will-change: opacity, transform;
      }

      .portal-motion-shell nav a {
        transition:
          transform var(--iburo-motion-fast) ease-out,
          background-color var(--iburo-motion-fast) ease,
          border-color var(--iburo-motion-fast) ease,
          box-shadow var(--iburo-motion-fast) ease,
          color var(--iburo-motion-fast) ease;
      }

      .portal-motion-content [role="progressbar"] > *,
      .portal-motion-content div[style*="width"] {
        transition: width 500ms ease;
      }

      .portal-motion-content [aria-current="step"] {
        isolation: isolate;
        animation: iburo-portal-step-breathe 2.3s ease-in-out infinite;
      }

      .portal-motion-content [aria-current="step"]::after {
        content: "";
        position: absolute;
        inset: -1px;
        z-index: -1;
        border: 1px solid color-mix(in srgb, #7B2330 58%, transparent);
        border-radius: inherit;
        pointer-events: none;
        animation: iburo-portal-step-ring 2.3s ease-out infinite;
      }

      .portal-motion-content [aria-label="Этапы дела"] li > div[class*="bg-[#7B2330]"] {
        transform-origin: left center;
        animation: iburo-portal-progress-breathe 2.3s ease-in-out infinite;
      }

      @media (hover:hover) and (pointer:fine) {
        .portal-motion-shell nav a:hover {
          transform: translateX(3px);
        }

        .portal-motion-content :is(a,button)[class*="rounded"] {
          transition:
            transform var(--iburo-motion-card) ease-out,
            background-color var(--iburo-motion-fast) ease,
            border-color var(--iburo-motion-fast) ease,
            box-shadow var(--iburo-motion-card) ease-out,
            color var(--iburo-motion-fast) ease;
        }

        .portal-motion-content a[class*="rounded"]:hover {
          transform: translateY(-4px);
        }

        .portal-motion-content button[class*="rounded"]:hover {
          transform: translateY(-2px);
        }

        .portal-motion-content :is(a,button)[class*="gap-"] > svg:last-child {
          transition: transform var(--iburo-motion-card) ease-out;
        }

        .portal-motion-content :is(a,button)[class*="gap-"]:hover > svg:last-child {
          transform: translateX(3px);
        }
      }

      @keyframes iburo-portal-sidebar-enter {
        from { opacity: 0; transform: translateX(-12px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes iburo-portal-topbar-enter {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes iburo-portal-step-ring {
        0% { transform: scale(.94); opacity: .5; }
        70%,100% { transform: scale(1.52); opacity: 0; }
      }

      @keyframes iburo-portal-step-breathe {
        0%,100% { transform: scale(1); }
        50% { transform: scale(1.035); }
      }

      @keyframes iburo-portal-progress-breathe {
        0%,100% { transform: scaleX(1); filter: saturate(1); }
        50% { transform: scaleX(.985); filter: saturate(1.18); }
      }

      @media (prefers-reduced-motion: reduce) {
        .portal-motion-shell *,
        .portal-motion-shell *::before,
        .portal-motion-shell *::after {
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .01ms !important;
          scroll-behavior: auto !important;
        }

        .portal-motion-content {
          transform: none !important;
        }
      }
    `}</style>
  );
}
