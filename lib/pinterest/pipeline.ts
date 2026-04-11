/**
 * Pinterest Auto-Pinner Pipeline.
 *
 * Steps:
 * 1. Fetch all posts from WordPress REST API
 * 2. Filter out already-pinned posts
 * 3. Score remaining posts by keyword search volume (DataForSEO)
 * 4. Claude selects top 10 and writes pin content + image prompts
 * 5. Generate Pinterest images via Stability AI
 * 6. Publish pins to Pinterest via API v5
 * 7. Log results
 */

import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import {
  getPinnedLog,
  addPinnedPost,
  logJob,
} from "@/lib/pinterest/storage";
import type {
  PinterestSite,
  PinCandidate,
  PinSelection,
  PinnedPost,
  PipelineResult,
} from "@/lib/pinterest/types";

// ============ Step 1: Fetch WordPress Posts ============

interface WPPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  link: string;
  categories: number[];
  tags: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _embedded?: { "wp:featuredmedia"?: any[]; "wp:term"?: any[][] };
}

async function fetchAllWPPosts(site: PinterestSite): Promise<PinCandidate[]> {
  const posts: PinCandidate[] = [];
  let page = 1;
  const perPage = 100;

  // Build auth header for WP REST API
  const auth = Buffer.from(`${site.wpUsername}:${site.wpAppPassword}`).toString("base64");

  while (true) {
    const url = `${site.wpBaseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=1&status=publish`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      // 400 = page out of range
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status} ${res.statusText}`);
    }

    const data: WPPost[] = await res.json();
    if (data.length === 0) break;

    for (const post of data) {
      const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
      const featuredImageUrl = featuredMedia?.source_url || featuredMedia?.media_details?.sizes?.full?.source_url || "";

      // Extract category and tag names from embedded terms
      const terms = post._embedded?.["wp:term"] || [];
      const categoryNames = (terms[0] || []).map((t: { name: string }) => t.name);
      const tagNames = (terms[1] || []).map((t: { name: string }) => t.name);

      // Clean excerpt (remove HTML tags)
      const excerpt = post.excerpt.rendered.replace(/<[^>]+>/g, "").trim();
      const title = post.title.rendered.replace(/&amp;/g, "&").replace(/&#8217;/g, "'").replace(/&#8211;/g, "–");

      // Extract primary keyword from slug
      const primaryKeyword = post.slug.replace(/-/g, " ");

      posts.push({
        postUrl: post.link,
        postTitle: title,
        excerpt,
        slug: post.slug,
        categories: categoryNames,
        tags: tagNames,
        featuredImageUrl,
        primaryKeyword,
        searchVolume: 0,
      });
    }

    // Check if there are more pages
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
    if (page >= totalPages) break;
    page++;
  }

  return posts;
}

// ============ Step 2: Filter pinned ============

function filterPinned(siteId: string, posts: PinCandidate[]): PinCandidate[] {
  const pinned = getPinnedLog(siteId);
  const pinnedUrls = new Set(pinned.filter(p => p.status === "pinned").map(p => p.postUrl));
  return posts.filter(p => !pinnedUrls.has(p.postUrl));
}

// ============ Step 3: Keyword scoring via DataForSEO ============

async function scoreBySearchVolume(
  posts: PinCandidate[],
  siteId: string
): Promise<PinCandidate[]> {
  const dfLogin = getApiKey("dataForSeoLogin");
  const dfPassword = getApiKey("dataForSeoPassword");

  if (!dfLogin || !dfPassword) {
    logJob(siteId, "No DataForSEO credentials — skipping keyword scoring");
    return posts;
  }

  const auth = Buffer.from(`${dfLogin}:${dfPassword}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };

  // Batch keywords (max 700 per request for DataForSEO)
  const keywords = posts.map(p => p.primaryKeyword);
  const batchSize = 100;
  const volumeMap = new Map<string, number>();

  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    try {
      const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
        method: "POST",
        headers,
        body: JSON.stringify([{
          keywords: batch,
          location_code: 2036, // Australia
          language_code: "en",
        }]),
      });

      if (!res.ok) {
        logJob(siteId, `DataForSEO batch ${Math.floor(i / batchSize) + 1} failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const results = data.tasks?.[0]?.result || [];
      for (const r of results) {
        if (r.keyword && r.search_volume) {
          volumeMap.set(r.keyword, r.search_volume);
        }
      }
    } catch (err) {
      logJob(siteId, `DataForSEO error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Assign volumes
  for (const post of posts) {
    post.searchVolume = volumeMap.get(post.primaryKeyword) || 0;
  }

  // Sort by search volume descending
  posts.sort((a, b) => b.searchVolume - a.searchVolume);
  return posts;
}

// ============ Step 4: Claude selects and writes pin content ============

async function selectPinsWithClaude(
  candidates: PinCandidate[],
  count: number,
  siteId: string
): Promise<PinSelection[]> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });

  // Send top 30 by search volume to Claude
  const top30 = candidates.slice(0, 30);
  const postsContext = top30.map((p, i) =>
    `${i + 1}. Title: "${p.postTitle}" | URL: ${p.postUrl} | Keyword: "${p.primaryKeyword}" (vol: ${p.searchVolume}) | Categories: ${p.categories.join(", ") || "General"} | Excerpt: ${p.excerpt.slice(0, 150)}...`
  ).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `You are a Pinterest content strategist. Given a list of blog posts with their titles, excerpts, and keyword search volumes, select the ${count} best posts to pin today for maximum Pinterest reach.

For each selected post return a JSON array with:
- post_url: the exact URL from the list
- pin_title: max 100 chars, keyword-rich, engaging
- pin_description: max 500 chars, descriptive with 3-5 relevant hashtags at the end
- image_prompt: a detailed Stability AI prompt for a vertical Pinterest image (1000x1500px). The image should be visually relevant to the post topic, bright and eye-catching, photographic or illustrated style. NO text in the image. Be specific about composition, colors, and mood.

Prioritise posts with:
1. Higher search volume (more people searching = more Pinterest interest)
2. Visually interesting topics (travel, food, lifestyle, how-to)
3. Seasonal relevance
4. Broad appeal for Pinterest's audience

=== BLOG POSTS ===
${postsContext}

Return ONLY a valid JSON array of ${count} objects. No explanation before or after.`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as PinSelection[];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as PinSelection[];
      } catch { /* fall through */ }
    }
  }

  logJob(siteId, "Failed to parse Claude response — using fallback selection");
  // Fallback: select top N by search volume
  return candidates.slice(0, count).map(p => ({
    post_url: p.postUrl,
    pin_title: p.postTitle.slice(0, 100),
    pin_description: `${p.excerpt.slice(0, 400)} #${p.categories[0] || "blog"} #tips #guide`,
    image_prompt: `A bright, eye-catching photograph related to ${p.postTitle}, colorful, professional Pinterest style, vertical composition, no text`,
  }));
}

