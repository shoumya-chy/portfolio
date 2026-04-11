export interface PinterestSite {
  id: string;
  /** Display name, e.g. "New Life In Aus" */
  name: string;
  /** WordPress base URL, e.g. "https://newlifeinaus.com.au" */
  wpBaseUrl: string;
  /** WP REST API username */
  wpUsername: string;
  /** WP Application Password */
  wpAppPassword: string;
  /** Pinterest OAuth access token */
  pinterestAccessToken: string;
  /** Pinterest board ID to pin to */
  pinterestBoardId: string;
  /** How many pins per day (default 10) */
  pinsPerDay: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PinnedPost {
  postUrl: string;
  postTitle: string;
  pinId: string;
  pinnedAt: string;
  siteId: string;
  /** Pin title used */
  pinTitle: string;
  /** Pin description used */
  pinDescription: string;
  /** Error message if failed */
  error?: string;
  status: "pinned" | "failed";
}

export interface PinCandidate {
  postUrl: string;
  postTitle: string;
  excerpt: string;
  slug: string;
  categories: string[];
  tags: string[];
  featuredImageUrl: string;
  /** Primary keyword extracted from slug */
  primaryKeyword: string;
  /** Monthly search volume from DataForSEO */
  searchVolume: number;
}

export interface PinSelection {
  post_url: string;
  pin_title: string;
  pin_description: string;
  image_prompt: string;
}

export interface PipelineResult {
  siteId: string;
  siteName: string;
  attempted: number;
  published: number;
  failed: number;
  pins: {
    postUrl: string;
    postTitle: string;
    pinId?: string;
    status: "pinned" | "failed";
    error?: string;
  }[];
  startedAt: string;
  completedAt: string;
}

export interface PinterestJob {
  jobId: string;
  siteId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  message: string;
  current: number;
  total: number;
  log: string[];
  result?: PipelineResult;
  error?: string;
}
