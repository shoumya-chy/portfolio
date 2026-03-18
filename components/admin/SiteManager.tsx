"use client";

import { useState } from "react";
import { Globe, Plus, Trash2, Loader2, MapPin, Pencil, Check, X } from "lucide-react";

interface Site {
  id: string;
  name: string;
  url: string;
  sitemapUrl?: string;
}

interface Props {
  sites: Site[];
  onUpdated: () => void;
}

export function SiteManager({ sites, onUpdated }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSitemapUrl, setEditSitemapUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const addSite = async () => {
    if (!name || !url) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url: url.startsWith("http") ? url : `https://${url}`,
          sitemapUrl: sitemapUrl || undefined,
        }),
      });
      if (res.ok) {
        setName("");
        setUrl("");
        setSitemapUrl("");
        onUpdated();
      }
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (site: Site) => {
    setEditingId(site.id);
    setEditName(site.name);
    setEditUrl(site.url);
    setEditSitemapUrl(site.sitemapUrl || "");
  };

  const saveEdit = async () => {
    if (!editingId || !editName || !editUrl) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editName,
          url: editUrl.startsWith("http") ? editUrl : `https://${editUrl}`,
          sitemapUrl: editSitemapUrl || undefined,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  };

  const removeSite = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) onUpdated();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={18} className="text-[var(--color-green)]" />
        <h3 className="font-semibold">Tracked Sites</h3>
        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
          {sites.length}
        </span>
      </div>

      {/* Existing sites */}
      {sites.length > 0 && (
        <div className="space-y-2 mb-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg"
            >
              {editingId === site.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Site name" className="flex-1 px-2 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
                    <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="URL" className="flex-1 px-2 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div className="flex gap-2">
                    <input value={editSitemapUrl} onChange={(e) => setEditSitemapUrl(e.target.value)} placeholder="Sitemap URL (optional)" className="flex-1 px-2 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
                    <button onClick={saveEdit} disabled={saving} className="p-1.5 text-[var(--color-green)] hover:opacity-80">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{site.name}</p>
                    <p className="text-xs text-[var(--color-text-dim)] font-mono">{site.url}</p>
                    {site.sitemapUrl && (
                      <p className="text-xs text-[var(--color-text-dim)] font-mono flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {site.sitemapUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(site)}
                      className="p-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeSite(site.id)}
                      disabled={deleting === site.id}
                      className="p-1.5 text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      {deleting === site.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Site name"
            className="flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="Sitemap URL (optional, e.g. https://example.com/sitemap.xml)"
            className="flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={addSite}
            disabled={adding || !name || !url}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-[var(--color-green)] hover:opacity-90 text-white rounded-lg transition-all disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
