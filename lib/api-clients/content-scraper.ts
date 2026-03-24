import * as cheerio from "cheerio";

export interface ScrapedContent {
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  wordCount: number;
  sampleParagraphs: string[];
}

/**
 * Scrape and extract information from a prospect's write-for-us page.
 * Returns niche detection, guidelines, and contact email.
 */
export interface ProspectScrapeResult {
  contactEmail: string | null;
  siteNiche: string;
  guidelinesSnippet: string;
  siteTitle: string;
  categories: string[];
}

export async function scrapePageContent(url: string): Promise<ScrapedContent> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer
  $("script, style, nav, footer, header, aside, .sidebar, .ad, .advertisement").remove();

  const title = $("title").text().trim() || $("h1").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") || "";

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 200) headings.push(text);
  });

  const bodyText = $("article, .content, .post-content, .entry-content, main, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const sampleParagraphs: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50 && text.length < 1000 && sampleParagraphs.length < 5) {
      sampleParagraphs.push(text);
    }
  });

  const wordCount = bodyText.split(/\s+/).length;

  return { title, metaDescription, headings, bodyText: bodyText.slice(0, 5000), wordCount, sampleParagraphs };
}

// ============ JUNK EMAIL PATTERNS ============

const JUNK_EMAIL_PREFIXES = [
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
  "mailer-daemon", "postmaster", "bounce", "abuse", "spam",
  "unsubscribe", "newsletter", "notifications", "alerts", "system",
  "root", "daemon", "null", "devnull", "auto", "automated",
  "billing", "invoice", "receipt", "order", "tracking",
  "privacy", "legal", "compliance", "security", "verify",
  "test", "demo", "example", "sample", "placeholder",
];

const JUNK_EMAIL_DOMAINS = [
  "example.com", "example.org", "test.com", "localhost",
  "wixpress.com", "wordpress.com", "wordpress.org", "sentry.io",
  "w3.org", "schema.org", "gravatar.com", "googleapis.com",
  "cloudflare.com", "jsdelivr.net", "bootstrapcdn.com",
  "facebook.com", "twitter.com", "google.com", "amazon.com",
];

/** Preferred email prefixes that indicate the right contact person */
const PREFERRED_PREFIXES = [
  "editor", "editorial", "guest", "guestpost", "submissions",
  "submit", "contribute", "contributor", "content", "blog",
  "write", "writer", "pitch", "outreach", "partnership",
  "collaborat", "hello", "hi", "hey", "contact",
];

function scoreEmail(email: string): number {
  const lower = email.toLowerCase();
  const prefix = lower.split("@")[0];
  const domain = lower.split("@")[1] || "";

  // Reject junk
  if (JUNK_EMAIL_DOMAINS.some(d => domain.includes(d))) return -100;
  if (JUNK_EMAIL_PREFIXES.some(p => prefix === p || prefix.startsWith(p + "."))) return -100;

  // Reject image/file-like false positives
  if (lower.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|ttf)$/)) return -100;
  if (lower.includes("@2x") || lower.includes("@3x")) return -100;

  // Reject if domain part looks incomplete
  if (!domain.includes(".") || domain.length < 4) return -100;

  let score = 0;

  // Boost preferred prefixes
  if (PREFERRED_PREFIXES.some(p => prefix.includes(p))) score += 50;

  // Boost personal-looking emails (firstname, firstname.lastname)
  if (prefix.match(/^[a-z]{2,15}$/) || prefix.match(/^[a-z]+\.[a-z]+$/)) score += 30;

  // Penalize generic info@ and admin@ (better than noreply but not ideal)
  if (prefix === "info" || prefix === "admin" || prefix === "webmaster") score += 5;
  if (prefix === "support" || prefix === "help") score -= 10;

  // Boost if the email domain matches the site being scraped
  score += 10;

  return score;
}

