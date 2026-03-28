import type { SiteToSubmit, DirectoryInfo, SubmissionRecord, SubmissionJob } from "./types";
import { saveSubmission, saveJob, getJob } from "./storage";
import directories from "./directories";
import * as cheerio from "cheerio";

/**
 * Main submission engine.
 * Iterates through each active directory and attempts to submit the site.
 * Uses HTTP requests to POST form data. Skips directories with captchas.
 */

function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build common form data from site info.
 * Directories have varied field names but these cover most cases.
 */
function buildFormData(site: SiteToSubmit, dir: DirectoryInfo): Record<string, string> {
  const base: Record<string, string> = {
    // Common field names used by most directories
    url: site.url,
    site_url: site.url,
    website: site.url,
    link: site.url,
    title: site.name,
    site_title: site.name,
    name: site.name,
    description: site.description,
    site_description: site.description,
    short_description: site.description,
    long_description: site.longDescription || site.description,
    category: site.category,
    keywords: site.keywords.join(", "),
    tags: site.keywords.join(", "),
    email: site.contactEmail,
    contact_email: site.contactEmail,
    owner_email: site.contactEmail,
    contact_name: site.contactName,
    owner_name: site.contactName,
    language: site.language || "English",
  };

  // Add optional fields if present
  if (site.contactPhone) {
    base.phone = site.contactPhone;
    base.contact_phone = site.contactPhone;
  }
  if (site.address) {
    base.address = site.address;
  }
  if (site.city) {
    base.city = site.city;
  }
  if (site.state) {
    base.state = site.state;
  }
  if (site.country) {
    base.country = site.country;
  }
  if (site.reciprocalUrl) {
    base.reciprocal_url = site.reciprocalUrl;
    base.reciprocal = site.reciprocalUrl;
  }

  // Apply directory-specific field overrides
  if (dir.fields) {
    for (const [formField, siteField] of Object.entries(dir.fields)) {
      if (base[siteField]) {
        base[formField] = base[siteField];
      }
    }
  }

  return base;
}

/**
 * Attempt to submit to a single directory via HTTP POST.
 * Returns the submission record with status.
 */
