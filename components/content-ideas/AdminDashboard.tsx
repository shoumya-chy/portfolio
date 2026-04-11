"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, Loader2, Download, Sparkles, AlertCircle, ChevronDown, Globe, Search, Filter } from "lucide-react";
import { StatsCards } from "./StatsCards";
import { KeywordTable } from "./KeywordTable";
import type { KeywordData, Keyword, DiscoveryResult, TopicRecommendation } from "@/lib/types";

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
  const [wpPostCount, setWpPostCount] = useState<number | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Fetch sites list
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

  const safeJson = async (res: Response) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch {
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100).replace(/<[^>]+>/g, "").trim()}`);
    }
  };

  const fetchData = useCallback(async (endpoint: string, key: string, siteUrl: string) => {
    setLoadingKey(key, true);
    setErrorKey(key, "");
    try {
      const res = await fetch(`/api/tools/content-ideas/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      return json.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setErrorKey(key, msg);
      return null;
    } finally {
      setLoadingKey(key, false);
    }
  }, []);

  const loadKeywords = useCallback(async (siteUrl: string) => {
    if (!siteUrl) return;
    const [gscData, bingData, wpData] = await Promise.all([
      fetchData("gsc", "gsc", siteUrl),
      fetchData("bing", "bing", siteUrl),
      fetchData("wordpress", "wordpress", siteUrl),
    ]);
    if (gscData) setGsc(gscData); else setGsc(null);
    if (bingData) setBing(bingData); else setBing(null);
    if (wpData) setWpPostCount(wpData.content?.length || 0); else setWpPostCount(null);
  }, [fetchData]);

  // Load cached discovery results only — instant, never triggers pipeline
  const loadCachedDiscovery = useCallback(async (siteUrl: string) => {
    if (!siteUrl) return;
    try {
      const res = await fetch("/api/tools/content-ideas/discover-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const json = await res.json();
      if (res.ok && json.data?.recommendations?.length > 0) {
        setDiscovery(json.data);
      } else {
        setDiscovery(null);
      }
    } catch {
      setDiscovery(null);
    }
  }, []);

  useEffect(() => {
    if (selectedSite) {
      loadKeywords(selectedSite);
      loadCachedDiscovery(selectedSite);
    }
  }, [selectedSite, loadKeywords, loadCachedDiscovery]);

  const runDiscovery = async () => {
    if (!selectedSite) return;
    setLoadingKey("discovery", true);
    setErrorKey("discovery", "");
    try {
      const res = await fetch("/api/tools/content-ideas/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: selectedSite, force: true }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error || "Discovery failed");
      setDiscovery(json.data);
      setClusterFilter("all");
      setSourceFilter("all");
    } catch (err) {
      setErrorKey("discovery", err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoadingKey("discovery", false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  const handleSiteChange = (url: string) => {
    setSelectedSite(url);
    setGsc(null);
    setBing(null);
    setWpPostCount(null);
    setDiscovery(null);
    setErrors({});
  };

  const allKeywords: Keyword[] = [...(gsc?.keywords || []), ...(bing?.keywords || [])];
  const isAnyLoading = Object.values(loading).some(Boolean);

  // Filter recommendations
  const filteredRecs = (discovery?.recommendations || []).filter(r => {
    if (clusterFilter !== "all" && r.cluster !== clusterFilter) return false;
    if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
    return true;
  });

  const clusters = [...new Set((discovery?.recommendations || []).map(r => r.cluster))];
  const sources = [...new Set((discovery?.recommendations || []).map(r => r.source))];

  const exportCSV = () => {
    if (!discovery?.recommendations.length) return;
    const header = "Rank,SuggestedTitle,Topic,Cluster,Source,Score,Rationale\n";
    const rows = discovery.recommendations
      .map((r, i) => `${i + 1},"${(r.suggestedTitle || "").replace(/"/g, '""')}","${r.topic.replace(/"/g, '""')}","${r.cluster}","${r.source}",${r.score},"${r.rationale.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topic-discovery-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Site Selector */}
      {sites.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
          <Globe size={18} className="text-[var(--color-accent)] shrink-0" />
          <span className="text-sm font-medium text-[var(--color-text-dim)] shrink-0">Site:</span>
          <div className="relative">
            <select
              value={selectedSite}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="appearance-none bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 pr-8 text-sm text-[var(--color-text)] cursor-pointer hover:border-[var(--color-border-hover)] transition-colors focus:outline-none focus:border-[var(--color-accent)]"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.url}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-dim)]" />
          </div>
          {wpPostCount !== null && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-green-400/10 text-green-400 border border-green-400/20">
              WP: {wpPostCount} posts
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-muted)]">Admin Mode</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => loadKeywords(selectedSite)} disabled={isAnyLoading || !selectedSite}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={loading.gsc || loading.bing ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={runDiscovery} disabled={loading.discovery || !selectedSite}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg disabled:opacity-50 transition-colors">
            {loading.discovery ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading.discovery ? "Discovering..." : "Discover Topics"}
          </button>
          {discovery && (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] transition-colors">
              <Download size={14} /> CSV
            </button>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Errors */}
      {Object.entries(errors).filter(([, v]) => v).map(([key, msg]) => (
        <div key={key} className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
          <AlertCircle size={16} />
          <span className="font-medium capitalize">{key}:</span> {msg}
        </div>
      ))}

      {/* Stats */}
      <StatsCards
        totalKeywords={allKeywords.length}
        totalImpressions={gsc?.totalImpressions || 0}
        totalClicks={gsc?.totalClicks || 0}
        avgPosition={gsc?.avgPosition || 0}
        ideasGenerated={discovery?.recommendations?.length || 0}
        dataSources={
          (gsc ? 1 : 0) + (bing ? 1 : 0) + (wpPostCount !== null ? 1 : 0) +
          (discovery?.stats?.paaQuestions ? 1 : 0) + (discovery?.stats?.quoraTopics ? 1 : 0)
        }
      />

      {/* Pipeline Stats (when discovery is complete) */}
      {discovery?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xl font-bold text-[var(--color-accent)]">{discovery.stats.totalCandidates}</div>
            <div className="text-xs text-[var(--color-text-dim)]">Candidates Found</div>
          </div>
          <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xl font-bold text-orange-400">{discovery.stats.afterDedup}</div>
            <div className="text-xs text-[var(--color-text-dim)]">After Dedup</div>
          </div>
          <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xl font-bold text-red-400">{discovery.stats.afterDedup - discovery.stats.afterExclusion}</div>
            <div className="text-xs text-[var(--color-text-dim)]">Excluded (Published)</div>
          </div>
          <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xl font-bold text-green-400">{discovery.stats.finalRecommendations}</div>
            <div className="text-xs text-[var(--color-text-dim)]">Recommendations</div>
          </div>
        </div>
      )}

      {/* Discovery Results */}
      {discovery && discovery.recommendations.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          {discovery.summary && (
            <div className="p-4 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20 rounded-xl">
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{discovery.summary}</p>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--color-accent)]" />
              <h3 className="font-semibold">Topic Recommendations</h3>
              <span className="text-xs font-mono text-[var(--color-text-dim)]">
                {filteredRecs.length} of {discovery.recommendations.length}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Filter size={14} className="text-[var(--color-text-dim)]" />
              <select value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)}
                className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]">
                <option value="all">All Clusters</option>
                {clusters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]">
                <option value="all">All Sources</option>
                {sources.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {/* Recommendations Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[var(--color-text-dim)] border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-3 w-10">#</th>
                  <th className="text-left py-3 px-3">Topic</th>
                  <th className="text-left py-3 px-3 hidden sm:table-cell">Cluster</th>
                  <th className="text-left py-3 px-3 hidden md:table-cell">Source</th>
                  <th className="text-right py-3 px-3 w-16">Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecs.map((rec, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card)] transition-colors">
                    <td className="py-3 px-3 text-[var(--color-text-dim)] font-mono">{i + 1}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium mb-1">{rec.suggestedTitle || rec.topic}</div>
                      {rec.suggestedTitle && rec.suggestedTitle !== rec.topic && (
                        <div className="text-xs text-[var(--color-text-dim)] italic mb-1">Query: {rec.topic}</div>
                      )}
                      <div className="text-xs text-[var(--color-text-dim)]">{rec.rationale}</div>
                      <div className="sm:hidden mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-dim)]">
                          {rec.cluster}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
                        {rec.cluster}
                      </span>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                        rec.source === "gsc" ? "text-blue-400 border-blue-400/30" :
                        rec.source === "paa" ? "text-purple-400 border-purple-400/30" :
                        rec.source === "bing" ? "text-green-400 border-green-400/30" :
                        rec.source === "quora" ? "text-red-400 border-red-400/30" :
                        "text-[var(--color-text-dim)] border-[var(--color-border)]"
                      }`}>
                        {rec.source.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="relative w-12 h-6 bg-[var(--color-bg)] rounded-full overflow-hidden ml-auto">
                        <div className="absolute inset-y-0 left-0 bg-[var(--color-accent)]/30 rounded-full" style={{ width: `${rec.score}%` }} />
                        <span className="relative text-xs font-bold text-[var(--color-accent)]">{rec.score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading state for discovery */}
      {loading.discovery && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-dim)]">
          <Loader2 size={32} className="animate-spin mb-4 text-[var(--color-accent)]" />
          <p className="text-sm font-medium mb-1">Running Discovery Pipeline...</p>
          <p className="text-xs">Fetching GSC + Bing + WordPress + DataForSEO + Quora → Scoring → Claude Analysis</p>
        </div>
      )}

      {/* Keyword Table */}
      {!loading.gsc && !loading.bing && allKeywords.length > 0 && !loading.discovery && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Keywords ({allKeywords.length})</h3>
          <KeywordTable keywords={allKeywords} />
        </div>
      )}

      {!discovery && !loading.discovery && !loading.gsc && allKeywords.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-dim)]">
          No keyword data yet. Check your GSC/Bing configuration.
        </div>
      )}
    </div>
  );
}