function extractEmailsFromHtml(html: string): string[] {
  // Standard email regex
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];

  // Also extract from mailto: links specifically (these are intentional contact addresses)
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let mailtoMatch;
  const mailtoEmails: string[] = [];
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    mailtoEmails.push(mailtoMatch[1]);
  }

  // Dedupe, preferring mailto emails (these are deliberate contact addresses)
  const seen = new Set<string>();
  const all: { email: string; fromMailto: boolean }[] = [];

  for (const email of mailtoEmails) {
    const lower = email.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      all.push({ email: lower, fromMailto: true });
    }
  }
  for (const email of matches) {
    const lower = email.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      all.push({ email: lower, fromMailto: false });
    }
  }

  // Score and sort
  return all
    .map(({ email, fromMailto }) => ({
      email,
      score: scoreEmail(email) + (fromMailto ? 20 : 0),
    }))
    .filter(e => e.score > -100)
    .sort((a, b) => b.score - a.score)
    .map(e => e.email);
}

/**
 * Extract the best contact email from a prospect's site.
 * Checks: write-for-us page → contact page → about page.
 * Prioritizes editor/submissions emails over generic ones.
 */
export async function extractContactEmail(url: string): Promise<string | null> {
  const fetchPage = async (pageUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  try {
    // Phase 1: Check the write-for-us page itself (highest priority)
    const mainHtml = await fetchPage(url);
    if (mainHtml) {
      const emails = extractEmailsFromHtml(mainHtml);
      if (emails.length > 0) return emails[0];
    }

    // Phase 2: Check /contact and related pages
    const domain = new URL(url).origin;
    const contactPaths = [
      "/contact", "/contact-us", "/about", "/about-us",
      "/write-for-us", "/guest-post", "/contribute",
      "/submit-guest-post", "/guest-post-guidelines",
    ];

    for (const contactPath of contactPaths) {
      // Skip if it's the same as the main URL
      if (url.includes(contactPath)) continue;

      const html = await fetchPage(domain + contactPath);
      if (html) {
        const emails = extractEmailsFromHtml(html);
        if (emails.length > 0) return emails[0];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Scrape a prospect site to detect its niche, extract guidelines, and find categories.
 * Used during prospect finding to populate prospect metadata.
 */
export async function scrapeProspectMetadata(url: string): Promise<ProspectScrapeResult> {
  const result: ProspectScrapeResult = {
    contactEmail: null,
    siteNiche: "",
    guidelinesSnippet: "",
    siteTitle: "",
    categories: [],
  };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return result;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract site title
    result.siteTitle = $("title").text().trim().split("|")[0].split("-")[0].split("–")[0].trim();

    // Extract contact email from this page
    const emails = extractEmailsFromHtml(html);
    if (emails.length > 0) result.contactEmail = emails[0];

    // Extract categories from navigation, footer, or category links
    const categoryTexts = new Set<string>();
    $('a[href*="/category/"], a[href*="/topics/"], a[href*="/tag/"], nav a, .menu a, .nav a').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 2 && text.length < 40 && !text.match(/^(home|about|contact|write|guest|submit|login|sign|menu|search|privacy|terms)/i)) {
        categoryTexts.add(text);
      }
    });
    result.categories = Array.from(categoryTexts).slice(0, 15);

    // Detect niche from meta keywords, description, categories, and headings
    const metaKeywords = $('meta[name="keywords"]').attr("content") || "";
    const metaDesc = $('meta[name="description"]').attr("content") || "";
    const ogSiteName = $('meta[property="og:site_name"]').attr("content") || "";
    const h1Text = $("h1").first().text().trim();

    // Combine signals for niche detection
    const nicheSignals = [metaKeywords, metaDesc, result.categories.join(" "), h1Text, ogSiteName].join(" ").toLowerCase();

    // Simple niche extraction from dominant themes
    const nichePatterns: [RegExp, string][] = [
      [/\b(digital marketing|seo|content marketing|social media marketing|ppc|sem)\b/i, "Digital Marketing"],
      [/\b(web develop|software|programming|coding|devops|saas|tech)\b/i, "Technology"],
      [/\b(health|fitness|wellness|nutrition|medical|healthcare)\b/i, "Health & Wellness"],
      [/\b(finance|invest|money|banking|crypto|fintech|trading)\b/i, "Finance"],
      [/\b(travel|tourism|hotel|destination|backpack)\b/i, "Travel"],
      [/\b(food|cook|recipe|restaurant|cuisine|kitchen)\b/i, "Food & Cooking"],
      [/\b(fashion|style|beauty|makeup|skincare|cosmetic)\b/i, "Fashion & Beauty"],
      [/\b(education|learn|teach|school|university|student|course)\b/i, "Education"],
      [/\b(real estate|property|home|house|mortgage|rental)\b/i, "Real Estate"],
      [/\b(ecommerce|e-commerce|shopify|woocommerce|online store|retail)\b/i, "Ecommerce"],
      [/\b(business|entrepreneur|startup|small business|management)\b/i, "Business"],
      [/\b(lifestyle|personal development|self-help|productivity|motivation)\b/i, "Lifestyle"],
      [/\b(gaming|game|esports|playstation|xbox|nintendo)\b/i, "Gaming"],
      [/\b(environment|sustainability|green|eco|climate|renewable)\b/i, "Environment"],
      [/\b(legal|law|attorney|lawyer|court)\b/i, "Legal"],
      [/\b(auto|car|vehicle|motor|driving|electric vehicle)\b/i, "Automotive"],
      [/\b(pet|dog|cat|animal|veterinary)\b/i, "Pets & Animals"],
      [/\b(parenting|baby|child|family|mom|dad|kid)\b/i, "Parenting & Family"],
      [/\b(sport|football|basketball|soccer|baseball|cricket)\b/i, "Sports"],
      [/\b(design|graphic|ui|ux|creative|illustration)\b/i, "Design"],
      [/\b(cyber|security|privacy|hacking|infosec)\b/i, "Cybersecurity"],
      [/\b(ai|artificial intelligence|machine learning|data science|deep learning)\b/i, "AI & Data Science"],
      [/\b(hr|human resource|hiring|recruit|talent|employ)\b/i, "HR & Recruitment"],
      [/\b(marketing|brand|advertising|growth|acquisition)\b/i, "Marketing"],
    ];

    for (const [pattern, niche] of nichePatterns) {
      if (pattern.test(nicheSignals)) {
        result.siteNiche = niche;
        break;
      }
    }

    // If no pattern matched, use categories as fallback
    if (!result.siteNiche && result.categories.length > 0) {
      result.siteNiche = result.categories.slice(0, 3).join(", ");
    }

    // Extract guidelines from the page body
    $("script, style, nav, footer, header, aside").remove();
    const bodyText = $("article, .content, .post-content, .entry-content, main, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    // Look for guidelines-related content
    const guidelinesKeywords = [
      "word count", "words", "minimum", "maximum",
      "topics we cover", "topics we accept", "we publish",
      "formatting", "submit", "submission", "guidelines",
      "include a bio", "author bio", "byline",
      "original content", "not published", "unique",
      "images", "screenshots", "featured image",
      "links", "outbound links", "backlinks",
      "turnaround", "review", "editing",
    ];

    // Extract sentences containing guideline keywords
    const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const guidelineSentences: string[] = [];
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (guidelinesKeywords.some(kw => lower.includes(kw))) {
        guidelineSentences.push(sentence.trim());
        if (guidelineSentences.length >= 8) break;
      }
    }
    result.guidelinesSnippet = guidelineSentences.join(". ").slice(0, 1000);

    // If we didn't find email on the main page, try contact pages
    if (!result.contactEmail) {
      result.contactEmail = await extractContactEmail(url);
    }
  } catch {
    // Silent fail — we'll still have empty but valid result
  }

  return result;
}
