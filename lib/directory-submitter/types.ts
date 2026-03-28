// ============ Site (user's website to submit) ============

export interface SiteToSubmit {
  id: string;
  url: string;
  name: string;
  description: string;           // short description (up to 250 chars)
  longDescription: string;       // detailed description (up to 500 chars)
  category: string;              // e.g. "Technology", "Business", "Health"
  keywords: string[];            // up to 10 keywords
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  language: string;              // default "English"
  reciprocalUrl?: string;        // some dirs require reciprocal links
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Directory (where we submit to) ============

export type DirectoryType = "general" | "niche" | "local" | "blog" | "rss" | "social-bookmark";

export type SubmissionMethod = "form-post" | "email" | "api" | "manual";

export interface DirectoryInfo {
  id: string;
  name: string;
  url: string;
  submitUrl: string;
  type: DirectoryType;
  method: SubmissionMethod;
  free: boolean;
  approxApprovalDays: number;    // -1 if unknown
  doFollow: boolean;
  pageRank?: number;
  notes?: string;
  active: boolean;
  /** Field mapping: tells the submitter which form fields to fill */
  fields?: Record<string, string>;
}

// ============ Submission Record ============

export type SubmissionStatus =
  | "pending"       // queued but not yet attempted
  | "submitting"    // currently being submitted
  | "submitted"     // form submitted successfully
  | "confirmed"     // verified (email confirmed or listing found)
  | "rejected"      // directory rejected the submission
  | "failed"        // technical error during submission
  | "skipped";      // skipped (captcha, paid, etc.)

export interface SubmissionRecord {
  id: string;
  siteId: string;
  directoryId: string;
  status: SubmissionStatus;
  attemptedAt?: string;
  confirmedAt?: string;
  errorMessage?: string;
  responseCode?: number;
  listingUrl?: string;           // URL of listing once confirmed
  notes?: string;
  retryCount: number;
}

// ============ Submission Job ============

export interface SubmissionJob {
  jobId: string;
  siteId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  totalDirectories: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startedAt: string;
  completedAt?: string;
  log: string[];
}

// ============ Dashboard Stats ============

export interface DirectorySubmitterStats {
  totalSites: number;
  totalDirectories: number;
  totalSubmissions: number;
  submitted: number;
  confirmed: number;
  failed: number;
  pending: number;
  skipped: number;
  lastSubmissionAt?: string;
}
