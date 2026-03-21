import type { Metadata } from "next";
import { Wrench, Sparkles, ArrowRight, Send, Newspaper } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free SEO & Web Tools",
  description:
    "Free developer and SEO tools built by Shoumya Chowdhury. AI-powered content ideas generator and more.",
};

const tools = [
  {
    title: "Topic Discovery",
    desc: "Discovers new content topics by analyzing GSC keywords, Bing data, DataForSEO PAA questions, and Quora — scored, deduped against your WordPress posts, and clustered by Claude AI.",
    status: "Live",
    color: "var(--color-accent)",
    icon: Sparkles,
    href: "/tools/content-ideas",
  },
  {
    title: "Guest Post Outreach",
    desc: "Automated outreach system that finds guest post opportunities, sends personalized emails, tracks replies, and generates human-written content with smart backlinks.",
    status: "Live",
    color: "var(--color-green)",
    icon: Send,
    href: "/tools/guest-post-outreach",
  },
  {
    title: "HARO Auto-Responder",
    desc: "Monitors your inbox for journalist queries from SourceBottle, Qwoted & Featured, then auto-generates and sends expert responses to earn media coverage and backlinks.",
    status: "Live",
    color: "var(--color-purple)",
    icon: Newspaper,
    href: "/tools/haro-responder",
  },
];

export default function ToolsPage() {
  return (
    <section className="min-h-screen pt-24 sm:pt-28 pb-16 sm:pb-24 px-4 sm:px-6">
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
          A collection of tools I build to solve real SEO and web development
          problems. Each tool is powered by real data and AI.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, i) => {
            const isLive = tool.status === "Live";
            const Wrapper = isLive ? Link : "div";

            return (
              <Wrapper
                key={i}
                href={tool.href}
                className={`group p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl card-glow transition-all ${
                  isLive ? "cursor-pointer hover:border-[var(--color-border-hover)]" : ""
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${tool.color} 15%, transparent)`,
                  }}
                >
                  <tool.icon size={18} style={{ color: tool.color }} />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-[var(--color-accent)] transition-colors">
                  {tool.title}
                </h3>
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
                  {isLive && <ArrowRight size={12} />}
                </span>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}
