export function AuthInteractionStyles() {
  return (
    <style>{`
      .auth-interaction-shell button {
        min-height: 44px;
      }

      .auth-interaction-shell :is(a[href="/auth/sign-in"], a[href="/auth/forgot-password"]) {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding-inline: 8px;
        border-radius: 10px;
      }

      .auth-interaction-shell :is(button, a[href="/auth/sign-in"], a[href="/auth/forgot-password"]):focus-visible {
        outline: 3px solid #7b2330;
        outline-offset: 3px;
      }
    `}</style>
  );
}
