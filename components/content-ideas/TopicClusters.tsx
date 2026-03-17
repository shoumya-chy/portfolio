import { Layers } from "lucide-react";
import type { TopicCluster, ContentGap } from "@/lib/types";

interface Props {
  clusters: TopicCluster[];
  gaps: ContentGap[];
  blurred?: boolean;
}

const oppColors = {
  high: "var(--color-green)",
  medium: "var(--color-orange)",
  low: "var(--color-text-dim)",
};

export function TopicClusters({ clusters, gaps, blurred = false }: Props) {
  return (
    <div className="space-y-8">
      {/* Clusters */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers size={18} className="text-[var(--color-purple)]" />
          <h3 className="text-lg font-semibold">Topic Clusters</h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--color-purple)_15%,transparent)] text-[var(--color-purple)]">
            {clusters.length} clusters
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {clusters.map((c, i) => (
            <div
              key={i}
              className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl card-glow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className={`font-semibold ${blurred ? "blur-sm select-none" : ""}`}>
                  {c.pillarTopic}
                </h4>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-md border shrink-0"
                  style={{ color: oppColors[c.opportunity], borderColor: oppColors[c.opportunity] }}
                >
                  {c.opportunity}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-[var(--color-text-dim)] mb-1">Subtopics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.subtopics.map((s, j) => (
                      <span
                        key={j}
                        className={`px-2 py-0.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md ${blurred ? "blur-sm select-none" : ""}`}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-dim)] mb-1">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.keywords.slice(0, 4).map((k, j) => (
                      <span
                        key={j}
                        className={`px-2 py-0.5 text-xs font-mono text-[var(--color-accent)] border border-[var(--color-accent)]/30 rounded-md ${blurred ? "blur-sm select-none" : ""}`}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Gaps */}
      {gaps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-[var(--color-orange)]" />
            <h3 className="text-lg font-semibold">Content Gaps</h3>
          </div>

          <div className="space-y-3">
            {gaps.map((g, i) => (
              <div
                key={i}
                className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className={`font-semibold ${blurred ? "blur-sm select-none" : ""}`}>{g.topic}</h4>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-md border shrink-0"
                    style={{ color: oppColors[g.opportunity], borderColor: oppColors[g.opportunity] }}
                  >
                    {g.opportunity} opportunity
                  </span>
                </div>
                <p className={`text-sm text-[var(--color-text-muted)] ${blurred ? "blur-sm select-none" : ""}`}>
                  {g.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
