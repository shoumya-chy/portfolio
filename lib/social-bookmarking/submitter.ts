import type { BookmarkPost, BookmarkPlatform, BookmarkSubmission, BookmarkJob } from "./types";
import { saveSubmission, saveSubmissionsBatch, saveJob, getJob, getSettings, listSubmissions } from "./storage";
import platforms from "./platforms";
import * as cheerio from "cheerio";
import { detectCaptcha, solveCaptcha, fetchCaptchaImage } from "../directory-submitter/captcha-solver";

function generateId(): string {
  return `bsub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
 * Build form data to submit a bookmark.
 */
function buildFormData(post: BookmarkPost): Record<string, string> {
  return {
    url: post.url,
    link: post.url,
    website: post.url,
    site_url: post.url,
    bookmark_url: post.url,
    title: post.title,
    name: post.title,
    bookmark_title: post.title,
    description: post.description,
    summary: post.description,
    notes: post.description,
    comment: post.description,
    tags: post.tags.join(", "),
    keywords: post.tags.join(", "),
    category: post.tags[0] || "General",
  };
}

/**
 * Submit a single post to a single platform.
 */
async function submitToPlatform(
  post: BookmarkPost,
  platform: BookmarkPlatform,
): Promise<BookmarkSubmission> {
  const record: BookmarkSubmission = {
    id: generateId(),
    postId: post.id,
    platformId: platform.id,
    siteId: post.siteId,
    status: "submitting",
    retryCount: 0,
  };

  // Skip platforms that require account creation (manual step)
  if (platform.requiresAccount && platform.method === "manual") {
    record.status = "skipped";
    record.errorMessage = `${platform.name} requires manual submission (account-based platform)`;
    record.attemptedAt = new Date().toISOString();
    return record;
  }

  try {
    // Step 1: Fetch the submission page
    const pageRes = await fetch(platform.submitUrl, {
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
        record.errorMessage = "Platform requires CAPTCHA — enable solving in settings";
        record.attemptedAt = new Date().toISOString();
        return record;
      }

      let imageBase64: string | undefined;
      if (captchaDetection.type === "image") {
        const captchaImg = $('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]').first();
        let imgSrc = captchaImg.attr("src") || "";
        if (imgSrc && !imgSrc.startsWith("http")) {
          const urlObj = new URL(platform.submitUrl);
          imgSrc = imgSrc.startsWith("/") ? `${urlObj.origin}${imgSrc}` : `${urlObj.origin}/${imgSrc}`;
        }
        if (imgSrc) {
          imageBase64 = (await fetchCaptchaImage(imgSrc, BROWSER_HEADERS, cookieStr)) || undefined;
        }
      }

      const solution = await solveCaptcha(
        settings.twoCaptchaApiKey,
        captchaDetection,
        platform.submitUrl,
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

    // Find submission form
    let form = $("form")
      .filter((_, el) => {
        const fh = $(el).html()?.toLowerCase() || "";
        return fh.includes("url") || fh.includes("link") || fh.includes("bookmark") || fh.includes("submit");
      })
      .first();
    if (!form.length) form = $("form").first();

    if (!form.length) {
      // Some platforms use URL-based submission
      if (platform.submitUrl.includes("submit") || platform.submitUrl.includes("post")) {
        record.status = "skipped";
        record.errorMessage = "No submission form found (may require account login)";
      } else {
        record.status = "skipped";
        record.errorMessage = "No submission form found on page";
      }
      record.attemptedAt = new Date().toISOString();
      return record;
    }

    // Extract form action
    let actionUrl = form.attr("action") || platform.submitUrl;
    if (actionUrl === "#" || actionUrl === "") actionUrl = platform.submitUrl;
    if (actionUrl.startsWith("/")) {
      const urlObj = new URL(platform.submitUrl);
      actionUrl = `${urlObj.origin}${actionUrl}`;
    } else if (!actionUrl.startsWith("http")) {
      const urlObj = new URL(platform.submitUrl);
      const basePath = urlObj.pathname.replace(/\/[^/]*$/, "/");
      actionUrl = `${urlObj.origin}${basePath}${actionUrl}`;
    }

    // Build form data
    const formData = new URLSearchParams();

    // Hidden inputs
    form.find("input[type=hidden]").each((_, el) => {
      const n = $(el).attr("name");
      const v = $(el).attr("value") || "";
      if (n) formData.set(n, v);
    });

    // Submit buttons
    form.find("input[type=submit]").each((_, el) => {
      const n = $(el).attr("name");
      const v = $(el).attr("value") || "Submit";
      if (n) formData.set(n, v);
    });

    // Map post data to form fields
    const postData = buildFormData(post);

    form
      .find("input[type=text], input[type=email], input[type=url], input:not([type]), textarea, select")
      .each((_, el) => {
        const n = $(el).attr("name");
        if (!n) return;
        const nl = n.toLowerCase();

        if (postData[nl]) {
          formData.set(n, postData[nl]);
          return;
        }

        // Fuzzy matching
        if (nl.includes("url") || nl.includes("link") || nl.includes("website") || nl.includes("href") || nl.includes("bookmark_url")) {
          formData.set(n, post.url);
        } else if (nl.includes("title") || nl.includes("name") || nl.includes("subject") || nl.includes("headline")) {
          formData.set(n, post.title);
        } else if (nl.includes("desc") || nl.includes("about") || nl.includes("summary") || nl.includes("comment") || nl.includes("note") || nl.includes("body") || nl.includes("content")) {
          formData.set(n, post.description);
        } else if (nl.includes("tag") || nl.includes("keyword") || nl.includes("label")) {
          formData.set(n, post.tags.join(", "));
        } else if (nl.includes("categ") || nl.includes("topic")) {
          formData.set(n, post.tags[0] || "General");
        } else if (nl.includes("email") || nl.includes("mail")) {
          // Use site email if available — fetched from parent
          formData.set(n, "");
        }
      });

    // Inject CAPTCHA solution
    if (captchaToken) {
      formData.set("g-recaptcha-response", captchaToken);
      if (captchaDetection.type === "hcaptcha") {
        formData.set("h-captcha-response", captchaToken);
      }
    }
    if (captchaText && captchaInputName) {
      formData.set(captchaInputName, captchaText);
    }

    // Submit
    const method = (form.attr("method") || "POST").toUpperCase();

    let submitRes: Response;
    if (method === "GET") {
      const submitUrl = new URL(actionUrl);
      formData.forEach((v, k) => submitUrl.searchParams.set(k, v));
      submitRes = await fetch(submitUrl.toString(), {
        method: "GET",
        headers: { ...BROWSER_HEADERS, Referer: platform.submitUrl, ...(cookieStr ? { Cookie: cookieStr } : {}) },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
    } else {
      submitRes = await fetch(actionUrl, {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: platform.submitUrl,
          Origin: new URL(platform.submitUrl).origin,
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

    const responseText = await submitRes.text();
    const responseLower = responseText.toLowerCase();

    const successIndicators = [
      "thank you", "thanks for", "successfully", "submission received",
      "has been added", "under review", "pending approval", "bookmark saved",
      "bookmark added", "submitted successfully", "has been submitted",
      "we have received", "link has been added", "added to", "queued",
    ];

    const failureIndicators = [
      "already exists", "duplicate", "already listed", "already submitted",
      "banned", "blacklisted", "spam", "error occurred", "submission failed",
      "not accepted", "rejected", "login required", "sign in",
    ];

    const isSuccess = successIndicators.some((i) => responseLower.includes(i));
    const isFailure = failureIndicators.some((i) => responseLower.includes(i));

    if (isSuccess) {
      record.status = "submitted";
      record.notes = "Bookmark submitted successfully";
    } else if (isFailure) {
      const matched = failureIndicators.find((i) => responseLower.includes(i));
      if (matched === "login required" || matched === "sign in") {
        record.status = "skipped";
        record.errorMessage = "Platform requires login — manual submission needed";
      } else {
        record.status = "failed";
        record.errorMessage = `Platform response: "${matched}"`;
      }
    } else if (submitRes.ok || submitRes.status === 302 || submitRes.status === 301) {
      record.status = "submitted";
      record.notes = "Form posted (no explicit confirmation detected)";
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
        record.errorMessage = "Platform unreachable (DNS/network error)";
      } else if (err.message.includes("certificate") || err.message.includes("SSL")) {
        record.errorMessage = "SSL certificate error";
      } else {
        record.errorMessage = err.message.substring(0, 200);
      }
    } else {
      record.errorMessage = "Unknown error";
    }
  }

  return record;
}

/**
 * Run the full bookmarking pipeline.
 * For each selected post, submits to all active platforms.
 */
export async function runBookmarkPipeline(
  posts: BookmarkPost[],
  siteId: string,
  mode: "new" | "retry-failed" | "retry-skipped" | "retry-both" = "new",
): Promise<void> {
  const activePlatforms = platforms.filter(
    (p) => p.active && p.method === "form-post",
  );
  const settings = getSettings();
  const existingSubs = listSubmissions(siteId);

  // Build set of already-submitted combos (postId:platformId)
  const alreadyDone = new Set<string>();
  for (const sub of existingSubs) {
    if (mode === "new" && sub.status !== "pending") {
      alreadyDone.add(`${sub.postId}:${sub.platformId}`);
    } else if (mode === "retry-failed" && sub.status !== "failed") {
      alreadyDone.add(`${sub.postId}:${sub.platformId}`);
    } else if (mode === "retry-skipped" && sub.status !== "skipped") {
      alreadyDone.add(`${sub.postId}:${sub.platformId}`);
    } else if (mode === "retry-both" && sub.status !== "failed" && sub.status !== "skipped") {
      alreadyDone.add(`${sub.postId}:${sub.platformId}`);
    }
  }

  // Build work items
  const workItems: Array<{ post: BookmarkPost; platform: BookmarkPlatform }> = [];
  for (const post of posts) {
    for (const platform of activePlatforms) {
      const key = `${post.id}:${platform.id}`;
      if (!alreadyDone.has(key)) {
        workItems.push({ post, platform });
      }
    }
  }

  const job: BookmarkJob = getJob() || {
    jobId: `bjob_${Date.now()}`,
    siteId,
    status: "running",
    totalPlatforms: activePlatforms.length,
    totalPosts: posts.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    log: [],
  };

  job.status = "running";
  job.log.push(`Submitting ${posts.length} post(s) to ${activePlatforms.length} platforms (${workItems.length} tasks)`);
  saveJob(job);

  if (workItems.length === 0) {
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.log.push("All posts already submitted to all platforms.");
    saveJob(job);
    return;
  }

  // Clean old submissions for retry modes
  if (mode !== "new") {
    const statusesToRetry: string[] = [];
    if (mode === "retry-failed" || mode === "retry-both") statusesToRetry.push("failed");
    if (mode === "retry-skipped" || mode === "retry-both") statusesToRetry.push("skipped");

    const allSubs = listSubmissions();
    const cleaned = allSubs.filter(
      (s) => !(s.siteId === siteId && statusesToRetry.includes(s.status)),
    );
    saveSubmissionsBatch(cleaned);
  }

  for (const { post, platform } of workItems) {
    const currentJob = getJob();
    if (currentJob?.status === "cancelled") {
      job.status = "cancelled";
      job.log.push("Job cancelled by user");
      saveJob(job);
      return;
    }

    job.log.push(`Submitting "${post.title.substring(0, 40)}" to ${platform.name}...`);
    saveJob(job);

    const record = await submitToPlatform(post, platform);
    record.siteId = siteId;
    saveSubmission(record);

    job.processed++;
    if (record.status === "submitted") {
      job.succeeded++;
      job.log.push(`✓ ${platform.name}: submitted`);
    } else if (record.status === "skipped") {
      job.skipped++;
      job.log.push(`⊘ ${platform.name}: ${record.errorMessage}`);
    } else {
      job.failed++;
      job.log.push(`✗ ${platform.name}: ${record.errorMessage}`);
    }

    saveJob(job);

    // Delay between submissions
    const delay = settings.delayBetweenMs || 3000;
    await new Promise((r) => setTimeout(r, delay + Math.random() * 2000));
  }

  job.status = "completed";
  job.completedAt = new Date().toISOString();
  job.log.push(`Done. Submitted: ${job.succeeded}, Failed: ${job.failed}, Skipped: ${job.skipped}`);
  saveJob(job);
}
