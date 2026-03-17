import { Code, Search, Brain, Wrench, Gauge, Database } from "lucide-react";

const skillGroups = [
  {
    icon: Code,
    title: "Frontend",
    skills: ["React.js", "Next.js", "TypeScript", "Tailwind CSS", "HTML5/CSS3", "Redux"],
  },
  {
    icon: Database,
    title: "Backend & CMS",
    skills: ["Node.js", "WordPress", "PHP", "MySQL", "PostgreSQL", "REST APIs"],
  },
  {
    icon: Brain,
    title: "AI / ML",
    skills: ["Python", "LangChain", "OpenAI SDK", "RAG Pipelines", "scikit-learn", "TensorFlow"],
  },
  {
    icon: Search,
    title: "SEO & Analytics",
    skills: ["Technical SEO", "Schema Markup", "Google Search Console", "GA4", "Core Web Vitals", "Ahrefs"],
  },
  {
    icon: Gauge,
    title: "Performance",
    skills: ["Code Splitting", "Lazy Loading", "Image Optimization", "Caching", "Lighthouse", "SSR/SSG"],
  },
  {
    icon: Wrench,
    title: "Tools",
    skills: ["Git/GitHub", "Docker", "Vercel", "Figma", "n8n", "VS Code"],
  },
];

export function Skills() {
  return (
    <section id="skills" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-heading">Skills</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Tech I work with
        </h2>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skillGroups.map((group, i) => (
            <div
              key={i}
              className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-hover)] transition-colors card-glow group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--color-accent-glow)] group-hover:bg-[var(--color-accent)] transition-colors">
                  <group.icon
                    size={18}
                    className="text-[var(--color-accent)] group-hover:text-white transition-colors"
                  />
                </div>
                <h3 className="font-semibold">{group.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.skills.map((s, j) => (
                  <span
                    key={j}
                    className="px-2.5 py-1 text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md"
                  >
                    {s}
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
