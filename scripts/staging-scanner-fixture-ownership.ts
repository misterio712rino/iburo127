// A smoke test must never delete or overwrite an object that existed before it.
// Inspect only the two exact, run-scoped synthetic fixture keys; never enumerate a store.
export async function assertStagingScannerFixtureKeysAbsent(
  keys: readonly string[],
  stat: (key: string) => Promise<unknown>,
): Promise<void> {
  for (const key of keys) {
    if (await stat(key)) throw new Error("STAGING_SCANNER_FIXTURE_ALREADY_EXISTS");
  }
}
