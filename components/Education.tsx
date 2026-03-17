import { GraduationCap, Award, BookOpen } from "lucide-react";

const education = [
  {
    icon: GraduationCap,
    degree: "Master of Information Technology (AI)",
    school: "University of Melbourne",
    period: "2024 — Present",
    details: "Australia Awards Scholar. Coursework: Machine Learning, NLP, Database Management, AI Autonomy, Cluster Computing.",
    color: "var(--color-accent)",
  },
  {
    icon: BookOpen,
    degree: "B.Sc. Electrical & Electronic Engineering",
    school: "CUET, Bangladesh",
    period: "2012 — 2017",
    details: "CGPA: 3.47/4.00. Published IEEE research on speaker recognition using neural auditory-system models.",
    color: "var(--color-purple)",
  },
];

const achievements = [
  "Australia Awards Scholar — selected by DFAT for academic excellence",
  "Published IEEE research on speaker recognition systems",
  "Grew organic traffic by 300% across multiple web properties",
  "Managed 200+ WordPress projects",
  "90+ Lighthouse scores on production websites",
  "IELTS 7.5 overall (Academic)",
];

export function Education() {
  return (
    <section id="education" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="section-heading">Education</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Background
        </h2>

        <div className="mt-12 grid md:grid-cols-2 gap-4">
          {education.map((edu, i) => (
            <div
              key={i}
              className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl card-glow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${edu.color} 15%, transparent)`,
                  }}
                >
                  <edu.icon size={18} style={{ color: edu.color }} />
                </div>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-md border"
                  style={{
                    color: edu.color,
                    borderColor: edu.color,
                  }}
                >
                  {edu.period}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{edu.degree}</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                {edu.school}
              </p>
              <p className="text-sm text-[var(--color-text-dim)] mt-3 leading-relaxed">
                {edu.details}
              </p>
            </div>
          ))}
        </div>

        {/* Achievements */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-6">
            <Award size={18} className="text-[var(--color-orange)]" />
            <h3 className="text-lg font-semibold">Achievements</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-4 py-3 text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-orange)] shrink-0" />
                {a}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
