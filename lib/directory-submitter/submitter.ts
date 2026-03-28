import type { SiteToSubmit, DirectoryInfo, SubmissionRecord, SubmissionJob } from "./types";
import { saveSubmission, saveJob, getJob, getSettings } from "./storage";
import directories from "./directories";
import * as cheerio from "cheerio";
import { detectCaptcha, solveCaptcha, fetchCaptchaImage } from "./captcha-solver";

/**
 * Main submission engine.
 * Iterates through each active directory and attempts to submit the site.
 * Uses HTTP requests to POST form data. Skips directories with captchas.
 */

function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Common browser-like headers to avoid 403 blocks */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

/**
 * Build common form data from site info.
 * Directories have varied field names but these cover most cases.
 */
function buildFormData(site: SiteToSubmit, dir: DirectoryInfo): Record<string, string> {
  const base: Record<string, string> = {
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

  if (site.contactPhone) {
    base.phone = site.contactPhone;
    base.contact_phone = site.contactPhone;
  }
  if (site.address) base.address = site.address;
  if (site.city) base.city = site.city;
  if (site.state) base.state = site.state;
  if (site.country) base.country = site.country;
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
 * Attempt to submit to a single directory via HTTP.
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
    // Step 1: Fetch the submission page to detect forms and CSRF tokens
    const pageRes = await fetch(dir.submitUrl, {
      method: "GET",
      headers: { ...BROWSER_HEADERS },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    if (!pageRes.ok) {
      record.status = "failed";
      record.errorMessage = `Could not load submission page: HTTP ${pageRes.status}`;
      record.responseCode = pageRes.status;
      record.attemptedAt = new Date().toISOString();
      return record;
    }

    // Capture cookies from the response for the submit step
    const setCookies = pageRes.headers.getSetCookie?.() || [];
    const cookieStr = setCookies.map((c) => c.split(";")[0]).join("; ");

    const html = await pageRes.text();
    const $ = cheerio.load(html);

    // Detect CAPTCHA
    const captchaDetection = detectCaptcha(html, $);
    let captchaToken: string | undefined;
    let captchaText: string | undefined;
    let captchaInputName: string | undefined;

    if (captchaDetection.type !== "none") {
      const settings = getSettings();
      if (!settings.solveCaptchas || !settings.twoCaptchaApiKey) {
        record.status = "skipped";
        record.errorMessage = "Directory requires CAPTCHA — enable CAPTCHA solving in settings";
        record.attemptedAt = new Date().toISOString();
        return record;
      }

      // For image captchas, fetch the image first
      let imageBase64: string | undefined;
      if (captchaDetection.type === "image") {
        const captchaImg = $('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]').first();
        let imgSrc = captchaImg.attr("src") || "";
        if (imgSrc && !imgSrc.startsWith("http")) {
          const urlObj = new URL(dir.submitUrl);
          imgSrc = imgSrc.startsWith("/")
            ? `${urlObj.origin}${imgSrc}`
            : `${urlObj.origin}/${imgSrc}`;
        }
        if (imgSrc) {
          imageBase64 = await fetchCaptchaImage(imgSrc, BROWSER_HEADERS, cookieStr) || undefined;
        }
      }

      const solution = await solveCaptcha(
        settings.twoCaptchaApiKey,
        captchaDetection,
        dir.submitUrl,
        imageBase64,
      );

      if (!solution.solved) {
        record.status = "skipped";
        record.errorMessage = solution.error || "CAPTCHA solving failed";
        record.attemptedAt = new Date().toISOString();
        return record;
      }

      captchaToken = solution.token;
      captchaText = solution.text;
      captchaInputName = solution.inputName;
    }

    // Find the best submission form (prefer forms with URL/link fields)
    let form = $("form").filter((_, el) => {
      const formHtml = $(el).html()?.toLowerCase() || "";
      return (
        formHtml.includes("url") ||
        formHtml.includes("link") ||
        formHtml.includes("website") ||
        formHtml.includes("submit")
      );
    }).first();

    // Fallback to first form if no good match
    if (!form.length) form = $("form").first();

    if (!form.length) {
      record.status = "skipped";
      record.errorMessage = "No submission form found on page (may require account creation)";
      record.attemptedAt = new Date().toISOString();
      return record;
    }

    // Extract form action URL
    let actionUrl = form.attr("action") || dir.submitUrl;
    if (actionUrl === "#" || actionUrl === "") actionUrl = dir.submitUrl;
    if (actionUrl.startsWith("/")) {
      const urlObj = new URL(dir.submitUrl);
      actionUrl = `${urlObj.origin}${actionUrl}`;
    } else if (!actionUrl.startsWith("http")) {
      const urlObj = new URL(dir.submitUrl);
      const basePath = urlObj.pathname.replace(/\/[^/]*$/, "/");
      actionUrl = `${urlObj.origin}${basePath}${actionUrl}`;
    }

    // Build form data — start with hidden inputs from the form
    const formData = new URLSearchParams();
    form.find("input[type=hidden]").each((_, el) => {
      const n = $(el).attr("name");
      const v = $(el).attr("value") || "";
      if (n) formData.set(n, v);
    });

    // Also grab any submit button values (some forms require these)
    form.find("input[type=submit]").each((_, el) => {
      const n = $(el).attr("name");
      const v = $(el).attr("value") || "Submit";
      if (n) formData.set(n, v);
    });

    // Map site data to form fields
    const siteData = buildFormData(site, dir);

    // Detect form fields and fill them in
    form
      .find("input[type=text], input[type=email], input[type=url], input:not([type]), textarea, select")
      .each((_, el) => {
        const n = $(el).attr("name");
        if (!n) return;
        const nl = n.toLowerCase();

        // Try direct match first
        if (siteData[nl]) {
          formData.set(n, siteData[nl]);
          return;
        }

        // Fuzzy match on common patterns
        if (nl.includes("url") || nl.includes("link") || nl.includes("website") || nl.includes("site_url") || nl.includes("homepage")) {
          formData.set(n, site.url);
        } else if (nl.includes("title") || nl.includes("name") || nl.includes("site_name") || nl.includes("sitename")) {
          formData.set(n, site.name);
        } else if (nl.includes("desc") || nl.includes("about") || nl.includes("summary") || nl.includes("comment")) {
          formData.set(n, site.description);
        } else if (nl.includes("email") || nl.includes("mail")) {
          formData.set(n, site.contactEmail);
        } else if (nl.includes("categ") || nl.includes("topic") || nl.includes("niche") || nl.includes("industry")) {
          formData.set(n, site.category);
        } else if (nl.includes("keyword") || nl.includes("tag") || nl.includes("meta")) {
          formData.set(n, site.keywords.join(", "));
        } else if (nl.includes("phone") || nl.includes("tel") || nl.includes("mobile")) {
          formData.set(n, site.contactPhone || "");
        } else if (nl.includes("owner") || nl.includes("contact") || nl.includes("author") || nl.includes("webmaster") || nl.includes("your_name")) {
          formData.set(n, site.contactName);
        } else if (nl.includes("city") || nl.includes("town")) {
          formData.set(n, site.city || "");
        } else if (nl.includes("state") || nl.includes("province") || nl.includes("region")) {
          formData.set(n, site.state || "");
        } else if (nl.includes("country") || nl.includes("nation")) {
          formData.set(n, site.country || "");
        } else if (nl.includes("address") || nl.includes("street")) {
          formData.set(n, site.address || "");
        } else if (nl.includes("lang")) {
          formData.set(n, site.language || "English");
        } else if (nl.includes("reciproc") || nl.includes("backlink")) {
          formData.set(n, site.reciprocalUrl || site.url);
        }
      });

    // Inject CAPTCHA solution if we solved one
    if (captchaToken) {
      // reCAPTCHA v2 / hCaptcha — inject the token
      formData.set("g-recaptcha-response", captchaToken);
      if (captchaDetection.type === "hcaptcha") {
        formData.set("h-captcha-response", captchaToken);
      }
    }
    if (captchaText && captchaInputName) {
      // Image CAPTCHA — inject the text answer
      formData.set(captchaInputName, captchaText);
    }

    // Step 2: Submit the form
    const method = (form.attr("method") || "POST").toUpperCase();

    let submitRes: Response;
    if (method === "GET") {
      // For GET forms, append params to URL instead of body
      const submitUrl = new URL(actionUrl);
      formData.forEach((v, k) => submitUrl.searchParams.set(k, v));
      submitRes = await fetch(submitUrl.toString(), {
        method: "GET",
        headers: {
          ...BROWSER_HEADERS,
          Referer: dir.submitUrl,
          ...(cookieStr ? { Cookie: cookieStr } : {}),
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
    } else {
      submitRes = await fetch(actionUrl, {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: dir.submitUrl,
          Origin: new URL(dir.submitUrl).origin,
          "Sec-Fetch-Site": "same-origin",
          ...(cookieStr ? { Cookie: cookieStr } : {}),
        },
        body: formData.toString(),
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
    }

    record.responseCode = submitRes.status;
    record.attemptedAt = new Date().toISOString();

    // Check response for success/failure indicators
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
      "your site has been",
      "added to our directory",
      "submission complete",
      "has been submitted",
      "awaiting approval",
      "we have received",
      "submitted successfully",
      "your listing",
      "link has been added",
      "your website has been",
      "approval pending",
    ];

    const failureIndicators = [
      "already exists",
      "duplicate",
      "already listed",
      "url already",
      "already submitted",
      "banned",
      "blacklisted",
      "spam detected",
      "error occurred",
      "submission failed",
      "not accepted",
      "has been rejected",
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
      if (err.name === "TimeoutError" || err.name === "AbortError" || err.message.includes("timeout")) {
        record.errorMessage = "Request timed out (20s)";
      } else if (err.message.includes("fetch failed") || err.message.includes("ENOTFOUND")) {
        record.errorMessage = "Site unreachable (DNS/network error)";
      } else if (err.message.includes("certificate") || err.message.includes("SSL")) {
        record.errorMessage = "SSL certificate error";
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
    const job = getJob();
    if (job) {
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.log.push("All directories already submitted to.");
      saveJob(job);
    }
    return;
  }

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

    // Delay 1.5-3.5s between submissions to appear human-like
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
  }

  job.status = "completed";
  job.completedAt = new Date().toISOString();
  job.log.push(
    `Done. Submitted: ${job.succeeded}, Failed: ${job.failed}, Skipped: ${job.skipped}`,
  );
  saveJob(job);
}
