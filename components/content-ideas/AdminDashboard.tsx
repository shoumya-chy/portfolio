"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, Loader2, Download, Trash2, AlertCircle, ChevronDown, Globe } from "lucide-react";
import { StatsCards } from "./StatsCards";
import { KeywordTable } from "./KeywordTable";
import { ContentIdeasList } from "./ContentIdeas";
import { TopicClusters } from "./TopicClusters";
import type { KeywordData, TrendingTopic, AnalysisResult, Keyword } from "@/lib/types";

interface SiteOption {
  id: string;
  name: string;
  url: string;
}

interface Props {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: Props) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [gsc, setGsc] = useState<KeywordData | null>(null);
  const [bing, setBing] = useState<KeywordData | null>(null);
  const [reddit, setReddit] = useState<TrendingTopic[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch sites list on mount
  useEffect(() => {
    fetch("/api/admin/sites")
      .then((r) => r.json())
      .then((d) => {
        const list: SiteOption[] = d.sites || [];
        setSites(list);
        if (list.length > 0) setSelectedSite(list[0].url);
      })
      .catch(() => setSites([]));
  }, []);

  const setLoadingKey = (key: string, val: boolean) =>
    setLoading((p) => ({ ...p, [key]: val }));
  const setErrorKey = (key: string, val: string) =>
    setErrors((p) => ({ ...p, [key]: val }));

  const fetchData = useCallback(async (endpoint: string, key: string, siteUrl: string) => {
    setLoadingKey(key, true);
    setErrorKey(key, "");
    try {
      const res = await fetch(`/api/tools/content-ideas/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setErrorKey(key, msg);
      return null;
    } finally {
      setLoadingKey(key, false);
    }
  }, []);

  const loadAll = useCallback(async (siteUrl: string) => {
    if (!siteUrl) return;
    const [gscData, bingData, redditData] = await Promise.all([
      fetchData("gsc", "gsc", siteUrl),
      fetchData("bing", "bing", siteUrl),
      fetchData("reddit", "reddit", siteUrl),
    ]);
    if (gscData) setGsc(gscData);
    else setGsc(null);
    if (bingData) setBing(bingData);
    else setBing(null);
    if (redditData) setReddit(redditData);
    else setReddit([]);
    setAnalysis(null);
  }, [fetchData]);

  // Reload data when selected site changes
  useEffect(() => {
    if (selectedSite) loadAll(selectedSite);
  }, [selectedSite, loadAll]);

  const allKeywords: Keyword[] = [
    ...(gsc?.keywords || []),
    ...(bing?.keywords || []),
  ];

  const runAnalysis = async () => {
    if (!allKeywords.length || !selectedSite) return;
    setLoadingKey("analysis", true);
    setErrorKey("analysis", "");
    try {
      const res = await fetch("/api/tools/content-ideas/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: allKeywords, trendingTopics: reddit, siteUrl: selectedSite }),
      });
      if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
      const json = await res.json();
      setAnalysis(json.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setErrorKey("analysis", msg);
    } finally {
      setLoadingKey("analysis", false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  const exportCSV = () => {
    if (!allKeywords.length) return;
    const header = "Query,Impressions,Clicks,CTR,Position,Source\n";
    const rows = allKeywords
      .map((k) => `"${k.query}",${k.impressions},${k.clicks},${k.ctr},${k.position},${k.source}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const siteName = sites.find((s) => s.url === selectedSite)?.name || "all";
    a.download = `keywords-${siteName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSiteChange = (url: string) => {
    setSelectedSite(url);
    setGsc(null);
    setBing(null);
    setReddit([]);
    setAnalysis(null);
    setErrors({});
  };

  const isAnyLoading = Object.values(loading).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Site Selector */}
      {sites.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
          <Globe size={18} className="text-[var(--color-accent)] shrink-0" />
          <span className="text-sm font-medium text-[var(--color-text-dim)] shrink-0">Site:</span>
          <div className="relative">
            <select
              value={selectedSite}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="appearance-none bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 pr-8 text-sm text-[var(--color-text)] cursor-pointer hover:border-[var(--color-border-hover)] transition-colors focus:outline-none focus:border-[var(--color-accent)]"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.url}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-dim)]" />
          </div>
        </div>
      )}

      {sites.length === 0 && (
        <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-muted)]">
          No sites configured yet. Go to <a href="/admin/settings" className="text-[var(--color-accent)] hover:underline">Settings</a> to add your first site.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-muted)]">Admin Mode</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAll(selectedSite)}
            disabled={isAnyLoading || !selectedSite}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={isAnyLoading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={runAnalysis}
            disabled={loading.analysis || !allKeywords.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading.analysis ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading.analysis ? "Analyzing..." : "Generate Ideas"}
          </button>
          <button
            onClick={exportCSV}
            disabled={!allKeywords.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {/* Errors */}
      {Object.entries(errors)
        .filter(([, v]) => v)
        .map(([key, msg]) => (
          <div
            key={key}
            className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg"
          >
            <AlertCircle size={16} />
            <span className="font-medium capitalize">{key}:</span> {msg}
          </div>
        ))}

      {/* Stats */}
      <StatsCards
        totalKeywords={allKeywords.length}
        totalImpressions={(gsc?.totalImpressions || 0) + (bing?.totalImpressions || 0)}
        totalClicks={(gsc?.totalClicks || 0) + (bing?.totalClicks || 0)}
        avgPosition={
          gsc?.avgPosition && bing?.avgPosition
            ? Math.round(((gsc.avgPosition + bing.avgPosition) / 2) * 10) / 10
            : gsc?.avgPosition || bing?.avgPosition || 0
        }
        ideasGenerated={analysis?.ideas?.length || 0}
        dataSources={
          (gsc ? 1 : 0) + (bing ? 1 : 0) + (reddit.length ? 1 : 0) + (analysis ? 1 : 0)
        }
      />

      {/* Keyword Table */}
      {loading.gsc || loading.bing ? (
        <div className="flex items-center justify-center py-12 text-[var(--color-text-dim)]">
          <Loader2 size={20} className="animate-spin mr-2" />
          Fetching keyword data...
        </div>
      ) : allKeywords.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-3">Keywords ({allKeywords.length})</h3>
          <KeywordTable keywords={allKeywords} />
        </div>
      ) : (
        <div className="text-center py-12 text-[var(--color-text-dim)]">
          No keyword data yet. Check your GSC/Bing configuration.
        </div>
      )}

      {/* Reddit Topics */}
      {reddit.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Trending Topics ({reddit.length})</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {reddit.slice(0, 10).map((t, i) => (
              <a
                key={i}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-border-hover)] transition-colors text-sm"
              >
                <span className="shrink-0 text-xs font-mono text-[var(--color-orange)] mt-0.5">
                  r/{t.subreddit}
                </span>
                <span className="text-[var(--color-text-muted)] line-clamp-2">{t.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          <ContentIdeasList ideas={analysis.ideas} />
          <TopicClusters clusters={analysis.clusters} gaps={analysis.gaps} />
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <h3 className="text-sm font-semibold text-[var(--color-text-dim)] mb-2">Summary</h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{analysis.summary}</p>
            <p className="text-xs text-[var(--color-text-dim)] mt-2">
              Analyzed at {new Date(analysis.analyzedAt).toLocaleString()}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
