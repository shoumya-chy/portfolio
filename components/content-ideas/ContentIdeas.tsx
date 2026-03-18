import { Sparkles, Calendar } from "lucide-react";
import type { ContentIdea } from "@/lib/types";

interface Props {
  ideas: ContentIdea[];
  blurred?: boolean;
}

const difficultyColors = {
  low: "var(--color-green)",
  medium: "var(--color-orange)",
  high: "#ef4444",
};

const typeLabels: Record<string, string> = {
  blog: "Blog Post",
  guide: "Guide",
  "case-study": "Case Study",
  tool: "Tool",
  video: "Video",
};

const dayLabels = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ContentIdeasList({ ideas, blurred = false }: Props) {
  // Sort by day if available
  const sorted = [...ideas].sort((a, b) => (a.day || 99) - (b.day || 99));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={18} className="text-[var(--color-accent)]" />
        <h3 className="text-lg font-semibold">Content Plan — Priority Ranked</h3>
        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
          {ideas.length} articles
        </span>
      </div>

      <div className="space-y-3">
        {sorted.map((idea, i) => (
          <div
            key={i}
            className="group p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-hover)] transition-all card-glow"
          >
            <div className="flex items-start gap-3">
              {/* Day number */}
              {idea.day && (
                <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--color-accent-glow)] flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-[var(--color-accent)]">{idea.day}</span>
                  <span className="text-[9px] uppercase text-[var(--color-text-dim)]">{dayLabels[idea.day] || ""}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className={`font-semibold group-hover:text-[var(--color-accent)] transition-colors ${blurred ? "blur-sm select-none" : ""}`}>
                    {idea.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-xs font-mono px-1.5 py-0.5 rounded border"
                      style={{
                        color: difficultyColors[idea.difficulty],
                        borderColor: difficultyColors[idea.difficulty],
                      }}
                    >
                      {idea.difficulty}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-dim)]">
                      {typeLabels[idea.contentType] || idea.contentType}
                    </span>
                  </div>
                </div>

                <p className={`text-sm text-[var(--color-text-muted)] mb-2 ${blurred ? "blur-sm select-none" : ""}`}>
                  {idea.description}
                </p>

                {/* Reason / Priority explanation */}
                {idea.reason && (
                  <p className="text-xs text-[var(--color-accent)] mb-2 italic">
                    {idea.reason}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {idea.relatedKeywords.slice(0, 5).map((kw, j) => (
                    <span
                      key={j}
                      className={`px-2 py-0.5 text-xs font-mono text-[var(--color-text-dim)] border border-[var(--color-border)] rounded-md ${blurred ? "blur-sm select-none" : ""}`}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
