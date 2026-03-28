/**
 * 2Captcha integration for solving CAPTCHAs during directory submission.
 *
 * Supports:
 * - reCAPTCHA v2 (sitekey-based)
 * - hCaptcha (sitekey-based)
 * - Image CAPTCHAs (base64-based)
 *
 * Flow:
 * 1. Detect CAPTCHA type from page HTML
 * 2. Send solve request to 2Captcha API
 * 3. Poll for result (they use human solvers, takes 10-60s)
 * 4. Return the token/answer to inject into the form
 */

const TWOCAPTCHA_API = "https://2captcha.com";

export interface CaptchaDetection {
  type: "recaptcha-v2" | "hcaptcha" | "image" | "none";
  siteKey?: string;
  imageBase64?: string;
  /** The input field name for image captchas */
  inputName?: string;
}

export interface CaptchaSolution {
  solved: boolean;
  token?: string;        // For reCAPTCHA/hCaptcha — the g-recaptcha-response token
  text?: string;         // For image captchas — the text answer
  inputName?: string;    // The form field name to inject the answer into
  error?: string;
}

/**
 * Detect what type of CAPTCHA is on the page.
 */
export function detectCaptcha(html: string, $: cheerio.CheerioAPI): CaptchaDetection {
  // reCAPTCHA v2
  const recaptchaEl = $(".g-recaptcha, [data-sitekey]").first();
  if (recaptchaEl.length) {
    const siteKey = recaptchaEl.attr("data-sitekey") || "";
    if (siteKey) {
      return { type: "recaptcha-v2", siteKey };
    }
  }

  // Check for reCAPTCHA in script tags
  const recaptchaScriptMatch = html.match(/grecaptcha\.render\s*\([^,]+,\s*\{\s*["']sitekey["']\s*:\s*["']([^"']+)["']/);
  if (recaptchaScriptMatch) {
    return { type: "recaptcha-v2", siteKey: recaptchaScriptMatch[1] };
  }

  // Another common pattern: var sitekey or data-sitekey in script
  const siteKeyMatch = html.match(/['"]sitekey['"]\s*[:=]\s*['"]([0-9A-Za-z_-]{40})['"]/) ||
    html.match(/data-sitekey=["']([0-9A-Za-z_-]{40})["']/);
  if (siteKeyMatch && (html.includes("g-recaptcha") || html.includes("recaptcha"))) {
    return { type: "recaptcha-v2", siteKey: siteKeyMatch[1] };
  }

  // hCaptcha
  const hcaptchaEl = $(".h-captcha, [data-hcaptcha-sitekey]").first();
  if (hcaptchaEl.length) {
    const siteKey = hcaptchaEl.attr("data-sitekey") || hcaptchaEl.attr("data-hcaptcha-sitekey") || "";
    if (siteKey) {
      return { type: "hcaptcha", siteKey };
    }
  }

  if (html.includes("hcaptcha.com") || html.includes("h-captcha")) {
    const hcSiteKey = html.match(/data-sitekey=["']([0-9a-f-]{36,})["']/) ||
      html.match(/sitekey['"]\s*:\s*['"]([0-9a-f-]{36,})['"]/);
    if (hcSiteKey) {
      return { type: "hcaptcha", siteKey: hcSiteKey[1] };
    }
  }

  // Image CAPTCHA
  const captchaImg = $('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]').first();
  if (captchaImg.length) {
    const inputField = $('input[name*="captcha"], input[name*="security"], input[name*="verify"]').first();
    return {
      type: "image",
      inputName: inputField.attr("name") || "captcha",
    };
  }

  // Check for captcha input without image (some use CSS background)
  const captchaInput = $('input[name*="captcha"]').first();
  if (captchaInput.length) {
    return {
      type: "image",
      inputName: captchaInput.attr("name") || "captcha",
    };
  }

  return { type: "none" };
}

/**
 * Solve a CAPTCHA using 2Captcha API.
 */
export async function solveCaptcha(
  apiKey: string,
  detection: CaptchaDetection,
  pageUrl: string,
  /** For image captchas, pass the base64 image data */
  imageBase64?: string,
): Promise<CaptchaSolution> {
  if (!apiKey) {
    return { solved: false, error: "No 2Captcha API key configured" };
  }

  if (detection.type === "none") {
    return { solved: false, error: "No CAPTCHA detected" };
  }

  try {
    let taskId: string;

    if (detection.type === "recaptcha-v2") {
      // Submit reCAPTCHA v2 task
      const params = new URLSearchParams({
        key: apiKey,
        method: "userrecaptcha",
        googlekey: detection.siteKey || "",
        pageurl: pageUrl,
        json: "1",
      });
      const res = await fetch(`${TWOCAPTCHA_API}/in.php?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data.status !== 1) {
        return { solved: false, error: `2Captcha error: ${data.request || data.error_text || "unknown"}` };
      }
      taskId = data.request;
    } else if (detection.type === "hcaptcha") {
      // Submit hCaptcha task
      const params = new URLSearchParams({
        key: apiKey,
        method: "hcaptcha",
        sitekey: detection.siteKey || "",
        pageurl: pageUrl,
        json: "1",
      });
      const res = await fetch(`${TWOCAPTCHA_API}/in.php?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data.status !== 1) {
        return { solved: false, error: `2Captcha error: ${data.request || data.error_text || "unknown"}` };
      }
      taskId = data.request;
    } else if (detection.type === "image") {
      if (!imageBase64) {
        return { solved: false, error: "Image CAPTCHA detected but no image data available", inputName: detection.inputName };
      }
      // Submit image captcha
      const params = new URLSearchParams({
        key: apiKey,
        method: "base64",
        body: imageBase64,
        json: "1",
      });
      const res = await fetch(`${TWOCAPTCHA_API}/in.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data.status !== 1) {
        return { solved: false, error: `2Captcha error: ${data.request || data.error_text || "unknown"}` };
      }
      taskId = data.request;
    } else {
      return { solved: false, error: `Unsupported CAPTCHA type: ${detection.type}` };
    }

    // Poll for result — 2Captcha recommends first check after 20s, then every 5s
    await sleep(20000);

    for (let attempt = 0; attempt < 12; attempt++) {
      const params = new URLSearchParams({
        key: apiKey,
        action: "get",
        id: taskId,
        json: "1",
      });
      const res = await fetch(`${TWOCAPTCHA_API}/res.php?${params}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();

      if (data.status === 1) {
        // Solved!
        if (detection.type === "image") {
          return { solved: true, text: data.request, inputName: detection.inputName };
        }
        return { solved: true, token: data.request };
      }

      if (data.request === "CAPCHA_NOT_READY") {
        await sleep(5000);
        continue;
      }

      // Error
      return { solved: false, error: `2Captcha error: ${data.request || "unknown"}` };
    }

    return { solved: false, error: "CAPTCHA solving timed out (80s)" };
  } catch (err: unknown) {
    return {
      solved: false,
      error: err instanceof Error ? `CAPTCHA solver error: ${err.message}` : "Unknown solver error",
    };
  }
}

/**
 * Fetch a CAPTCHA image from a URL and return as base64.
 */
export async function fetchCaptchaImage(
  imageUrl: string,
  headers?: Record<string, string>,
  cookies?: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        ...(headers || {}),
        ...(cookies ? { Cookie: cookies } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Re-export cheerio type for the detectCaptcha function
import type * as cheerio from "cheerio";
