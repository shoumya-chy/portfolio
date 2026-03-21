"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, Loader2, AlertCircle, ChevronDown, Zap, Mail, CheckCircle2, Plus, Pencil, Target } from "lucide-react";
import { ProspectsList } from "./ProspectsList";
import { ProjectManager } from "./ProjectManager";
import type { OutreachProject, OutreachProspect, OutreachStats, BacklinkTarget } from "@/lib/outreach/types";

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

  const setLoadingKey = (key: string, val: boolean) =>
    setLoading((p) => ({ ...p, [key]: val }));
  const setErrorKey = (key: string, val: string) =>
    setErrors((p) => ({ ...p, [key]: val }));

  // Safe JSON parser — handles HTML error pages from server crashes
  const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      // Server returned HTML error page instead of JSON
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100).replace(/<[^>]+>/g, "").trim() || "Internal server error"}`);
    }
  };

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

  // Fetch prospects and stats when selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) return;

    setLoadingKey("prospects", true);
    setErrorKey("prospects", "");

    Promise.all([
      fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`).then((r) => r.json()),
      fetch(`/api/tools/guest-post-outreach/stats?projectId=${selectedProjectId}`).then((r) => r.json()),
    ])
      .then(([prospectsData, statsData]) => {
        setProspects(prospectsData.prospects || []);
        setStats(statsData.stats || null);
      })
      .catch((err) => {
        setErrorKey("prospects", err instanceof Error ? err.message : "Failed to fetch data");
      })
      .finally(() => setLoadingKey("prospects", false));

    // Also fetch backlink targets
    fetch("/api/tools/guest-post-outreach/backlink-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId }),
    })
      .then(r => r.json())
      .then(d => setBacklinkTargets(d.targets || []))
      .catch(() => setBacklinkTargets([]));
  }, [selectedProjectId]);

  const [successMsg, setSuccessMsg] = useState<string>("");

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
      // Refresh prospects after finding sites
      const prospectsRes = await fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`);
      const prospectsData = await safeJson(prospectsRes);
      setProspects(prospectsData.prospects || []);
      // Refresh stats
      const statsRes = await fetch(`/api/tools/guest-post-outreach/stats?projectId=${selectedProjectId}`);
      const statsData = await safeJson(statsRes);
      setStats(statsData.stats || null);
      const debugInfo = data.debug ? ` (${data.debug.join(" → ")})` : "";
      setSuccessMsg(`Found ${data.found || 0} new prospect${(data.found || 0) !== 1 ? "s" : ""} from ${data.searchResults || 0} search results${debugInfo}`);
      setTimeout(() => setSuccessMsg(""), 15000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to find sites";
      setErrorKey("findSites", msg);
    } finally {
      setLoadingKey("findSites", false);
    }
  };

  const handleSendEmails = async () => {
    if (!selectedProjectId) return;
    setLoadingKey("sendEmails", true);
    setErrorKey("sendEmails", "");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/tools/guest-post-outreach/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      // Refresh prospects after sending emails
      const prospectsRes = await fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`);
      const prospectsData = await safeJson(prospectsRes);
      setProspects(prospectsData.prospects || []);
      setSuccessMsg(`Sent ${data.sent || 0} outreach email${(data.sent || 0) !== 1 ? "s" : ""}`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send emails";
      setErrorKey("sendEmails", msg);
    } finally {
      setLoadingKey("sendEmails", false);
    }
  };

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
      // Refresh prospects after checking replies
      const prospectsRes = await fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`);
      const prospectsData = await safeJson(prospectsRes);
      setProspects(prospectsData.prospects || []);
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
    Promise.all([
      fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`).then((r) => r.json()),
      fetch(`/api/tools/guest-post-outreach/stats?projectId=${selectedProjectId}`).then((r) => r.json()),
    ])
      .then(([prospectsData, statsData]) => {
        setProspects(prospectsData.prospects || []);
        setStats(statsData.stats || null);
      })
      .finally(() => setLoadingKey("refresh", false));
  }, [selectedProjectId]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  const handleProjectCreated = () => {
    setShowProjectManager(false);
    // Refresh projects list
    fetch("/api/tools/guest-post-outreach/projects")
      .then((r) => r.json())
      .then((d) => {
        const list: OutreachProject[] = d.projects || [];
        setProjects(list);
        if (list.length > 0) setSelectedProjectId(list[0].id);
      });
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const isAnyLoading = Object.values(loading).some(Boolean);

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
            disabled={loading.findSites || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-blue)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading.findSites ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Find Sites
          </button>
          <button
            onClick={handleSendEmails}
            disabled={loading.sendEmails || !selectedProjectId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-orange)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading.sendEmails ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Send Emails
          </button>
          <button
            onClick={handleCheckReplies}
            disabled={loading.checkReplies || !selectedProjectId}
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
          {/* Funnel visualization */}
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">Outreach Pipeline</h3>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
                <span>This week: {stats.emailsSentThisWeek}/{currentProject?.emailsPerWeek || 20} emails</span>
                {stats.lastRunAt && <span>• Last: {new Date(stats.lastRunAt).toLocaleDateString()}</span>}
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
                  {i < 4 && <span className="text-[var(--color-text-dim)] shrink-0">→</span>}
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
          No prospects yet. Click "Find Sites" to start.
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
