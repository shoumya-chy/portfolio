import fs from "fs";
import path from "path";
import type {
  BookmarkSite,
  BookmarkPost,
  BookmarkSubmission,
  BookmarkJob,
  BookmarkStats,
  BookmarkSettings,
} from "./types";
import platforms from "./platforms";

const DATA_DIR = path.join(process.cwd(), "data", "social-bookmarking");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============ Sites ============

function sitesFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "sites.json");
}

export function listSites(): BookmarkSite[] {
  try {
    return JSON.parse(fs.readFileSync(sitesFile(), "utf-8"));
  } catch {
    return [];
  }
}

export function getSite(siteId: string): BookmarkSite | null {
  return listSites().find((s) => s.id === siteId) || null;
}

export function saveSite(site: BookmarkSite): void {
  const all = listSites();
  const idx = all.findIndex((s) => s.id === site.id);
  if (idx >= 0) all[idx] = site;
  else all.push(site);
  fs.writeFileSync(sitesFile(), JSON.stringify(all, null, 2), "utf-8");
}

export function deleteSite(siteId: string): boolean {
  const all = listSites();
  const filtered = all.filter((s) => s.id !== siteId);
  if (filtered.length === all.length) return false;
  fs.writeFileSync(sitesFile(), JSON.stringify(filtered, null, 2), "utf-8");
  // Also remove posts and submissions
  const posts = listPosts().filter((p) => p.siteId !== siteId);
  fs.writeFileSync(postsFile(), JSON.stringify(posts, null, 2), "utf-8");
  const subs = listSubmissions().filter((s) => s.siteId !== siteId);
  fs.writeFileSync(submissionsFile(), JSON.stringify(subs, null, 2), "utf-8");
  return true;
}

// ============ Posts ============

function postsFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "posts.json");
}

export function listPosts(siteId?: string): BookmarkPost[] {
  try {
    const all: BookmarkPost[] = JSON.parse(fs.readFileSync(postsFile(), "utf-8"));
    return siteId ? all.filter((p) => p.siteId === siteId) : all;
  } catch {
    return [];
  }
}

export function getPost(postId: string): BookmarkPost | null {
  return listPosts().find((p) => p.id === postId) || null;
}

export function savePost(post: BookmarkPost): void {
  const all = listPosts();
  const idx = all.findIndex((p) => p.id === post.id);
  if (idx >= 0) all[idx] = post;
  else all.push(post);
  fs.writeFileSync(postsFile(), JSON.stringify(all, null, 2), "utf-8");
}

export function savePosts(posts: BookmarkPost[]): void {
  fs.writeFileSync(postsFile(), JSON.stringify(posts, null, 2), "utf-8");
}

export function deletePost(postId: string): boolean {
  const all = listPosts();
  const filtered = all.filter((p) => p.id !== postId);
  if (filtered.length === all.length) return false;
  fs.writeFileSync(postsFile(), JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}

// ============ Submissions ============

function submissionsFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "submissions.json");
}

export function listSubmissions(siteId?: string): BookmarkSubmission[] {
  try {
    const all: BookmarkSubmission[] = JSON.parse(fs.readFileSync(submissionsFile(), "utf-8"));
    return siteId ? all.filter((s) => s.siteId === siteId) : all;
  } catch {
    return [];
  }
}

export function saveSubmission(record: BookmarkSubmission): void {
  const all = listSubmissions();
  const idx = all.findIndex((s) => s.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  fs.writeFileSync(submissionsFile(), JSON.stringify(all, null, 2), "utf-8");
}

export function saveSubmissionsBatch(records: BookmarkSubmission[]): void {
  fs.writeFileSync(submissionsFile(), JSON.stringify(records, null, 2), "utf-8");
}

// ============ Job State ============

function jobFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "current-job.json");
}

export function getJob(): BookmarkJob | null {
  try {
    return JSON.parse(fs.readFileSync(jobFile(), "utf-8"));
  } catch {
    return null;
  }
}

export function saveJob(job: BookmarkJob): void {
  fs.writeFileSync(jobFile(), JSON.stringify(job, null, 2), "utf-8");
}

export function clearJob(): void {
  try {
    fs.unlinkSync(jobFile());
  } catch { /* ignore */ }
}

// ============ Settings ============

function settingsFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "settings.json");
}

export function getSettings(): BookmarkSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf-8"));
  } catch {
    return {
      twoCaptchaApiKey: "",
      solveCaptchas: false,
      maxPerDay: 5,
      delayBetweenMs: 3000,
    };
  }
}

export function saveSettings(settings: BookmarkSettings): void {
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), "utf-8");
}

// ============ Stats ============

export function getStats(siteId?: string): BookmarkStats {
  const sites = listSites();
  const posts = listPosts(siteId);
  const subs = listSubmissions(siteId);

  return {
    totalSites: sites.length,
    totalPosts: posts.length,
    totalPlatforms: platforms.filter((p) => p.active).length,
    totalSubmissions: subs.length,
    submitted: subs.filter((s) => s.status === "submitted").length,
    confirmed: subs.filter((s) => s.status === "confirmed").length,
    failed: subs.filter((s) => s.status === "failed").length,
    pending: subs.filter((s) => s.status === "pending").length,
    skipped: subs.filter((s) => s.status === "skipped").length,
    lastSubmissionAt: subs
      .filter((s) => s.attemptedAt)
      .sort((a, b) => (b.attemptedAt! > a.attemptedAt! ? 1 : -1))[0]?.attemptedAt,
  };
}
