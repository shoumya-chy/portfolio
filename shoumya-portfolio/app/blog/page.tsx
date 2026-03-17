import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Articles on web development, SEO strategies, AI engineering, and performance optimization by Shoumya Chowdhury.",
};

export default function BlogPage() {
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
          <BookOpen size={20} className="text-[var(--color-accent)]" />
          <p className="section-heading mb-0">Blog</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Thoughts &amp; Insights
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl">
          Writing about web development, SEO strategies, AI engineering, and
          lessons learned building for the web.
        </p>

        <div className="mt-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center mb-4">
            <BookOpen
              size={28}
              className="text-[var(--color-text-dim)]"
            />
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-muted)]">
            Coming Soon
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-dim)] max-w-md">
            I&apos;m working on some articles about Next.js performance, technical
            SEO, and building AI-powered web tools. Stay tuned!
          </p>
        </div>
      </div>
    </section>
  );
}
