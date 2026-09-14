type ArticleCardProps = {
  title: string;
  description: string;
  href: string;
};

export default function ArticleCard({ title, description, href }: ArticleCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-black/10 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
      <h3 className="mb-3 text-xl font-semibold text-[#111111]">{title}</h3>
      <p className="mb-6 text-base leading-7 text-[#4b4b4b]">{description}</p>
      <a href={href} className="text-sm font-semibold text-[#ff8a00] transition hover:text-[#e67d00]">
        Читать далее →
      </a>
    </article>
  );
}
