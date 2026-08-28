export default function PortalLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8 sm:px-8">
      <div className="h-12 w-32 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-8 h-5 w-40 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-14 w-full max-w-2xl animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-[28px] border border-white/80 bg-white/70" />
        ))}
      </div>
    </div>
  );
}
