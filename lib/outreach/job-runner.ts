import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "outreach");

export interface JobProgress {
  jobId: string;
  type: "bulk-find" | "send-emails" | "daily-run";
  projectId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  /** Current step description shown to user */
  message: string;
  /** How many items processed so far */
  current: number;
  /** Total items to process (0 if unknown yet) */
  total: number;
  /** Detailed log lines */
  log: string[];
  /** Final result data */
  result?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function jobDir(): string {
  const dir = path.join(DATA_DIR, "_jobs");
  ensureDir(dir);
  return dir;
}

function jobPath(projectId: string): string {
  return path.join(jobDir(), `${projectId}.json`);
}

/** Get current job status for a project (null if no active job) */
export function getJobStatus(projectId: string): JobProgress | null {
  try {
    const raw = fs.readFileSync(jobPath(projectId), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Check if a job is currently running for this project */
export function isJobRunning(projectId: string): boolean {
  const job = getJobStatus(projectId);
  return job?.status === "running";
}

/** Save job progress to disk (called frequently during job execution) */
export function updateJob(projectId: string, update: Partial<JobProgress>): void {
  const existing = getJobStatus(projectId);
  if (!existing) return;
  const updated = { ...existing, ...update };
  fs.writeFileSync(jobPath(projectId), JSON.stringify(updated, null, 2), "utf-8");
}

/** Start a new background job. Returns the job, or null if one is already running. */
export function startJob(
  projectId: string,
  type: JobProgress["type"],
  message: string
): JobProgress | null {
  if (isJobRunning(projectId)) return null;

  const job: JobProgress = {
    jobId: `${type}-${Date.now().toString(36)}`,
    type,
    projectId,
    status: "running",
    startedAt: new Date().toISOString(),
    message,
    current: 0,
    total: 0,
    log: [`[${new Date().toISOString()}] Job started: ${message}`],
  };

  fs.writeFileSync(jobPath(projectId), JSON.stringify(job, null, 2), "utf-8");
  return job;
}

/** Mark job as completed */
export function completeJob(
  projectId: string,
  result: Record<string, unknown>,
  message: string
): void {
  updateJob(projectId, {
    status: "completed",
    completedAt: new Date().toISOString(),
    message,
    result,
  });
}

/** Mark job as failed */
export function failJob(projectId: string, error: string): void {
  updateJob(projectId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    message: `Failed: ${error}`,
    error,
  });
}

/** Add a log line and optionally update progress */
export function logJob(
  projectId: string,
  message: string,
  current?: number,
  total?: number
): void {
  const job = getJobStatus(projectId);
  if (!job) return;
  const log = [...job.log, `[${new Date().toISOString()}] ${message}`];
  // Keep last 100 log lines to prevent file bloat
  if (log.length > 100) log.splice(0, log.length - 100);
  const update: Partial<JobProgress> = { log, message };
  if (current !== undefined) update.current = current;
  if (total !== undefined) update.total = total;
  updateJob(projectId, update);
}

/** Clear completed/failed job status */
export function clearJob(projectId: string): void {
  try {
    fs.unlinkSync(jobPath(projectId));
  } catch { /* ignore */ }
}
