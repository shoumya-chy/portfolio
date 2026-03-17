"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, Loader2, AlertCircle, ChevronDown, Zap, Mail, CheckCircle2, Plus } from "lucide-react";
import { ProspectsList } from "./ProspectsList";
import { ProjectManager } from "./ProjectManager";
import type { OutreachProject, OutreachProspect, OutreachStats } from "@/lib/outreach/types";

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

  const setLoadingKey = (key: string, val: boolean) =>
    setLoading((p) => ({ ...p, [key]: val }));
  const setErrorKey = (key: string, val: string) =>
    setErrors((p) => ({ ...p, [key]: val }));

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
  }, [selectedProjectId]);

  const handleFindSites = async () => {
    if (!selectedProjectId) return;
    setLoadingKey("findSites", true);
    setErrorKey("findSites", "");
    try {
      const res = await fetch("/api/tools/guest-post-outreach/find-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      // Refresh prospects after finding sites
      const prospectsRes = await fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`);
      const prospectsData = await prospectsRes.json();
      setProspects(prospectsData.prospects || []);
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
    try {
      const res = await fetch("/api/tools/guest-post-outreach/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      // Refresh prospects after sending emails
      const prospectsRes = await fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`);
      const prospectsData = await prospectsRes.json();
      setProspects(prospectsData.prospects || []);
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
    try {
      const res = await fetch("/api/tools/guest-post-outreach/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      // Refresh prospects after checking replies
      const prospectsRes = await fetch(`/api/tools/guest-post-outreach/prospects?projectId=${selectedProjectId}`);
      const prospectsData = await prospectsRes.json();
      setProspects(prospectsData.prospects || []);
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
        <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
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
          <button
            onClick={() => setShowProjectManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-colors"
          >
            <Plus size={14} />
            New Project
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-muted)]">Admin Mode</span>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Stats Cards */}
      {stats && selectedProjectId && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Found</div>
            <div className="text-2xl font-bold">{stats.totalFound}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Emailed</div>
            <div className="text-2xl font-bold">{stats.emailed}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Replied</div>
            <div className="text-2xl font-bold">{stats.replied}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Agreed</div>
            <div className="text-2xl font-bold">{stats.agreed}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Content Sent</div>
            <div className="text-2xl font-bold">{stats.contentSent}</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="text-xs text-[var(--color-text-dim)] mb-1">Rejected</div>
            <div className="text-2xl font-bold">{stats.rejected}</div>
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

      {/* Project Manager Modal */}
      {showProjectManager && (
        <ProjectManager onClose={() => setShowProjectManager(false)} onCreated={handleProjectCreated} />
      )}
    </div>
  );
}
