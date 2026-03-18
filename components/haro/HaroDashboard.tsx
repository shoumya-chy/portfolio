"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, Loader2, AlertCircle, CheckCircle2, Mail, Zap, Settings, Eye, X } from "lucide-react";
import { HaroSetup } from "./HaroSetup";
import type { JournalistQuery, HaroStats, QueryStatus } from "@/lib/haro/types";

interface Props {
  onLogout: () => void;
}

type FilterTab = "all" | "new" | "responded" | "skipped" | "failed";

const sourceColors: Record<string, string> = {
  sourcebottle: "#10b981",
  qwoted: "#8b5cf6",
  featured: "#f59e0b",
  unknown: "#6b7280",
};

const statusColors: Record<string, string> = {
  new: "#3b82f6",
  responded: "#10b981",
  skipped: "#f59e0b",
  failed: "#ef4444",
};

export function HaroDashboard({ onLogout }: Props) {
  const [queries, setQueries] = useState<JournalistQuery[]>([]);
  const [stats, setStats] = useState<HaroStats | null>(null);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedQuery, setSelectedQuery] = useState<JournalistQuery | null>(null);

  const setLoadingKey = (key: string, val: boolean) => setLoading((p) => ({ ...p, [key]: val }));

  const safeJson = async (res: Response) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch {
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100).replace(/<[^>]+>/g, "").trim()}`);
    }
  };

  // Check if configured
  useEffect(() => {
    fetch("/api/tools/haro-responder/config")
      .then((r) => r.json())
      .then((d) => setHasConfig(!!d.config))
      .catch(() => setHasConfig(false));
  }, []);

  // Fetch queries
  const fetchQueries = useCallback(async () => {
    setLoadingKey("queries", true);
    try {
      const statusParam = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/tools/haro-responder/queries${statusParam}`);
      const data = await safeJson(res);
      setQueries(data.queries || []);
      setStats(data.stats || null);
    } catch {
      // silently fail on fetch
    } finally {
      setLoadingKey("queries", false);
    }
  }, [filter]);

  useEffect(() => {
    if (hasConfig) fetchQueries();
  }, [hasConfig, fetchQueries]);

  const handleCheckInbox = async () => {
    setLoadingKey("check", true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/tools/haro-responder/check", { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      const debugInfo = data.debug ? ` — ${data.debug.join(" → ")}` : "";
      if (data.errors?.length > 0) {
        setError(data.errors.join("; "));
      }
      setSuccessMsg(`Found ${data.queriesFound || 0} queries, sent ${data.responsesSent || 0} responses${debugInfo}`);
      setTimeout(() => setSuccessMsg(""), 10000);
      fetchQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoadingKey("check", false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  if (hasConfig === null) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-dim)]">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (!hasConfig || showSetup) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{hasConfig ? "Edit Configuration" : "Setup HARO Responder"}</h2>
          {hasConfig && (
            <button onClick={() => setShowSetup(false)} className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
              Back to Dashboard
            </button>
          )}
        </div>
        <HaroSetup onSaved={() => { setHasConfig(true); setShowSetup(false); }} />
      </div>
    );
  }

  const filtered = filter === "all" ? queries : queries.filter((q) => q.status === filter);
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const filters: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "New", value: "new" },
    { label: "Responded", value: "responded" },
    { label: "Skipped", value: "skipped" },
    { label: "Failed", value: "failed" },
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-muted)]">HARO Auto-Responder</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchQueries} disabled={loading.queries} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={loading.queries ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={handleCheckInbox} disabled={loading.check} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-blue)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors">
            {loading.check ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Check Inbox & Respond
          </button>
          <button onClick={() => setShowSetup(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] transition-colors">
            <Settings size={14} /> Settings
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Total Queries</div>
            <div className="text-2xl font-bold">{stats.totalQueries}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Responded</div>
            <div className="text-2xl font-bold text-green-400">{stats.responded}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Today</div>
            <div className="text-2xl font-bold">{stats.todayResponded}/{stats.todayQueries}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => {
          const count = f.value === "all" ? queries.length : queries.filter((q) => q.status === f.value).length;
          return (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.value ? "bg-[var(--color-accent)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)]"
              }`}>
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Queries list */}
      {loading.queries ? (
        <div className="flex items-center justify-center py-12 text-[var(--color-text-dim)]">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading queries...
        </div>
      ) : sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-3 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-border-hover)] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${sourceColors[q.source]}20`, color: sourceColors[q.source] }}>
                    {q.source}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${statusColors[q.status]}20`, color: statusColors[q.status] }}>
                    {q.status}
                  </span>
                  {q.outlet && <span className="text-xs text-[var(--color-text-dim)]">{q.outlet}</span>}
                </div>
                <p className="text-sm font-medium truncate">{q.topic}</p>
                <p className="text-xs text-[var(--color-text-dim)] mt-1">
                  {new Date(q.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {q.replyToEmail && ` → ${q.replyToEmail}`}
                </p>
              </div>
              <button onClick={() => setSelectedQuery(q)} className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg)] transition-colors shrink-0">
                <Eye size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[var(--color-text-dim)]">
          {hasConfig ? 'No queries yet. Click "Check Inbox & Respond" to scan for journalist queries.' : "Set up your configuration first."}
        </div>
      )}

      {/* Query detail modal */}
      {selectedQuery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${sourceColors[selectedQuery.source]}20`, color: sourceColors[selectedQuery.source] }}>
                  {selectedQuery.source}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${statusColors[selectedQuery.status]}20`, color: statusColors[selectedQuery.status] }}>
                  {selectedQuery.status}
                </span>
              </div>
              <button onClick={() => setSelectedQuery(null)} className="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-[var(--color-text-dim)] mb-1">Topic</p>
                <p className="text-sm font-medium">{selectedQuery.topic}</p>
              </div>
              {selectedQuery.journalistName && (
                <div>
                  <p className="text-xs text-[var(--color-text-dim)] mb-1">Journalist</p>
                  <p className="text-sm">{selectedQuery.journalistName}{selectedQuery.outlet ? ` — ${selectedQuery.outlet}` : ""}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-[var(--color-text-dim)] mb-1">Query</p>
                <div className="text-sm bg-[var(--color-bg)] p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedQuery.queryText}
                </div>
              </div>
              {selectedQuery.aiResponse && (
                <div>
                  <p className="text-xs text-[var(--color-text-dim)] mb-1">AI Response {selectedQuery.responseSentAt ? `(Sent ${new Date(selectedQuery.responseSentAt).toLocaleString()})` : ""}</p>
                  <div className="text-sm bg-green-400/5 border border-green-400/20 p-3 rounded-lg whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedQuery.aiResponse}
                  </div>
                </div>
              )}
              {selectedQuery.error && (
                <div>
                  <p className="text-xs text-red-400 mb-1">Error</p>
                  <p className="text-sm text-red-400">{selectedQuery.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
