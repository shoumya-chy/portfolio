// ============ Site (user's website) ============

export interface BookmarkSite {
  id: string;
  url: string;                    // base URL e.g. https://example.com
  name: string;
  description: string;
  keywords: string[];
  sitemapUrl?: string;            // e.g. https://example.com/sitemap.xml
  rssUrl?: string;                // e.g. https://example.com/feed
  contactEmail: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Post (individual page to bookmark) ============

export interface BookmarkPost {
  id: string;
  siteId: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  source: "sitemap" | "rss" | "manual";
  discoveredAt: string;
  /** Whether this post has been submitted to any platform */
  submitted: boolean;
}

// ============ Bookmarking Platform ============

export type PlatformType = "social" | "bookmarking" | "community" | "content";

export interface BookmarkPlatform {
  id: string;
  name: string;
  url: string;
  submitUrl: string;
  type: PlatformType;
  da: number;                     // domain authority
  doFollow: boolean;
  free: boolean;
  /** Does it require account creation to submit? */
  requiresAccount: boolean;
  /** Submission method */
  method: "form-post" | "api" | "manual";
  notes?: string;
  active: boolean;
}

// ============ Submission Record ============

export type BookmarkStatus =
  | "pending"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "failed"
  | "skipped";

export interface BookmarkSubmission {
  id: string;
  postId: string;
  platformId: string;
  siteId: string;
  status: BookmarkStatus;
  attemptedAt?: string;
  errorMessage?: string;
  responseCode?: number;
  bookmarkUrl?: string;           // URL of the bookmark on the platform
  notes?: string;
  retryCount: number;
}

// ============ Submission Job ============

export interface BookmarkJob {
  jobId: string;
  siteId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  totalPlatforms: number;
  totalPosts: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startedAt: string;
  completedAt?: string;
  log: string[];
}

// ============ Dashboard Stats ============

export interface BookmarkStats {
  totalSites: number;
  totalPosts: number;
  totalPlatforms: number;
  totalSubmissions: number;
  submitted: number;
  confirmed: number;
  failed: number;
  pending: number;
  skipped: number;
  lastSubmissionAt?: string;
}

// ============ Settings ============

export interface BookmarkSettings {
  twoCaptchaApiKey: string;
  solveCaptchas: boolean;
  /** Max bookmarks per day per platform (rate limiting) */
  maxPerDay: number;
  /** Delay between submissions in ms */
  delayBetweenMs: number;
}
