"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { getStateColor, getStateLabel } from "@/lib/outreach/state-machine";
import type { OutreachProspect, GeneratedGuestPost } from "@/lib/outreach/types";

interface Props {
  prospect: OutreachProspect | null;
  projectId: string;
  onClose: () => void;
}

export function ProspectDetail({ prospect, projectId, onClose }: Props) {
  const [generatedContent, setGeneratedContent] = useState<GeneratedGuestPost | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (prospect?.state === "content_sent") {
      setLoadingContent(true);
      fetch(`/api/tools/guest-post-outreach/generate-content?projectId=${projectId}&prospectId=${prospect.id}`)
        .then((r) => r.json())
        .then((d) => setGeneratedContent(d.content || null))
        .finally(() => setLoadingContent(false));
    }
  }, [prospect, projectId]);

  if (!prospect) return null;

  const timeline: { label: string; date: string }[] = [
    { label: "Found", date: prospect.createdAt },
    ...(prospect.lastEmailSentAt ? [{ label: "Last Email", date: prospect.lastEmailSentAt }] : []),
    ...(prospect.repliedAt ? [{ label: "Replied", date: prospect.repliedAt }] : []),
    ...(prospect.agreedAt ? [{ label: "Agreed", date: prospect.agreedAt }] : []),
    ...(prospect.contentSentAt ? [{ label: "Content Sent", date: prospect.contentSentAt }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <p className="font-mono text-lg text-[var(--color-text)]">{prospect.targetDomain}</p>
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: `${getStateColor(prospect.state)}20`,
                  color: getStateColor(prospect.state),
                }}
              >
                {getStateLabel(prospect.state)}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-dim)] font-mono">{prospect.contactEmail}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-dim)] mb-3">Timeline</h3>
            <div className="space-y-2">
              {timeline.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)]">{event.label}</p>
                  </div>
                  <p className="text-xs text-[var(--color-text-dim)]">
                    {new Date(event.date).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Outbound Emails */}
          {prospect.outboundEmails.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)] mb-3">
                Outbound Emails ({prospect.outboundEmails.length})
              </h3>
              <div className="space-y-2">
                {prospect.outboundEmails.map((email, i) => (
                  <div key={i} className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg">
                    <p className="text-sm font-medium text-[var(--color-text)] mb-1">{email.subject}</p>
                    <p className="text-xs text-[var(--color-text-dim)] mb-2">
                      {new Date(email.sentAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{email.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inbound Emails */}
          {prospect.inboundEmails.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)] mb-3">
                Inbound Emails ({prospect.inboundEmails.length})
              </h3>
              <div className="space-y-2">
                {prospect.inboundEmails.map((email, i) => (
                  <div key={i} className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">{email.subject}</p>
                        <p className="text-xs text-[var(--color-text-dim)]">
                          {new Date(email.receivedAt).toLocaleString()}
                        </p>
                      </div>
                      {email.isAgreement && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-green)]/20 text-[var(--color-green)]">
                          Agreement
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-3">{email.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Content */}
          {prospect.state === "content_sent" && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)] mb-3">Generated Content</h3>
              {loadingContent ? (
                <div className="flex items-center justify-center py-8 text-[var(--color-text-dim)]">
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Loading content...
                </div>
              ) : generatedContent ? (
                <div className="space-y-4 p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg">
                  <div>
                    <h4 className="font-medium text-[var(--color-text)] mb-2">{generatedContent.title}</h4>
                    <p className="text-xs text-[var(--color-text-dim)] mb-3">
                      {generatedContent.wordCount} words • Generated{" "}
                      {new Date(generatedContent.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] line-clamp-4 whitespace-pre-wrap">
                    {generatedContent.body}
                  </p>
                  {generatedContent.backlinks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-dim)] mb-2">Backlinks</p>
                      <ul className="space-y-1">
                        {generatedContent.backlinks.map((link, i) => (
                          <li key={i} className="text-xs text-[var(--color-text-muted)]">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-accent)] hover:underline"
                            >
                              {link.anchorText}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-[var(--color-text-dim)]">No content generated yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
