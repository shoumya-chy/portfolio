export type OutreachState = "found" | "emailed" | "replied" | "agreed" | "content_sent" | "rejected" | "no_response";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface OutreachProject {
  id: string;
  siteId: string;
  name: string;
  /** Human sender name shown in emails, e.g. "Shoumya Chowdhury" */
  senderName: string;
  niche: string;
  emailAddress: string;
  domainFilters: string[];
  smtpConfig: SmtpConfig;
  imapConfig: ImapConfig;
  emailsPerWeek: number;
  emailsPerDay: number;
  /** Days after first email to send follow-up (default: 5) */
  followUpDays: number;
  /** Max follow-ups per prospect (default: 2) */
  maxFollowUps: number;
  active: boolean;
  createdAt: string;
}

export interface EmailRecord {
  sentAt: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId?: string;
}

export interface InboundEmail {
  receivedAt: string;
  from: string;
  subject: string;
  snippet: string;
  messageId: string;
  isAgreement: boolean;
}

export interface OutreachProspect {
  id: string;
  projectId: string;
  targetUrl: string;
  targetDomain: string;
  contactEmail: string;
  writeForUsPage: string;
  state: OutreachState;
  createdAt: string;
  lastEmailSentAt?: string;
  repliedAt?: string;
  agreedAt?: string;
  contentSentAt?: string;
  outboundEmails: EmailRecord[];
  inboundEmails: InboundEmail[];
  // Phase 1 enhancements
  domainAuthority?: number;
  siteNiche?: string;
  guidelinesSnippet?: string;
  /** Title of the prospect's write-for-us page (from search results) */
  pageTitle?: string;
  // Phase 2 enhancements
  matchedPostUrl?: string;
  matchedPostTitle?: string;
  anchorText?: string;
  anchorStrategy?: "partial-match" | "natural" | "branded";
  pitchedTopics?: string[];
  /** How many follow-up emails have been sent */
  followUpCount?: number;
  /** When the last follow-up was sent */
  lastFollowUpAt?: string;
}

export interface BacklinkTarget {
  url: string;
  title: string;
  impressions: number;
  clicks: number;
  position: number;
  score: number;
  backlinkCount: number;
  priority: "high" | "medium" | "low";
  trafficPotential?: number;
  focusKeyword?: string;
  wordCount?: number;
}

export interface GeneratedGuestPost {
  title: string;
  body: string;
  wordCount: number;
  backlinks: { url: string; anchorText: string }[];
  generatedAt: string;
}

export interface OutreachStats {
  totalFound: number;
  emailed: number;
  replied: number;
  agreed: number;
  contentSent: number;
  rejected: number;
  noResponse: number;
  emailsSentThisWeek: number;
  weekStart: string;
  emailsSentToday: number;
  todayDate: string;
  lastRunAt: string;
  lastDailyRunAt?: string;
  pendingWithEmail: number;
}
