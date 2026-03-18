export type QueryStatus = "new" | "responded" | "skipped" | "failed";

export type QuerySource = "sourcebottle" | "qwoted" | "featured" | "unknown";

export interface HaroConfig {
  id: string;
  siteUrl: string;
  siteName: string;
  emailAddress: string;
  imapConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  respondAsName: string;
  respondAsTitle: string;
  bio: string;
  expertiseAreas: string[];
  multiNiche: boolean;
  active: boolean;
  createdAt: string;
}

export interface JournalistQuery {
  id: string;
  configId: string;
  source: QuerySource;
  sourceEmailFrom: string;
  sourceEmailSubject: string;
  sourceEmailDate: string;
  sourceMessageId: string;

  // Parsed query details
  journalistName: string;
  outlet: string;
  topic: string;
  queryText: string;
  deadline: string;
  requirements: string;
  replyToEmail: string;

  // Response
  status: QueryStatus;
  aiResponse: string;
  responseSentAt: string;
  responseMessageId: string;

  // Tracking
  createdAt: string;
  error: string;
}

export interface HaroStats {
  totalQueries: number;
  responded: number;
  skipped: number;
  failed: number;
  todayQueries: number;
  todayResponded: number;
  lastCheckAt: string;
}
