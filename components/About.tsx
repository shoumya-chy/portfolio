import { Briefcase, GraduationCap, Award } from "lucide-react";

const highlights = [
  { icon: Briefcase, label: "7+ Years", desc: "Building web apps" },
  { icon: GraduationCap, label: "MIT (AI)", desc: "Univ. of Melbourne" },
  { icon: Award, label: "IEEE Published", desc: "Research author" },
];

export function About() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-heading">About</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Developer, optimizer, builder.
        </h2>

        <div className="mt-8 grid md:grid-cols-[1fr_auto] gap-12 items-start">
          <div className="space-y-4 text-[var(--color-text-muted)] leading-relaxed">
            <p>
              I&apos;m a Full-Stack Developer and SEO Specialist based in Melbourne,
              with a passion for building web applications that are not only
              performant but also discoverable. My journey spans 7+ years across
              frontend development, technical SEO, and AI engineering.
            </p>
            <p>
              Currently, I work as an AI Automation Engineer at Traffic Radius
              where I build LLM-powered web features, while pursuing my
              Master&apos;s in AI at the University of Melbourne as an Australia
              Awards Scholar. I&apos;ve migrated platforms to Next.js, scaled
              sites to 50K+ monthly visitors, and published research in IEEE.
            </p>
            <p>
              I believe the best websites are invisible — they load instantly,
              rank effortlessly, and feel intuitive. That&apos;s what I build.
            </p>
          </div>

          <div className="flex md:flex-col gap-4">
            {highlights.map((h, i) => (
              <div
                key={i}
                className="flex-1 md:flex-none flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl"
              >
                <div className="p-2 rounded-lg bg-[var(--color-accent-glow)]">
                  <h.icon size={18} className="text-[var(--color-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{h.label}</p>
                  <p className="text-xs text-[var(--color-text-dim)]">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
