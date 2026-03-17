import { Search, MousePointerClick, TrendingUp, Sparkles, Database, Zap } from "lucide-react";

interface Props {
  totalKeywords: number;
  totalImpressions: number;
  totalClicks: number;
  avgPosition: number;
  ideasGenerated: number;
  dataSources: number;
  blurred?: boolean;
}

const cards = [
  { key: "keywords", label: "Keywords Tracked", icon: Search, color: "var(--color-accent)" },
  { key: "impressions", label: "Impressions (28d)", icon: TrendingUp, color: "var(--color-green)" },
  { key: "clicks", label: "Clicks (28d)", icon: MousePointerClick, color: "var(--color-purple)" },
  { key: "position", label: "Avg. Position", icon: Zap, color: "var(--color-orange)" },
  { key: "ideas", label: "Ideas Generated", icon: Sparkles, color: "var(--color-accent)" },
  { key: "sources", label: "Data Sources", icon: Database, color: "var(--color-green)" },
];

export function StatsCards(props: Props) {
  const values: Record<string, string> = {
    keywords: props.totalKeywords.toLocaleString(),
    impressions: props.totalImpressions.toLocaleString(),
    clicks: props.totalClicks.toLocaleString(),
    position: props.avgPosition.toFixed(1),
    ideas: props.ideasGenerated.toLocaleString(),
    sources: props.dataSources.toString(),
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon size={16} style={{ color: card.color }} />
            <span className="text-xs text-[var(--color-text-dim)]">{card.label}</span>
          </div>
          <p
            className={`text-2xl font-bold ${props.blurred ? "blur-sm select-none" : ""}`}
            style={{ color: card.color }}
          >
            {values[card.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