async function submitToDirectory(
  site: SiteToSubmit,
  dir: DirectoryInfo,
): Promise<SubmissionRecord> {
  const record: SubmissionRecord = {
    id: generateId(),
    siteId: site.id,
    directoryId: dir.id,
    status: "submitting",
    retryCount: 0,
  };

  try {
    // First, fetch the submission page to detect forms and CSRF tokens
    const pageRes = await fetch(dir.submitUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!pageRes.ok) {
      record.status = "failed";
      record.errorMessage = `Could not load submission page: HTTP ${pageRes.status}`;
      record.responseCode = pageRes.status;
      record.attemptedAt = new Date().toISOString();
      return record;
    }

    const html = await pageRes.text();
    const $ = cheerio.load(html);

    // Detect captcha — skip if found
    const hasCaptcha =
      html.includes("g-recaptcha") ||
      html.includes("hcaptcha") ||
      html.includes("captcha") ||
      $('img[src*="captcha"]').length > 0 ||
      $('input[name*="captcha"]').length > 0;

    if (hasCaptcha) {
      record.status = "skipped";
      record.errorMessage = "Directory requires CAPTCHA — cannot auto-submit";
      record.attemptedAt = new Date().toISOString();
      return record;
    }

    // Find the main form
    const form = $("form").first();
    if (!form.length) {
      // No form found — some directories may need account creation
      record.status = "skipped";
      record.errorMessage = "No submission form found on page (may require account creation)";
      record.attemptedAt = new Date().toISOString();
      return record;
    }

    // Extract form action URL
    let actionUrl = form.attr("action") || dir.submitUrl;
    if (actionUrl.startsWith("/")) {
      const urlObj = new URL(dir.submitUrl);
      actionUrl = `${urlObj.origin}${actionUrl}`;
    } else if (!actionUrl.startsWith("http")) {
      const urlObj = new URL(dir.submitUrl);
      actionUrl = `${urlObj.origin}/${actionUrl}`;
    }

    // Build form data — start with hidden inputs from the form
    const formData = new URLSearchParams();
    form.find("input[type=hidden]").each((_, el) => {
      const n = $(el).attr("name");
      const v = $(el).attr("value") || "";
      if (n) formData.set(n, v);
    });

    // Map site data to form fields
    const siteData = buildFormData(site, dir);

    // Detect form fields and fill them in
    form.find("input[type=text], input[type=email], input[type=url], textarea, select").each((_, el) => {
      const n = $(el).attr("name");
      if (!n) return;
      const nl = n.toLowerCase();

      // Try direct match
      if (siteData[nl]) {
        formData.set(n, siteData[nl]);
        return;
      }

      // Fuzzy match on common patterns
      if (nl.includes("url") || nl.includes("link") || nl.includes("website") || nl.includes("site_url")) {
        formData.set(n, site.url);
      } else if (nl.includes("title") || nl.includes("name") || nl.includes("site_name")) {
        formData.set(n, site.name);
      } else if (nl.includes("desc") || nl.includes("about")) {
        formData.set(n, site.description);
      } else if (nl.includes("email") || nl.includes("mail")) {
        formData.set(n, site.contactEmail);
      } else if (nl.includes("categ") || nl.includes("topic")) {
        formData.set(n, site.category);
      } else if (nl.includes("keyword") || nl.includes("tag")) {
        formData.set(n, site.keywords.join(", "));
      } else if (nl.includes("phone") || nl.includes("tel")) {
        formData.set(n, site.contactPhone || "");
      } else if (nl.includes("owner") || nl.includes("contact") || nl.includes("author")) {
        formData.set(n, site.contactName);
      } else if (nl.includes("city")) {
        formData.set(n, site.city || "");
      } else if (nl.includes("state") || nl.includes("province") || nl.includes("region")) {
        formData.set(n, site.state || "");
      } else if (nl.includes("country")) {
        formData.set(n, site.country || "");
      } else if (nl.includes("address")) {
        formData.set(n, site.address || "");
      } else if (nl.includes("lang")) {
        formData.set(n, site.language || "English");
      }
    });

    // Submit the form
    const method = (form.attr("method") || "POST").toUpperCase();
    const submitRes = await fetch(actionUrl, {
      method: method === "GET" ? "GET" : "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: dir.submitUrl,
      },
      body: formData.toString(),
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    record.responseCode = submitRes.status;
    record.attemptedAt = new Date().toISOString();

    // Check response for success indicators
    const responseText = await submitRes.text();
    const responseLower = responseText.toLowerCase();

    const successIndicators = [
      "thank you",
      "thanks for",
      "successfully submitted",
      "submission received",
      "has been added",
      "under review",
      "will be reviewed",
      "pending approval",
      "successfully added",
      "listing submitted",
      "thank you for submitting",
    ];

    const failureIndicators = [
      "already exists",
      "duplicate",
      "already listed",
      "url already",
      "already submitted",
      "banned",
      "blacklisted",
      "spam",
      "error occurred",
      "submission failed",
    ];

    const isSuccess = successIndicators.some((i) => responseLower.includes(i));
    const isFailure = failureIndicators.some((i) => responseLower.includes(i));

    if (isSuccess) {
      record.status = "submitted";
      record.notes = "Form submitted successfully — awaiting review";
    } else if (isFailure) {
      record.status = "failed";
      const matched = failureIndicators.find((i) => responseLower.includes(i));
      record.errorMessage = `Directory response indicates failure: "${matched}"`;
    } else if (submitRes.ok || submitRes.status === 302 || submitRes.status === 301) {
      // Redirect or OK without clear indicators — assume submitted
      record.status = "submitted";
      record.notes = "Form posted successfully (no explicit confirmation detected)";
    } else {
      record.status = "failed";
      record.errorMessage = `HTTP ${submitRes.status} response`;
    }
  } catch (err: unknown) {
    record.status = "failed";
    record.attemptedAt = new Date().toISOString();
    if (err instanceof Error) {
      if (err.name === "TimeoutError" || err.message.includes("timeout")) {
        record.errorMessage = "Request timed out (15s)";
      } else {
        record.errorMessage = err.message.substring(0, 200);
      }
    } else {
      record.errorMessage = "Unknown error during submission";
    }
  }

  return record;
}

/**
 * Run the full submission pipeline for a site.
 * Submits to all active directories that haven't been submitted to yet.
 * Updates job progress as it goes.
 */
export async function runSubmissionPipeline(
  site: SiteToSubmit,
  existingSubmissions: SubmissionRecord[],
): Promise<void> {
  const activeDirectories = directories.filter((d) => d.active);
  const alreadySubmitted = new Set(existingSubmissions.map((s) => s.directoryId));
  const toSubmit = activeDirectories.filter((d) => !alreadySubmitted.has(d.id));

  if (toSubmit.length === 0) {
    // Update job as completed with nothing to do
    const job = getJob();
    if (job) {
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.log.push("All directories already submitted to.");
      saveJob(job);
    }
    return;
  }

  // Initialize or update job
  const job: SubmissionJob = getJob() || {
    jobId: `job_${Date.now()}`,
    siteId: site.id,
    status: "running",
    totalDirectories: toSubmit.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    log: [],
  };

  job.status = "running";
  job.totalDirectories = toSubmit.length;
  job.log.push(`Starting submissions for "${site.name}" to ${toSubmit.length} directories`);
  saveJob(job);

  for (const dir of toSubmit) {
    // Check if job was cancelled
    const currentJob = getJob();
    if (currentJob?.status === "cancelled") {
      job.status = "cancelled";
      job.log.push("Job cancelled by user");
      saveJob(job);
      return;
    }

    job.log.push(`Submitting to ${dir.name}...`);
    saveJob(job);

    const record = await submitToDirectory(site, dir);
    saveSubmission(record);

    job.processed++;
    if (record.status === "submitted") {
      job.succeeded++;
      job.log.push(`✓ ${dir.name}: submitted`);
    } else if (record.status === "skipped") {
      job.skipped++;
      job.log.push(`⊘ ${dir.name}: skipped — ${record.errorMessage}`);
    } else {
      job.failed++;
      job.log.push(`✗ ${dir.name}: failed — ${record.errorMessage}`);
    }

    saveJob(job);

    // Small delay between submissions (1-3 seconds) to be polite
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
  }

  job.status = "completed";
  job.completedAt = new Date().toISOString();
  job.log.push(
    `Done. Submitted: ${job.succeeded}, Failed: ${job.failed}, Skipped: ${job.skipped}`,
  );
  saveJob(job);
}
