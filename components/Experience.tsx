const experiences = [
  {
    role: "AI Automation Engineer",
    company: "Traffic Radius",
    location: "Melbourne, VIC",
    period: "Dec 2025 — Present",
    color: "var(--color-accent)",
    points: [
      "Building React/Next.js interfaces integrated with LLM and AI APIs for production-ready web features",
      "Developing AI-powered automation workflows using agentic frameworks and model SDKs",
      "Collaborating with marketing and product teams to ship LLM-powered interactive demos",
    ],
  },
  {
    role: "Front-End Developer & SEO Engineer",
    company: "Kulaa",
    location: "Melbourne, VIC",
    period: "Jul — Nov 2025",
    color: "var(--color-green)",
    points: [
      "Led migration from React+Vite to Next.js, improving load speeds by 40% with SSR",
      "Built Python and n8n automation pipelines integrating Google Sheets APIs for data-driven insights",
      "Implemented SEO infrastructure from scratch: dynamic sitemaps, JSON-LD, Core Web Vitals optimization",
    ],
  },
  {
    role: "Co-Founder & Lead Developer",
    company: "knowworldnow.com",
    location: "Remote",
    period: "2018 — Present",
    color: "var(--color-purple)",
    points: [
      "Scaled platform to 50,000+ monthly visitors through strategic technical SEO and programmatic content",
      "Built full-stack WordPress and Next.js infrastructure achieving 90+ Lighthouse scores consistently",
      "Drove 300% organic traffic growth through keyword clustering, internal linking, and schema markup",
    ],
  },
  {
    role: "IT Training Coordinator",
    company: "Dept. of Youth Development",
    location: "Bangladesh",
    period: "2020 — 2024",
    color: "var(--color-orange)",
    points: [
      "Designed and delivered IT training programs for 50-200 participants across multiple locations",
      "Developed curriculum covering digital literacy, productivity tools, and introductory programming",
    ],
  },
];

export function Experience() {
  return (
    <section id="experience" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-heading">Experience</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Where I&apos;ve worked
        </h2>

        <div className="mt-12 relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border)] hidden md:block" />

          <div className="space-y-10">
            {experiences.map((exp, i) => (
              <div key={i} className="relative md:pl-10">
                {/* Timeline dot */}
                <div
                  className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 hidden md:block"
                  style={{
                    borderColor: exp.color,
                    backgroundColor: "var(--color-bg)",
                  }}
                >
                  <div
                    className="absolute inset-[3px] rounded-full"
                    style={{ backgroundColor: exp.color }}
                  />
                </div>

                <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-hover)] transition-colors card-glow">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{exp.role}</h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {exp.company}{" "}
                        <span className="text-[var(--color-text-dim)]">
                          · {exp.location}
                        </span>
                      </p>
                    </div>
                    <span
                      className="text-xs font-mono px-2 py-1 rounded-md border"
                      style={{
                        color: exp.color,
                        borderColor: exp.color,
                        backgroundColor: `color-mix(in srgb, ${exp.color} 10%, transparent)`,
                      }}
                    >
                      {exp.period}
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {exp.points.map((p, j) => (
                      <li
                        key={j}
                        className="flex gap-2 text-sm text-[var(--color-text-muted)]"
                      >
                        <span
                          className="mt-2 w-1 h-1 rounded-full shrink-0"
                          style={{ backgroundColor: exp.color }}
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
