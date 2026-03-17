import type { Metadata } from "next";
import { Wrench, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free SEO & Web Tools",
  description:
    "Free developer and SEO tools built by Shoumya Chowdhury. Content ideas generator, broken link checker, and more.",
};

const tools = [
  {
    title: "Content Ideas Generator",
    desc: "AI-powered tool that generates content ideas and topic clusters for your niche.",
    status: "Coming Soon",
    color: "var(--color-accent)",
  },
  {
    title: "404 Finder",
    desc: "Scan any URL and instantly find broken links that hurt your SEO rankings.",
    status: "Coming Soon",
    color: "var(--color-green)",
  },
  {
    title: "Meta Tag Analyzer",
    desc: "Check if your pages have proper meta tags, Open Graph, and structured data.",
    status: "Coming Soon",
    color: "var(--color-purple)",
  },
];

export default function ToolsPage() {
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
          <Wrench size={20} className="text-[var(--color-accent)]" />
          <p className="section-heading mb-0">Tools</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Free SEO &amp; Web Tools
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl">
          A collection of free tools I&apos;m building to help developers and
          marketers improve their web presence.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, i) => (
            <div
              key={i}
              className="group p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl card-glow"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{
                  backgroundColor: `color-mix(in srgb, ${tool.color} 15%, transparent)`,
                }}
              >
                <Wrench size={18} style={{ color: tool.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{tool.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                {tool.desc}
              </p>
              <span
                className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md border"
                style={{
                  color: tool.color,
                  borderColor: tool.color,
                }}
              >
                {tool.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
