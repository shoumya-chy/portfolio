"use client";

import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { ProspectDetail } from "./ProspectDetail";
import { getStateColor, getStateLabel } from "@/lib/outreach/state-machine";
import type { OutreachProspect } from "@/lib/outreach/types";

interface Props {
  prospects: OutreachProspect[];
  projectId: string;
  onRefresh: () => void;
}

type FilterState = "all" | "found" | "emailed" | "replied" | "agreed" | "content_sent" | "rejected";

export function ProspectsList({ prospects, projectId, onRefresh }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterState>("all");
  const [selectedProspect, setSelectedProspect] = useState<OutreachProspect | null>(null);
  const [generatingContent, setGeneratingContent] = useState<Record<string, boolean>>({});

  const filters: { label: string; value: FilterState }[] = [
    { label: "All", value: "all" },
    { label: "Found", value: "found" },
    { label: "Emailed", value: "emailed" },
    { label: "Replied", value: "replied" },
    { label: "Agreed", value: "agreed" },
    { label: "Content Sent", value: "content_sent" },
    { label: "Rejected", value: "rejected" },
  ];

  const filtered =
    activeFilter === "all" ? prospects : prospects.filter((p) => p.state === activeFilter);

  const sorted = [...filtered].sort((a, b) => {
    const aTime = a.contentSentAt || a.agreedAt || a.repliedAt || a.lastEmailSentAt || a.createdAt;
    const bTime = b.contentSentAt || b.agreedAt || b.repliedAt || b.lastEmailSentAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  const handleGenerateContent = async (prospect: OutreachProspect) => {
    setGeneratingContent((p) => ({ ...p, [prospect.id]: true }));
    try {
      const res = await fetch("/api/tools/guest-post-outreach/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prospectId: prospect.id }),
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setGeneratingContent((p) => ({ ...p, [prospect.id]: false }));
    }
  };

  return (
    <>
      <div>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {filters.map((filter) => {
            const count = filter.value === "all" ? prospects.length : prospects.filter((p) => p.state === filter.value).length;
            return (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeFilter === filter.value
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)]"
                }`}
              >
                {filter.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Prospects table */}
        {sorted.length > 0 ? (
          <div className="space-y-2">
            {sorted.map((prospect) => (
              <div
                key={prospect.id}
                className="flex items-center justify-between gap-4 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-border-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-mono text-sm text-[var(--color-text)] truncate">{prospect.targetDomain}</p>
                    <span
                      className="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: `${getStateColor(prospect.state)}20`,
                        color: getStateColor(prospect.state),
                      }}
                    >
                      {getStateLabel(prospect.state)}
                    </span>
                  </div>
                  <p className={`text-xs font-mono truncate ${prospect.contactEmail ? "text-[var(--color-text-dim)]" : "text-orange-400"}`}>
                    {prospect.contactEmail || "No email found — check site manually"}
                  </p>
                  {prospect.lastEmailSentAt && (
                    <p className="text-xs text-[var(--color-text-dim)] mt-1">
                      Last activity:{" "}
                      {new Date(prospect.lastEmailSentAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--color-text-dim)]">
                      {prospect.outboundEmails.length} emails
                    </p>
                  </div>

                  {prospect.state === "agreed" && (
                    <button
                      onClick={() => handleGenerateContent(prospect)}
                      disabled={generatingContent[prospect.id]}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--color-purple)] hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {generatingContent[prospect.id] ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Mail size={12} />
                      )}
                      Generate
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedProspect(prospect)}
                    className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg)] transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-dim)]">
            No prospects in this filter.
          </div>
        )}
      </div>

      {/* Prospect detail modal */}
      {selectedProspect && (
        <ProspectDetail
          prospect={selectedProspect}
          projectId={projectId}
          onClose={() => setSelectedProspect(null)}
        />
      )}
    </>
  );
}
