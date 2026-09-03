export function ManagerInteractionStyles() {
  return (
    <style>{`
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
    `}</style>
  );
}
