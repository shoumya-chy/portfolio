"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Search,
  Link2,
  List,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "sitemap" | "single" | "multiple";
type UrlStatus = "pending" | "submitting" | "success" | "failed" | "skipped";

interface QueueItem {
  id: string;
  url: string;
  status: UrlStatus;
  message?: string;
  timestamp?: number;
}

interface LogEntry {
  id: string;
  time: string;
  type: "info" | "success" | "error" | "warn";
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseUrlsFromXml(xml: string): string[] {
  const urls: string[] = [];
  const locMatches = xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi);
  for (const match of locMatches) {
    urls.push(match[1].trim());
  }
  return [...new Set(urls)]; // deduplicate
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

function extractSitemapUrls(xml: string): string[] {
  return parseUrlsFromXml(xml);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shortId() {
  return Math.random().toString(36).slice(2, 9);
}

function now() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BingIndexerDashboard() {
  // Settings
  const [apiKey, setApiKey] = useState("");
  const [host, setHost] = useState("");
  const [delay, setDelay] = useState(3);
  const [showSettings, setShowSettings] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Prefill API key + host from the admin settings on mount so users don't
  // have to paste them on every visit. Silently ignores auth/network errors;
  // the form still accepts manual input as a fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bing-indexer/config");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.key) setApiKey(data.key);
        if (data.host) setHost(data.host);
      } catch {
        // Ignore — form still accepts manual input
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mode
  const [mode, setMode] = useState<Mode>("sitemap");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [multipleUrls, setMultipleUrls] = useState("");

  // Queue & state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [showKeyInfo, setShowKeyInfo] = useState(false);

  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  // ─── Logging ────────────────────────────────────────────────────────────────

  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) => [
        { id: shortId(), time: now(), type, message },
        ...prev.slice(0, 199),
      ]);
    },
    []
  );

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total: queue.length,
    pending: queue.filter((q) => q.status === "pending").length,
    success: queue.filter((q) => q.status === "success").length,
    failed: queue.filter((q) => q.status === "failed").length,
    submitting: queue.filter((q) => q.status === "submitting").length,
  };

  // ─── Sitemap Fetch & Parse ──────────────────────────────────────────────────

  async function fetchAndParseSitemap(url: string): Promise<string[]> {
    const res = await fetch("/api/bing-indexer/fetch-sitemap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to fetch sitemap");
    }

    const { content } = await res.json();

    if (isSitemapIndex(content)) {
      addLog(`Detected sitemap index at ${url} — expanding child sitemaps…`, "info");
      const childUrls = extractSitemapUrls(content).filter(
        (u) => u.endsWith(".xml") || u.includes("sitemap")
      );
      const allUrls: string[] = [];
      for (const child of childUrls) {
        addLog(`Fetching child sitemap: ${child}`, "info");
        try {
          const childUrls = await fetchAndParseSitemap(child);
          allUrls.push(...childUrls);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          addLog(`Failed to fetch child sitemap ${child}: ${msg}`, "warn");
        }
      }
      return allUrls;
    } else {
      const urls = parseUrlsFromXml(content).filter(
        (u) => !u.endsWith(".xml") && !u.includes("sitemap")
      );
      return urls;
    }
  }

  // ─── Load URLs into Queue ──────────────────────────────────────────────────

  async function loadQueue() {
    if (!apiKey.trim()) {
      addLog("Please enter your IndexNow API key first.", "error");
      return;
    }
    if (!host.trim()) {
      addLog("Please enter your website host/domain.", "error");
      return;
    }

    setIsFetching(true);
    addLog("Loading URLs…", "info");

    try {
      let urls: string[] = [];

      if (mode === "sitemap") {
        if (!sitemapUrl.trim()) {
          addLog("Please enter a sitemap URL.", "error");
          return;
        }
        addLog(`Fetching sitemap: ${sitemapUrl}`, "info");
        urls = await fetchAndParseSitemap(sitemapUrl.trim());
      } else if (mode === "single") {
        if (!singleUrl.trim()) {
          addLog("Please enter a URL to submit.", "error");
          return;
        }
        urls = [singleUrl.trim()];
      } else {
        const lines = multipleUrls
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.startsWith("http"));
        if (lines.length === 0) {
          addLog("No valid URLs found. Each line should start with http/https.", "error");
          return;
        }
        urls = lines;
      }

      // Filter out already queued successful ones
      const existingSuccessful = new Set(
        queue.filter((q) => q.status === "success").map((q) => q.url)
      );
      const newUrls = urls.filter((u) => !existingSuccessful.has(u));

      if (newUrls.length === 0) {
        addLog("All URLs already submitted successfully.", "warn");
        return;
      }

      const newItems: QueueItem[] = newUrls.map((url) => ({
        id: shortId(),
        url,
        status: "pending",
      }));

      setQueue((prev) => {
        const existingUrls = new Set(prev.map((p) => p.url));
        const deduped = newItems.filter((item) => !existingUrls.has(item.url));
        return [...prev, ...deduped];
      });

      addLog(
        `✓ Loaded ${newItems.length} URL${newItems.length !== 1 ? "s" : ""} into the queue.`,
        "success"
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`Error loading URLs: ${msg}`, "error");
    } finally {
      setIsFetching(false);
    }
  }

  // ─── Submit a single URL via server-side proxy (avoids CORS) ────────────

  async function submitUrl(url: string): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch("/api/bing-indexer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, key: apiKey, host }),
      });

      const data = await res.json();
      return { ok: data.ok ?? false, message: data.message ?? `HTTP ${res.status}` };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }

  // ─── Run Queue ────────────────────────────────────────────────────────────

  async function startQueue() {
    if (queue.filter((q) => q.status === "pending").length === 0) {
      addLog("No pending URLs in the queue. Load URLs first.", "warn");
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    pauseRef.current = false;
    stopRef.current = false;

    addLog("▶ Starting submission run…", "info");

    const pendingIds = queue
      .filter((q) => q.status === "pending")
      .map((q) => q.id);

    for (const id of pendingIds) {
      if (stopRef.current) {
        addLog("⏹ Stopped by user.", "warn");
        break;
      }

      // Wait while paused
      while (pauseRef.current) {
        await sleep(500);
        if (stopRef.current) break;
      }
      if (stopRef.current) break;

      // Mark as submitting
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "submitting" } : item
        )
      );

      // Get the URL
      const item = queue.find((q) => q.id === id);
      if (!item) continue;

      addLog(`Submitting: ${item.url}`, "info");

      const result = await submitUrl(item.url);

      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                status: result.ok ? "success" : "failed",
                message: result.message,
                timestamp: Date.now(),
              }
            : q
        )
      );

      if (result.ok) {
        addLog(`✓ Success: ${item.url} — ${result.message}`, "success");
      } else {
        addLog(`✗ Failed: ${item.url} — ${result.message}`, "error");
      }

      // Delay before next
      if (!stopRef.current && delay > 0) {
        await sleep(delay * 1000);
      }
    }

    setIsRunning(false);
    pauseRef.current = false;
    stopRef.current = false;
    addLog("Run complete.", "info");
  }

  function pauseQueue() {
    pauseRef.current = true;
    setIsPaused(true);
    addLog("⏸ Paused.", "warn");
  }

  function resumeQueue() {
    pauseRef.current = false;
    setIsPaused(false);
    addLog("▶ Resumed.", "info");
  }

  function stopQueue() {
    stopRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    addLog("⏹ Stop requested…", "warn");
  }

  function clearQueue() {
    setQueue([]);
    addLog("Queue cleared.", "info");
  }

  function retryFailed() {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === "failed" ? { ...item, status: "pending", message: undefined } : item
      )
    );
    addLog("Failed URLs reset to pending.", "info");
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const progressPct =
    stats.total > 0
      ? Math.round(((stats.success + stats.failed) / stats.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Settings Panel ── */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-bg-card-hover)] transition-colors"
        >
          <span className="font-semibold flex items-center gap-2">
            <span>⚙️</span> Configuration
          </span>
          {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSettings && (
          <div className="px-5 pb-5 space-y-4 border-t border-[var(--color-border)]">
            {/* IndexNow key info */}
            <div className="mt-4">
              <button
                onClick={() => setShowKeyInfo(!showKeyInfo)}
                className="flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
              >
                <Info size={14} />
                How to get an IndexNow API key?
                {showKeyInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showKeyInfo && (
                <div className="mt-2 p-4 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/30 rounded-lg text-sm text-[var(--color-text-muted)] space-y-2">
                  <p>
                    <strong className="text-[var(--color-text)]">1.</strong> Generate any unique string as your key (e.g., a UUID like{" "}
                    <code className="font-mono text-xs bg-[var(--color-border)] px-1 py-0.5 rounded">
                      a1b2c3d4e5f6...
                    </code>
                    ).
                  </p>
                  <p>
                    <strong className="text-[var(--color-text)]">2.</strong> Create a file named{" "}
                    <code className="font-mono text-xs bg-[var(--color-border)] px-1 py-0.5 rounded">
                      {"<your-key>"}.txt
                    </code>{" "}
                    in your website root, containing only the key text.
                  </p>
                  <p>
                    <strong className="text-[var(--color-text)]">3.</strong> Verify it&apos;s accessible at{" "}
                    <code className="font-mono text-xs bg-[var(--color-border)] px-1 py-0.5 rounded">
                      https://yoursite.com/{"<key>"}.txt
                    </code>
                  </p>
                  <p>
                    <strong className="text-[var(--color-text)]">4.</strong> Enter the key and your domain below. Bing (IndexNow) is free — no account required.
                  </p>
                </div>
              )}
            </div>

            {configLoaded && (apiKey || host) && (
              <p className="text-xs text-[var(--color-green)] mt-2">
                Loaded from{" "}
                <a
                  href="/admin/settings"
                  className="underline hover:text-[var(--color-accent)]"
                >
                  Settings
                </a>{" "}
                — you can override the values below for a single run.
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-xs text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wide">
                  IndexNow API Key *
                </label>
                <input
                  type="text"
                  placeholder="your-indexnow-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wide">
                  Website Host *
                </label>
                <input
                  type="text"
                  placeholder="example.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wide">
                Delay Between Submissions
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-accent)]"
                />
                <span className="text-sm font-mono w-20 text-center text-[var(--color-text-muted)]">
                  {delay}s / URL
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mode Selector + Input ── */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
        <div className="flex gap-2">
          {(
            [
              { key: "sitemap", label: "Sitemap", icon: Search },
              { key: "single", label: "Single URL", icon: Link2 },
              { key: "multiple", label: "Multiple URLs", icon: List },
            ] as { key: Mode; label: string; icon: React.FC<{ size?: number }> }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === key
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {mode === "sitemap" && (
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wide">
              Sitemap URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/sitemap.xml"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
            <p className="text-xs text-[var(--color-text-dim)] mt-1.5">
              Supports sitemap index files — child sitemaps are automatically expanded.
            </p>
          </div>
        )}

        {mode === "single" && (
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wide">
              URL to Submit
            </label>
            <input
              type="url"
              placeholder="https://example.com/my-blog-post"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
        )}

        {mode === "multiple" && (
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1.5 font-medium uppercase tracking-wide">
              URLs (one per line)
            </label>
            <textarea
              rows={6}
              placeholder={
                "https://example.com/post-1\nhttps://example.com/post-2\nhttps://example.com/post-3"
              }
              value={multipleUrls}
              onChange={(e) => setMultipleUrls(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
            />
            <p className="text-xs text-[var(--color-text-dim)] mt-1.5">
              {multipleUrls.split("\n").filter((l) => l.trim().startsWith("http")).length} valid
              URL(s) detected
            </p>
          </div>
        )}

        <button
          onClick={loadQueue}
          disabled={isFetching || isRunning}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isFetching ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {isFetching ? "Loading…" : "Load into Queue"}
        </button>
      </div>

      {/* ── Stats ── */}
      {queue.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "var(--color-text)" },
            { label: "Pending", value: stats.pending, color: "var(--color-text-muted)" },
            { label: "Success", value: stats.success, color: "var(--color-green)" },
            { label: "Failed", value: stats.failed, color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 text-center"
            >
              <div className="text-2xl font-bold" style={{ color }}>
                {value}
              </div>
              <div className="text-xs text-[var(--color-text-dim)] mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Progress Bar ── */}
      {queue.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-[var(--color-text-dim)] mb-1.5">
            <span>Progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      {queue.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {!isRunning && (
            <button
              onClick={startQueue}
              disabled={stats.pending === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-green)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Start Indexing
            </button>
          )}
          {isRunning && !isPaused && (
            <button
              onClick={pauseQueue}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-orange)] hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Pause size={14} />
              Pause
            </button>
          )}
          {isRunning && isPaused && (
            <button
              onClick={resumeQueue}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-green)] hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Resume
            </button>
          )}
          {isRunning && (
            <button
              onClick={stopQueue}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Square size={14} />
              Stop
            </button>
          )}
          {!isRunning && stats.failed > 0 && (
            <button
              onClick={retryFailed}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-muted)] rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} />
              Retry Failed ({stats.failed})
            </button>
          )}
          {!isRunning && (
            <button
              onClick={clearQueue}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-red-500/50 text-[var(--color-text-dim)] hover:text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 size={14} />
              Clear Queue
            </button>
          )}
        </div>
      )}

      {/* ── URL Queue ── */}
      {queue.length > 0 && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
            <h3 className="font-semibold text-sm">URL Queue ({queue.length})</h3>
            <span className="text-xs text-[var(--color-text-dim)]">
              {isRunning
                ? isPaused
                  ? "⏸ Paused"
                  : "▶ Running"
                : "⏹ Idle"}
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <StatusIcon status={item.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-[var(--color-text-muted)] truncate">
                    {item.url}
                  </p>
                  {item.message && (
                    <p className="text-xs text-[var(--color-text-dim)] mt-0.5">{item.message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={item.status} />
                  {item.status !== "submitting" && !isRunning && (
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="text-[var(--color-text-dim)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity Log ── */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-sm">Activity Log</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const text = logs.map((l) => `[${l.time}] ${l.message}`).join("\n");
                navigator.clipboard.writeText(text);
              }}
              className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] flex items-center gap-1 transition-colors"
            >
              <Copy size={12} /> Copy
            </button>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-[var(--color-text-dim)] hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} /> Clear
            </button>
          </div>
        </div>
        <div className="font-mono text-xs divide-y divide-[var(--color-border)]/50 max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="px-5 py-6 text-center text-[var(--color-text-dim)]">
              No activity yet. Load URLs and start indexing.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`flex gap-3 px-5 py-2 ${logColor(log.type)}`}
              >
                <span className="text-[var(--color-text-dim)] shrink-0">{log.time}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: UrlStatus }) {
  switch (status) {
    case "success":
      return <CheckCircle size={14} className="text-[var(--color-green)] shrink-0" />;
    case "failed":
      return <XCircle size={14} className="text-red-400 shrink-0" />;
    case "submitting":
      return (
        <RefreshCw size={14} className="text-[var(--color-accent)] shrink-0 animate-spin" />
      );
    case "skipped":
      return <AlertTriangle size={14} className="text-[var(--color-orange)] shrink-0" />;
    default:
      return <Clock size={14} className="text-[var(--color-text-dim)] shrink-0" />;
  }
}

function StatusBadge({ status }: { status: UrlStatus }) {
  const styles: Record<UrlStatus, string> = {
    pending: "text-[var(--color-text-dim)] border-[var(--color-border)]",
    submitting: "text-[var(--color-accent)] border-[var(--color-accent)]/40",
    success: "text-[var(--color-green)] border-[var(--color-green)]/40",
    failed: "text-red-400 border-red-400/40",
    skipped: "text-[var(--color-orange)] border-[var(--color-orange)]/40",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 border rounded capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function logColor(type: LogEntry["type"]) {
  switch (type) {
    case "success":
      return "text-[var(--color-green)]";
    case "error":
      return "text-red-400";
    case "warn":
      return "text-[var(--color-orange)]";
    default:
      return "text-[var(--color-text-muted)]";
  }
}