// ============ Step 5: Generate images via Stability AI ============

async function generatePinImage(
  imagePrompt: string,
  siteId: string
): Promise<Buffer | null> {
  const stabilityKey = getApiKey("stabilityAi");
  if (!stabilityKey) {
    logJob(siteId, "No Stability AI key — skipping image generation");
    return null;
  }

  try {
    // Use Stable Image Core API (latest)
    const formData = new FormData();
    formData.append("prompt", imagePrompt);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", "9:16"); // Vertical Pinterest format

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stabilityKey}`,
        Accept: "image/*",
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      logJob(siteId, `Stability AI error: ${res.status} — ${errText.slice(0, 200)}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    logJob(siteId, `Image gen failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ============ Step 6: Publish to Pinterest ============

async function publishToPin(
  site: PinterestSite,
  pin: PinSelection,
  imageBuffer: Buffer | null
): Promise<{ pinId: string } | { error: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${site.pinterestAccessToken}`,
  };

  try {
    let pinData: Record<string, unknown>;

    if (imageBuffer) {
      // Upload image as base64
      const base64 = imageBuffer.toString("base64");
      pinData = {
        title: pin.pin_title,
        description: pin.pin_description,
        link: pin.post_url,
        board_id: site.pinterestBoardId,
        media_source: {
          source_type: "image_base64",
          content_type: "image/png",
          data: base64,
        },
      };
    } else {
      // No image — use link (Pinterest will scrape the OG image)
      pinData = {
        title: pin.pin_title,
        description: pin.pin_description,
        link: pin.post_url,
        board_id: site.pinterestBoardId,
        media_source: {
          source_type: "url",
          url: pin.post_url,
        },
      };
    }

    headers["Content-Type"] = "application/json";
    const res = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers,
      body: JSON.stringify(pinData),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { error: `Pinterest API ${res.status}: ${errText.slice(0, 300)}` };
    }

    const result = await res.json();
    return { pinId: result.id || "unknown" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ============ Full Pipeline ============

export async function runPinterestPipeline(site: PinterestSite): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const pinsPerDay = site.pinsPerDay || 10;

  // Step 1: Fetch all WordPress posts
  logJob(site.id, "Step 1/6 — Fetching WordPress posts...", 0, 6);
  const allPosts = await fetchAllWPPosts(site);
  logJob(site.id, `Fetched ${allPosts.length} posts from WordPress`, 1, 6);

  if (allPosts.length === 0) {
    return { siteId: site.id, siteName: site.name, attempted: 0, published: 0, failed: 0, pins: [], startedAt, completedAt: new Date().toISOString() };
  }

  // Step 2: Filter already pinned
  logJob(site.id, "Step 2/6 — Filtering already-pinned posts...", 1, 6);
  const unpinned = filterPinned(site.id, allPosts);
  logJob(site.id, `${unpinned.length} unpinned posts remaining (${allPosts.length - unpinned.length} already pinned)`, 2, 6);

  if (unpinned.length === 0) {
    return { siteId: site.id, siteName: site.name, attempted: 0, published: 0, failed: 0, pins: [], startedAt, completedAt: new Date().toISOString() };
  }

  // Step 3: Score by search volume
  logJob(site.id, "Step 3/6 — Scoring keywords via DataForSEO...", 2, 6);
  const scored = await scoreBySearchVolume(unpinned, site.id);
  const topKeywords = scored.slice(0, 5).map(p => `"${p.primaryKeyword}" (${p.searchVolume})`).join(", ");
  logJob(site.id, `Top keywords: ${topKeywords}`, 3, 6);

  // Step 4: Claude selects best pins
  logJob(site.id, `Step 4/6 — Claude selecting top ${pinsPerDay} pins...`, 3, 6);
  const selections = await selectPinsWithClaude(scored, pinsPerDay, site.id);
  logJob(site.id, `Claude selected ${selections.length} pins`, 4, 6);

  // Steps 5 & 6: Generate images and publish
  logJob(site.id, `Step 5-6/6 — Generating images & publishing ${selections.length} pins...`, 4, 6);

  const result: PipelineResult = {
    siteId: site.id,
    siteName: site.name,
    attempted: selections.length,
    published: 0,
    failed: 0,
    pins: [],
    startedAt,
    completedAt: "",
  };

  for (let i = 0; i < selections.length; i++) {
    const pin = selections[i];
    logJob(site.id, `[${i + 1}/${selections.length}] Generating image for "${pin.pin_title}"...`, 4 + (i / selections.length), 6);

    try {
      // Generate image
      const imageBuffer = await generatePinImage(pin.image_prompt, site.id);

      // Publish to Pinterest
      logJob(site.id, `[${i + 1}/${selections.length}] Publishing to Pinterest...`);
      const publishResult = await publishToPin(site, pin, imageBuffer);

      if ("error" in publishResult) {
        logJob(site.id, `[${i + 1}/${selections.length}] ✗ Failed: ${publishResult.error}`);
        result.failed++;
        result.pins.push({ postUrl: pin.post_url, postTitle: pin.pin_title, status: "failed", error: publishResult.error });

        // Log failed pin
        const failedPost: PinnedPost = {
          postUrl: pin.post_url,
          postTitle: pin.pin_title,
          pinId: "",
          pinnedAt: new Date().toISOString(),
          siteId: site.id,
          pinTitle: pin.pin_title,
          pinDescription: pin.pin_description,
          error: publishResult.error,
          status: "failed",
        };
        addPinnedPost(site.id, failedPost);
      } else {
        logJob(site.id, `[${i + 1}/${selections.length}] ✓ Pinned: ${publishResult.pinId}`);
        result.published++;
        result.pins.push({ postUrl: pin.post_url, postTitle: pin.pin_title, pinId: publishResult.pinId, status: "pinned" });

        // Log successful pin
        const pinnedPost: PinnedPost = {
          postUrl: pin.post_url,
          postTitle: pin.pin_title,
          pinId: publishResult.pinId,
          pinnedAt: new Date().toISOString(),
          siteId: site.id,
          pinTitle: pin.pin_title,
          pinDescription: pin.pin_description,
          status: "pinned",
        };
        addPinnedPost(site.id, pinnedPost);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logJob(site.id, `[${i + 1}/${selections.length}] ✗ Error: ${msg}`);
      result.failed++;
      result.pins.push({ postUrl: pin.post_url, postTitle: pin.pin_title, status: "failed", error: msg });
    }

    // Small delay between pins
    if (i < selections.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  result.completedAt = new Date().toISOString();
  logJob(site.id, `Pipeline complete: ${result.published} published, ${result.failed} failed out of ${result.attempted}`);
  return result;
}
