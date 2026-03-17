"use client";

import { Search, Brain, Zap, Database, Lock, TrendingUp, Sparkles, BarChart3 } from "lucide-react";
import { StatsCards } from "./StatsCards";
import { KeywordTable } from "./KeywordTable";
import { ContentIdeasList } from "./ContentIdeas";
import type { Keyword, ContentIdea } from "@/lib/types";

interface Props {
  onLoginClick: () => void;
}

// Fake data for the blurred showcase
const sampleKeywords: Keyword[] = Array.from({ length: 15 }, (_, i) => ({
  query: [
    "next.js seo optimization", "react server components", "technical seo guide",
    "core web vitals improve", "programmatic seo nextjs", "schema markup json-ld",
    "website speed optimization", "headless cms comparison", "tailwind css best practices",
    "node.js api performance", "typescript best patterns", "jamstack architecture",
    "google search console api", "content marketing strategy", "web developer portfolio",
  ][i],
  impressions: Math.floor(Math.random() * 5000) + 500,
  clicks: Math.floor(Math.random() * 200) + 10,
  ctr: Math.round(Math.random() * 800 + 100) / 100,
  position: Math.round((Math.random() * 30 + 1) * 10) / 10,
  source: i % 3 === 0 ? "bing" : "gsc",
}));

const sampleIdeas: ContentIdea[] = [
  {
    title: "Complete Guide to Next.js 15 SEO: From SSR to Structured Data",
    description: "An in-depth guide covering server-side rendering, metadata API, JSON-LD schema, and Core Web Vitals optimization in Next.js 15 applications.",
    relatedKeywords: ["next.js seo", "react ssr seo", "structured data nextjs"],
    difficulty: "medium",
    contentType: "guide",
    estimatedSearchVolume: "high",
  },
  {
    title: "How I Grew Organic Traffic 300% with Programmatic SEO",
    description: "Case study breaking down the exact programmatic SEO strategy used to scale a content platform from 15K to 50K+ monthly visitors.",
    relatedKeywords: ["programmatic seo", "organic traffic growth", "seo case study"],
    difficulty: "low",
    contentType: "case-study",
    estimatedSearchVolume: "medium",
  },
  {
    title: "Building an AI-Powered Content Strategy Tool with Claude",
    description: "Tutorial on integrating Anthropic Claude API with Google Search Console data to automate content gap analysis and idea generation.",
    relatedKeywords: ["claude api tutorial", "ai content strategy", "gsc api"],
    difficulty: "high",
    contentType: "blog",
    estimatedSearchVolume: "medium",
  },
];

const poweredBy = [
  { icon: Search, label: "Google Search Console", color: "var(--color-accent)" },
  { icon: BarChart3, label: "Bing Webmaster Tools", color: "var(--color-green)" },
  { icon: Brain, label: "Claude AI (Anthropic)", color: "var(--color-purple)" },
  { icon: TrendingUp, label: "Reddit Trends", color: "var(--color-orange)" },
];

export function VisitorOverview({ onLoginClick }: Props) {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-[var(--color-accent-glow)]">
            <Sparkles size={24} className="text-[var(--color-accent)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2">AI-Powered Content Intelligence</h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              This tool connects to Google Search Console, Bing Webmaster Tools, and Reddit to aggregate keyword data,
              then uses Claude AI to generate strategic content ideas, topic clusters, and identify content gaps.
              Below is a preview of the dashboard with sample data.
            </p>
          </div>
        </div>
      </div>

      {/* Powered By */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {poweredBy.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl"
          >
            <item.icon size={16} style={{ color: item.color }} />
            <span className="text-xs text-[var(--color-text-muted)]">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Blurred Stats */}
      <StatsCards
        totalKeywords={487}
        totalImpressions={124500}
        totalClicks={8340}
        avgPosition={14.2}
        ideasGenerated={24}
        dataSources={4}
        blurred
      />

      {/* Blurred Keyword Table */}
      <div className="relative">
        <KeywordTable keywords={sampleKeywords} blurred />
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/40 backdrop-blur-[1px] rounded-xl">
          <button
            onClick={onLoginClick}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-[var(--color-accent-glow)]"
          >
            <Lock size={16} />
            Sign in to view full data
          </button>
        </div>
      </div>

      {/* Blurred Content Ideas */}
      <div className="relative">
        <ContentIdeasList ideas={sampleIdeas} blurred />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-bg)]/30 to-[var(--color-bg)]/80 rounded-xl" />
      </div>
    </div>
  );
}
