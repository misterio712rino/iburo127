export default function PlatformLoading() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6" aria-busy="true" aria-label="Загрузка кабинета">
        <div className="h-10 w-56 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,.7fr)]">
          <div className="h-56 animate-pulse rounded-[2rem] border border-border bg-card/70" />
          <div className="h-56 animate-pulse rounded-[2rem] border border-border bg-card/70" />
        </div>
        <div className="h-40 animate-pulse rounded-[2rem] border border-border bg-card/70" />
      </div>
    </main>
  );
}
