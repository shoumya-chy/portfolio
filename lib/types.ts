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

// ============ Page-Keyword Mapping (GSC) ============
export interface PageKeywordEntry {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
}

export interface PageKeywordMap {
  url: string;
  keywords: PageKeywordEntry[];
  totalImpressions: number;
  totalClicks: number;
}

// ============ DataForSEO PAA ============
export interface PAAQuestion {
  question: string;
  seedKeyword: string;
  fetchedAt: string;
}

export interface RelatedSearch {
  query: string;
  seedKeyword: string;
  fetchedAt: string;
}

// ============ Topic Candidate (scoring pipeline) ============
export interface TopicCandidate {
  topic: string;
  normalizedTopic: string;
  score: number;
  sources: string[];  // which data sources contributed: "gsc", "bing", "paa", "quora", "related"
  gscImpressions: number;
  gscPosition: number;
  paaSource: boolean;
  bingSignal: boolean;
  quoraSignal: boolean;
  wordCount: number;
}

// ============ Final Recommendation (Claude output) ============
export interface TopicRecommendation {
  topic: string;
  cluster: string;
  rationale: string;
  score: number;
  source: string;
  action?: "new" | "optimize";
  existingUrl?: string;
}

// ============ Pipeline Result ============
export interface PipelineStats {
  gscKeywords: number;
  bingKeywords: number;
  paaQuestions: number;
  quoraTopics: number;
  totalCandidates: number;
  afterDedup: number;
  afterExclusion: number;
  finalRecommendations: number;
  wpPostsChecked: number;
}

export interface DiscoveryResult {
  recommendations: TopicRecommendation[];
  stats: PipelineStats;
  summary: string;
  analyzedAt: string;
}

// ============ Legacy types (kept for backward compat) ============
export interface ContentIdea {
  title: string;
  description: string;
  relatedKeywords: string[];
  difficulty: "low" | "medium" | "high";
  contentType: "blog" | "guide" | "case-study" | "tool" | "video";
  estimatedSearchVolume: string;
  day?: number;
  reason?: string;
  action?: "new" | "optimize";
  existingUrl?: string;
}

export interface TrendingContentIdea {
  title: string;
  description: string;
  sourceTopics: string[];
  source: "reddit" | "quora" | "both";
  relatedKeywords: string[];
  difficulty: "low" | "medium" | "high";
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
  trendingIdeas: TrendingContentIdea[];
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
