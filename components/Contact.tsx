import { Mail, Linkedin, Github, MapPin } from "lucide-react";

const links = [
  {
    icon: Mail,
    label: "Email",
    value: "shoumyachowdhury@gmail.com",
    href: "mailto:shoumyachowdhury@gmail.com",
  },
  {
    icon: Linkedin,
    label: "LinkedIn",
    value: "shoumya-chowdhury",
    href: "https://www.linkedin.com/in/shoumya-chowdhury/",
  },
  {
    icon: Github,
    label: "GitHub",
    value: "shoumya-chy",
    href: "https://github.com/shoumya-chy",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Melbourne, VIC, Australia",
    href: "#",
  },
];

export function Contact() {
  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <p className="section-heading">Contact</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Let&apos;s connect
        </h2>
        <p className="mt-4 text-[var(--color-text-muted)] max-w-lg mx-auto">
          I&apos;m always open to new opportunities, collaborations, or just a
          good conversation about web performance and SEO.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex items-center gap-4 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-hover)] transition-all group card-glow"
            >
              <div className="p-2.5 rounded-lg bg-[var(--color-accent-glow)] group-hover:bg-[var(--color-accent)] transition-colors">
                <link.icon
                  size={18}
                  className="text-[var(--color-accent)] group-hover:text-white transition-colors"
                />
              </div>
              <div className="text-left">
                <p className="text-xs text-[var(--color-text-dim)]">
                  {link.label}
                </p>
                <p className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
                  {link.value}
                </p>
              </div>
            </a>
          ))}
        </div>

        <a
          href="mailto:shoumyachowdhury@gmail.com"
          className="inline-block mt-10 px-8 py-3.5 text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all hover:shadow-lg hover:shadow-[var(--color-accent-glow)]"
        >
          Say Hello
        </a>
      </div>
    </section>
  );
}
