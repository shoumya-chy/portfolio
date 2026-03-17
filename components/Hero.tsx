import { ArrowDown, MapPin } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 pt-20">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Gradient orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] md:w-[600px] md:h-[600px] rounded-full bg-[var(--color-accent)] opacity-[0.04] blur-[120px] pointer-events-none" />

      <div className="relative max-w-3xl text-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-full">
            <span className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
            <MapPin size={12} />
            Melbourne, Australia
          </div>
        </div>

        <h1 className="animate-fade-up stagger-1 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Hi, I&apos;m{" "}
          <span className="gradient-text">Shoumya</span>
        </h1>

        <p className="animate-fade-up stagger-2 mt-4 text-lg sm:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
          Full-Stack Developer &amp; SEO Specialist building fast, discoverable,
          AI&#8209;powered web experiences. Currently pursuing{" "}
          <span className="text-[var(--color-text)]">
            Masters in AI
          </span>{" "}
          at the University of Melbourne.
        </p>

        <div className="animate-fade-up stagger-3 mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#projects"
            className="px-6 py-3 text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all hover:shadow-lg hover:shadow-[var(--color-accent-glow)]"
          >
            View My Work
          </a>
          <a
            href="#contact"
            className="px-6 py-3 text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] rounded-lg transition-all"
          >
            Get In Touch
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="animate-fade-up stagger-5 mt-16">
          <a
            href="#about"
            className="inline-flex flex-col items-center gap-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors"
          >
            <span>scroll</span>
            <ArrowDown size={14} className="animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
}
