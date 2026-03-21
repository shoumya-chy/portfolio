"use client";

import { useState } from "react";
import { Key, Shield, Save, Loader2, Eye, EyeOff, CheckCircle, Search } from "lucide-react";

interface SettingsData {
  admin: { email: string; hasPassword: boolean };
  apiKeys: { anthropic: string; bing: string; dataForSeoLogin?: string; dataForSeoPassword?: string };
  gsc: { hasCredentials: boolean };
  outreach?: { googleCSEId: string; googleCSEApiKey: string };
}

interface Props {
  settings: SettingsData;
  onSaved: () => void;
}

export function SettingsForm({ settings, onSaved }: Props) {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [bingKey, setBingKey] = useState("");
  const [gscJson, setGscJson] = useState("");
  const [googleCSEId, setGoogleCSEId] = useState("");
  const [googleCSEApiKey, setGoogleCSEApiKey] = useState("");
  const [dfLogin, setDfLogin] = useState("");
  const [dfPassword, setDfPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, string> = {};
      if (anthropicKey) body.anthropicKey = anthropicKey;
      if (bingKey) body.bingKey = bingKey;
      if (gscJson) body.gscCredentialsJson = btoa(gscJson);
      if (googleCSEId) body.googleCSEId = googleCSEId;
      if (googleCSEApiKey) body.googleCSEApiKey = googleCSEApiKey;
      if (dfLogin) body.dataForSeoLogin = dfLogin;
      if (dfPassword) body.dataForSeoPassword = dfPassword;
      if (newPassword) body.newPassword = newPassword;

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save");
      setMessage("Settings saved successfully!");
      setAnthropicKey("");
      setBingKey("");
      setGscJson("");
      setGoogleCSEId("");
      setGoogleCSEApiKey("");
      setDfLogin("");
      setDfPassword("");
      setNewPassword("");
      onSaved();
    } catch {
      setMessage("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Keys */}
      <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-[var(--color-accent)]" />
          <h3 className="font-semibold">API Keys</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              Anthropic API Key {settings.apiKeys.anthropic && <span className="text-[var(--color-green)]">(configured: {settings.apiKeys.anthropic})</span>}
            </label>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              Bing API Key {settings.apiKeys.bing && <span className="text-[var(--color-green)]">(configured: {settings.apiKeys.bing})</span>}
            </label>
            <input
              type="password"
              value={bingKey}
              onChange={(e) => setBingKey(e.target.value)}
              placeholder="Enter Bing Webmaster API key"
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              Google Service Account JSON {settings.gsc.hasCredentials && <span className="text-[var(--color-green)]">(configured)</span>}
            </label>
            <textarea
              value={gscJson}
              onChange={(e) => setGscJson(e.target.value)}
              placeholder='Paste the full JSON content from your service account key file...'
              rows={4}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Google Custom Search (Outreach) */}
      <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Search size={18} className="text-[var(--color-green)]" />
          <h3 className="font-semibold">Guest Post Outreach</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              Google CSE ID {settings.outreach?.googleCSEId && <span className="text-[var(--color-green)]">(configured: {settings.outreach.googleCSEId})</span>}
            </label>
            <input
              type="text"
              value={googleCSEId}
              onChange={(e) => setGoogleCSEId(e.target.value)}
              placeholder="Custom Search Engine ID"
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              Google CSE API Key {settings.outreach?.googleCSEApiKey && <span className="text-[var(--color-green)]">(configured: {settings.outreach.googleCSEApiKey})</span>}
            </label>
            <input
              type="password"
              value={googleCSEApiKey}
              onChange={(e) => setGoogleCSEApiKey(e.target.value)}
              placeholder="Google Custom Search API key"
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      </div>

      {/* DataForSEO */}
      <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Search size={18} className="text-[var(--color-purple)]" />
          <h3 className="font-semibold">DataForSEO (PAA & Related Searches)</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              DataForSEO Login {settings.apiKeys.dataForSeoLogin && <span className="text-[var(--color-green)]">(configured)</span>}
            </label>
            <input type="text" value={dfLogin} onChange={(e) => setDfLogin(e.target.value)} placeholder="your@email.com"
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-dim)] mb-1">
              DataForSEO Password {settings.apiKeys.dataForSeoPassword && <span className="text-[var(--color-green)]">(configured)</span>}
            </label>
            <input type="password" value={dfPassword} onChange={(e) => setDfPassword(e.target.value)} placeholder="DataForSEO API password"
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-[var(--color-purple)]" />
          <h3 className="font-semibold">Security</h3>
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-dim)] mb-1">
            Change Password {settings.admin.hasPassword && <span className="text-[var(--color-green)]">(set)</span>}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 pr-10 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || (!anthropicKey && !bingKey && !gscJson && !googleCSEId && !googleCSEApiKey && !dfLogin && !dfPassword && !newPassword)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
        {message && (
          <span className={`flex items-center gap-1 text-sm ${message.includes("Error") ? "text-red-400" : "text-[var(--color-green)]"}`}>
            {!message.includes("Error") && <CheckCircle size={14} />}
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
