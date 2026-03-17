import { ExternalLink, Github } from "lucide-react";

const projects = [
  {
    title: "knowworldnow.com",
    desc: "Global information platform reaching 50K+ monthly visitors. Built with Next.js, SSR/SSG, and programmatic SEO strategies that drove 300% organic traffic growth.",
    tags: ["Next.js", "WordPress", "SEO", "MySQL"],
    url: "https://knowworldnow.com",
    featured: true,
    metric: "50K+ monthly visitors",
  },
  {
    title: "AI Content Intelligence Engine",
    desc: "LLM-integrated content analysis tool using RAG, vector databases, and AWS services for automated content strategy recommendations.",
    tags: ["Python", "LangChain", "RAG", "ChromaDB"],
    github: "#",
    featured: true,
    metric: "In Progress",
  },
  {
    title: "ctoftemp.com",
    desc: "SEO-optimized temperature conversion tool with programmatic page generation for 200+ queries. First-page Google rankings with structured data and semantic HTML.",
    tags: ["Next.js", "TypeScript", "SSR", "PostgreSQL"],
    url: "https://ctoftemp.com",
    featured: false,
    metric: "200+ pages ranked",
  },
  {
    title: "mytithecalculator.com",
    desc: "Responsive financial calculator with real-time calculations, input validation, and mobile-optimized interface focused on Core Web Vitals.",
    tags: ["React.js", "JavaScript", "SEO"],
    url: "https://mytithecalculator.com",
    featured: false,
    metric: "90+ Lighthouse",
  },
];

export function Projects() {
  return (
    <section id="projects" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-heading">Projects</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Things I&apos;ve built
        </h2>

        <div className="mt-12 grid md:grid-cols-2 gap-4">
          {projects.map((p, i) => (
            <div
              key={i}
              className={`group p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-hover)] transition-all card-glow ${
                p.featured ? "md:col-span-1" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold group-hover:text-[var(--color-accent)] transition-colors">
                    {p.title}
                  </h3>
                  <span className="inline-block mt-1 text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
                    {p.metric}
                  </span>
                </div>
                <div className="flex gap-2">
                  {p.github && (
                    <a
                      href={p.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
                      aria-label={`${p.title} source code`}
                    >
                      <Github size={16} />
                    </a>
                  )}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
                      aria-label={`Visit ${p.title}`}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>

              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                {p.desc}
              </p>

              <div className="flex flex-wrap gap-2">
                {p.tags.map((t, j) => (
                  <span
                    key={j}
                    className="px-2 py-0.5 text-xs font-mono text-[var(--color-text-dim)] border border-[var(--color-border)] rounded-md"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
