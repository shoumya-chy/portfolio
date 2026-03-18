// ============ Auth ============
export interface AuthPayload {
  isAdmin: boolean;
  iat: number;
  exp: number;
}

// ============ Keywords ============
export interface Keyword {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  source: "gsc" | "bing";
}

export interface KeywordData {
  keywords: Keyword[];
  totalImpressions: number;
  totalClicks: number;
  avgPosition: number;
  fetchedAt: string;
}

// ============ Reddit / Quora ============
export interface TrendingTopic {
  title: string;
  url: string;
  score: number;
  subreddit?: string;
  source: "reddit" | "quora";
  fetchedAt: string;
}

// ============ Content Ideas (Claude output) ============
export interface ContentIdea {
  title: string;
  description: string;
  relatedKeywords: string[];
  difficulty: "low" | "medium" | "high";
  contentType: "blog" | "guide" | "case-study" | "tool" | "video";
  estimatedSearchVolume: string;
  day?: number;
  reason?: string;
}

export interface TopicCluster {
  pillarTopic: string;
  subtopics: string[];
  keywords: string[];
  opportunity: "high" | "medium" | "low";
}

export interface ContentGap {
  topic: string;
  description: string;
  keywords: string[];
  opportunity: "high" | "medium" | "low";
}

export interface AnalysisResult {
  ideas: ContentIdea[];
  clusters: TopicCluster[];
  gaps: ContentGap[];
  summary: string;
  analyzedAt: string;
}

// ============ Dashboard State ============
export interface DashboardData {
  gsc: KeywordData | null;
  bing: KeywordData | null;
  reddit: TrendingTopic[];
  analysis: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

// ============ Visitor Stats ============
export interface PublicStats {
  totalKeywords: number;
  totalProperties: number;
  totalIdeasGenerated: number;
  lastUpdated: string;
  dataSources: string[];
}
