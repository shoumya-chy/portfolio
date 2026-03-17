import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SEO Work & Case Studies",
  description:
    "SEO case studies and results by Shoumya Chowdhury. Technical SEO, programmatic SEO, and organic growth strategies.",
};

export default function SeoWorkPage() {
  return (
    <section className="min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors mb-8"
        >
          &larr; Home
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Search size={20} className="text-[var(--color-green)]" />
          <p className="section-heading mb-0">SEO Work</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          SEO Case Studies
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl">
          Detailed breakdowns of SEO strategies, technical implementations, and
          measurable results across my projects.
        </p>

        <div className="mt-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center mb-4">
            <Search
              size={28}
              className="text-[var(--color-text-dim)]"
            />
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-muted)]">
            Coming Soon
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-dim)] max-w-md">
            I&apos;m documenting my SEO work including the 300% traffic growth
            strategy, Next.js migration case study, and programmatic SEO
            techniques.
          </p>
        </div>
      </div>
    </section>
  );
}
