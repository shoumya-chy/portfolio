import { Sparkles, ArrowRight } from "lucide-react";
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

const typeLabels = {
  blog: "Blog Post",
  guide: "Guide",
  "case-study": "Case Study",
  tool: "Tool",
  video: "Video",
};

export function ContentIdeasList({ ideas, blurred = false }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-[var(--color-accent)]" />
        <h3 className="text-lg font-semibold">AI-Generated Content Ideas</h3>
        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
          {ideas.length} ideas
        </span>
      </div>

      <div className="grid gap-3">
        {ideas.map((idea, i) => (
          <div
            key={i}
            className="group p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-hover)] transition-all card-glow"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h4 className={`font-semibold group-hover:text-[var(--color-accent)] transition-colors ${blurred ? "blur-sm select-none" : ""}`}>
                {idea.title}
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-md border"
                  style={{
                    color: difficultyColors[idea.difficulty],
                    borderColor: difficultyColors[idea.difficulty],
                  }}
                >
                  {idea.difficulty}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-dim)]">
                  {typeLabels[idea.contentType] || idea.contentType}
                </span>
              </div>
            </div>

            <p className={`text-sm text-[var(--color-text-muted)] mb-3 ${blurred ? "blur-sm select-none" : ""}`}>
              {idea.description}
            </p>

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
        ))}
      </div>
    </div>
  );
}
