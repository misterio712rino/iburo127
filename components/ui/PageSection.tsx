type PageSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function PageSection({ eyebrow, title, description, children }: PageSectionProps) {
  return (
    <section className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            {title}
          </h2>
          {description ? <p className="mt-4 text-lg leading-8 text-[#4b4b4b]">{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
