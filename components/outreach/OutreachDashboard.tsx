"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, LogOut, Loader2, AlertCircle, ChevronDown, Zap, Mail, CheckCircle2, Plus, Pencil, Target, Search, Clock, X } from "lucide-react";
import { ProspectsList } from "./ProspectsList";
import { ProjectManager } from "./ProjectManager";
import type { OutreachProject, OutreachProspect, OutreachStats, BacklinkTarget } from "@/lib/outreach/types";

interface JobProgress {
  jobId: string;
  type: string;
  status: "running" | "completed" | "failed";
  message: string;
  current: number;
  total: number;
  log: string[];
  result?: Record<string, unknown>;
  error?: string;
}

interface Props {
  onLogout: () => void;
}

export function OutreachDashboard({ onLogout }: Props) {
  const [projects, setProjects] = useState<OutreachProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [prospects, setProspects] = useState<OutreachProspect[]>([]);
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [editingProject, setEditingProject] = useState<OutreachProject | null>(null);
  const [backlinkTargets, setBacklinkTargets] = useState<BacklinkTarget[]>([]);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<JobProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setLoadingKey = (key: string, val: boolean) =>
    setLoading((p) => ({ ...p, [key]: val }));
  const setErrorKey = (key: string, val: string) =>
    setErrors((p) => ({ ...p, [key]: val }));

  const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100).replace(/<[^>]+>/g, "").trim() || "Internal server error"}`);
    }
  };

  // ========== Data Fetching ==========

  const refreshData = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const [prospectsRes, statsRes] = await Promise.all([
        fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`).then(r => r.json()),
        fetch(`/api/tools/guest-post-outreach/stats?projectId=${selectedProjectId}`).then(r => r.json()),
      ]);
      setProspects(prospectsRes.prospects || []);
      setStats(statsRes.stats || null);
    } catch { /* silent */ }
  }, [selectedProjectId]);

  // Fetch projects on mount
  useEffect(() => {
    fetch("/api/tools/guest-post-outreach/projects")
      .then((r) => r.json())
      .then((d) => {
        const list: OutreachProject[] = d.projects || [];
        setProjects(list);
        if (list.length > 0) setSelectedProjectId(list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  // Fetch data when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoadingKey("prospects", true);
    setErrorKey("prospects", "");
    refreshData().finally(() => setLoadingKey("prospects", false));

    // Also fetch backlink targets
    fetch("/api/tools/guest-post-outreach/backlink-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId }),
    })
      .then(r => r.json())
      .then(d => setBacklinkTargets(d.targets || []))
      .catch(() => setBacklinkTargets([]));

    // Check if there's an existing running job
    fetch(`/api/tools/guest-post-outreach/job-status?projectId=${selectedProjectId}`)
      .then(r => r.json())
      .then(d => {
        if (d.job?.status === "running") {
          setJobStatus(d.job);
          startPolling();
        } else {
          setJobStatus(null);
        }
      })
      .catch(() => {});
  }, [selectedProjectId, refreshData]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ========== Job Polling ==========

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!selectedProjectId) return;
      try {
        const res = await fetch(`/api/tools/guest-post-outreach/job-status?projectId=${selectedProjectId}`);
        const data = await res.json();
        const job = data.job as JobProgress | null;

        if (!job) {
          // Job file was cleared
          if (pollRef.current) clearInterval(pollRef.current);
          setJobStatus(null);
          return;
        }

        setJobStatus(job);

        if (job.status === "completed" || job.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          // Refresh data after job ends
          await refreshData();

          if (job.status === "completed") {
            setSuccessMsg(job.message);
            setTimeout(() => setSuccessMsg(""), 15000);
          } else {
            setErrorKey("job", job.error || job.message);
          }
        }
      } catch { /* silent */ }
    }, 2000);
  }, [selectedProjectId, refreshData]);

  // ========== Background Job Launcher ==========

  const launchBackgroundJob = async (
    endpoint: string,
    buttonKey: string
  ) => {
    if (!selectedProjectId) return;
    setErrorKey("job", "");
    setErrorKey(buttonKey, "");
    setSuccessMsg("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      // Job started — begin polling
      setJobStatus({
        jobId: data.jobId || "",
        type: buttonKey,
        status: "running",
        message: "Starting...",
        current: 0,
        total: 0,
        log: [],
      });
      startPolling();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${buttonKey} failed`;
      setErrorKey(buttonKey, msg);
    }
  };

  // ========== Handlers ==========

  const handleFindSites = async () => {
    if (!selectedProjectId) return;
    setLoadingKey("findSites", true);
    setErrorKey("findSites", "");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/tools/guest-post-outreach/find-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      await refreshData();
      const debugInfo = data.debug ? ` (${data.debug.join(" > ")})` : "";
      setSuccessMsg(`Found ${data.found || 0} new prospect${(data.found || 0) !== 1 ? "s" : ""} from ${data.searchResults || 0} search results${debugInfo}`);
      setTimeout(() => setSuccessMsg(""), 15000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to find sites";
      setErrorKey("findSites", msg);
    } finally {
      setLoadingKey("findSites", false);
    }
  };

  const handleBulkFind = () => launchBackgroundJob("/api/tools/guest-post-outreach/bulk-find", "bulkFind");
  const handleSendEmails = () => launchBackgroundJob("/api/tools/guest-post-outreach/send-emails", "sendEmails");
  const handleDailyRun = () => launchBackgroundJob("/api/tools/guest-post-outreach/daily-run", "dailyRun");

  const handleCheckReplies = async () => {
    if (!selectedProjectId) return;
    setLoadingKey("checkReplies", true);
    setErrorKey("checkReplies", "");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/tools/guest-post-outreach/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      await refreshData();
      setSuccessMsg(`Processed ${data.processed || 0} repl${(data.processed || 0) !== 1 ? "ies" : "y"}`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to check replies";
      setErrorKey("checkReplies", msg);
    } finally {
      setLoadingKey("checkReplies", false);
    }
  };

  const handleRefresh = useCallback(() => {
    if (!selectedProjectId) return;
    setLoadingKey("refresh", true);
    refreshData().finally(() => setLoadingKey("refresh", false));
  }, [selectedProjectId, refreshData]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  const handleProjectCreated = () => {
    setShowProjectManager(false);
    fetch("/api/tools/guest-post-outreach/projects")
      .then((r) => r.json())
      .then((d) => {
        const list: OutreachProject[] = d.projects || [];
        setProjects(list);
        if (list.length > 0) setSelectedProjectId(list[0].id);
      });
  };

  const handleDismissJob = async () => {
    if (!selectedProjectId) return;
    await fetch(`/api/tools/guest-post-outreach/job-status?projectId=${selectedProjectId}`, { method: "DELETE" });
    setJobStatus(null);
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const isJobActive = jobStatus?.status === "running";
  const isAnyLoading = Object.values(loading).some(Boolean) || isJobActive;

  return (
    <div className="space-y-6">
      {/* Project Selector */}
      {projects.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
          <Zap size={18} className="text-[var(--color-accent)] shrink-0" />
          <span className="text-sm font-medium text-[var(--color-text-dim)] shrink-0">Project:</span>
          <div className="relative flex-1">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full appearance-none bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 pr-8 text-sm text-[var(--color-text)] cursor-pointer hover:border-[var(--color-border-hover)] transition-colors focus:outline-none focus:border-[var(--color-accent)]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.niche})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-dim)]" />
          </div>
          {currentProject && (
            <button
              onClick={() => setEditingProject(currentProject)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          <button
            onClick={() => setShowProjectManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-colors"
          >
            <Plus size={14} />
            New
          </button>
        </div>
      )}

      {projects.length === 0 && (
        <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-muted)]">
          No projects yet.{" "}
          <button
            onClick={() => setShowProjectManager(true)}
            className="text-[var(--color-accent)] hover:underline"
          >
            Create your first project
          </button>{" "}
          to get started.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-muted)]">Admin Mode</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isAnyLoading || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading.refresh ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleFindSites}
            disabled={loading.findSites || isJobActive || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-blue)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading.findSites ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Find Sites
          </button>
          <button
            onClick={handleBulkFind}
            disabled={isJobActive || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500 hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Search size={14} />
            Bulk Find (500+)
          </button>
          <button
            onClick={handleSendEmails}
            disabled={isJobActive || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-orange)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Mail size={14} />
            Send Emails
          </button>
          <button
            onClick={handleDailyRun}
            disabled={isJobActive || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500 hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Clock size={14} />
            Daily Run
          </button>
          <button
            onClick={handleCheckReplies}
            disabled={loading.checkReplies || isJobActive || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-green)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading.checkReplies ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Check Replies
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

      {/* Live Job Progress */}
      {jobStatus && (
        <div className={`p-4 rounded-xl border ${
          jobStatus.status === "running"
            ? "bg-blue-400/5 border-blue-400/20"
            : jobStatus.status === "completed"
            ? "bg-green-400/5 border-green-400/20"
            : "bg-red-400/5 border-red-400/20"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {jobStatus.status === "running" && <Loader2 size={16} className="animate-spin text-blue-400" />}
              {jobStatus.status === "completed" && <CheckCircle2 size={16} className="text-green-400" />}
              {jobStatus.status === "failed" && <AlertCircle size={16} className="text-red-400" />}
              <span className="text-sm font-medium">
                {jobStatus.type === "bulkFind" ? "Bulk Find" :
                 jobStatus.type === "sendEmails" ? "Send Emails" :
                 jobStatus.type === "dailyRun" ? "Daily Run" :
                 jobStatus.type === "bulk-find" ? "Bulk Find" :
                 jobStatus.type === "send-emails" ? "Send Emails" :
                 jobStatus.type === "daily-run" ? "Daily Run" :
                 jobStatus.type}
              </span>
            </div>
            {jobStatus.status !== "running" && (
              <button
                onClick={handleDismissJob}
                className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {jobStatus.total > 0 && (
            <div className="w-full bg-[var(--color-bg)] rounded-full h-2 mb-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  jobStatus.status === "running" ? "bg-blue-400" :
                  jobStatus.status === "completed" ? "bg-green-400" : "bg-red-400"
                }`}
                style={{ width: `${Math.min(100, (jobStatus.current / jobStatus.total) * 100)}%` }}
              />
            </div>
          )}

          <p className="text-xs text-[var(--color-text-dim)]">
            {jobStatus.message}
            {jobStatus.total > 0 && ` (${jobStatus.current}/${jobStatus.total})`}
          </p>

          {/* Show last few log lines when running */}
          {jobStatus.status === "running" && jobStatus.log.length > 0 && (
            <div className="mt-2 max-h-20 overflow-y-auto text-[10px] font-mono text-[var(--color-text-dim)] space-y-0.5">
              {jobStatus.log.slice(-3).map((line, i) => (
                <div key={i} className="truncate">{line.replace(/^\[.*?\]\s*/, "")}</div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Success Message */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* Pipeline Funnel */}
      {stats && selectedProjectId && (
        <div className="space-y-3">
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">Outreach Pipeline</h3>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
                <span>Today: {stats.emailsSentToday || 0}/{currentProject?.emailsPerDay || 20}</span>
                <span>• Week: {stats.emailsSentThisWeek}/{currentProject?.emailsPerWeek || 140}</span>
                {(stats.pendingWithEmail ?? 0) > 0 && <span>• Ready: {stats.pendingWithEmail}</span>}
                {stats.lastDailyRunAt && <span>• Last auto: {new Date(stats.lastDailyRunAt).toLocaleDateString()}</span>}
                {!stats.lastDailyRunAt && stats.lastRunAt && <span>• Last: {new Date(stats.lastRunAt).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {[
                { label: "Found", value: stats.totalFound, color: "bg-blue-400" },
                { label: "Emailed", value: stats.emailed, color: "bg-[var(--color-orange)]" },
                { label: "Replied", value: stats.replied, color: "bg-purple-400" },
                { label: "Agreed", value: stats.agreed, color: "bg-[var(--color-green)]" },
                { label: "Content Sent", value: stats.contentSent, color: "bg-[var(--color-accent)]" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-1 flex-1">
                  <div className="flex-1 text-center">
                    <div className={`${step.color} text-white rounded py-2 px-1 font-bold text-lg`}>
                      {step.value}
                    </div>
                    <div className="mt-1 text-[var(--color-text-dim)] truncate">{step.label}</div>
                  </div>
                  {i < 4 && <span className="text-[var(--color-text-dim)] shrink-0">&rarr;</span>}
                </div>
              ))}
              {stats.rejected > 0 && (
                <div className="flex-1 text-center">
                  <div className="bg-red-400/20 text-red-400 rounded py-2 px-1 font-bold text-lg">
                    {stats.rejected}
                  </div>
                  <div className="mt-1 text-red-400/60 truncate">Rejected</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backlink Priority Targets */}
      {backlinkTargets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold">Posts Needing Backlinks (Priority Order)</h3>
            <span className="text-xs font-mono text-[var(--color-text-dim)]">{backlinkTargets.length} targets</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-text-dim)] border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Post</th>
                  <th className="text-right py-2 px-2">Impressions</th>
                  <th className="text-right py-2 px-2">Position</th>
                  <th className="text-right py-2 px-2">Score</th>
                  <th className="text-center py-2 px-2">Priority</th>
                </tr>
              </thead>
              <tbody>
                {backlinkTargets.slice(0, 10).map((t, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-bg-card)]">
                    <td className="py-2 px-2 text-[var(--color-text-dim)]">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium truncate max-w-[200px] sm:max-w-[300px]">{t.title}</div>
                      {t.focusKeyword && <div className="text-[var(--color-text-dim)] truncate">{t.focusKeyword}</div>}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{t.impressions.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right font-mono">{t.position}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-[var(--color-accent)]">{t.score}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === "high" ? "bg-red-400/10 text-red-400" :
                        t.priority === "medium" ? "bg-orange-400/10 text-orange-400" :
                        "bg-green-400/10 text-green-400"
                      }`}>{t.priority.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prospects List */}
      {loading.prospects ? (
        <div className="flex items-center justify-center py-12 text-[var(--color-text-dim)]">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading prospects...
        </div>
      ) : selectedProjectId && prospects.length > 0 ? (
        <ProspectsList prospects={prospects} projectId={selectedProjectId} onRefresh={handleRefresh} />
      ) : selectedProjectId ? (
        <div className="text-center py-12 text-[var(--color-text-dim)]">
          No prospects yet. Click &quot;Find Sites&quot; to start.
        </div>
      ) : null}

      {/* Project Manager Modal — Create */}
      {showProjectManager && (
        <ProjectManager onClose={() => setShowProjectManager(false)} onCreated={handleProjectCreated} />
      )}

      {/* Project Manager Modal — Edit */}
      {editingProject && (
        <ProjectManager
          onClose={() => setEditingProject(null)}
          onCreated={() => { setEditingProject(null); handleProjectCreated(); }}
          editProject={editingProject}
        />
      )}
    </div>
  );
}
