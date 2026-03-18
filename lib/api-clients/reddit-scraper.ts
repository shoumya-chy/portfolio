import type { TrendingTopic } from "@/lib/types";

const DEFAULT_SUBREDDITS = ["SEO", "webdev", "blogging", "digital_marketing", "ContentMarketing"];

export async function fetchRedditTopics(niche?: string): Promise<TrendingTopic[]> {
  const topics: TrendingTopic[] = [];

  // Method 1: Scrape subreddits
  const subreddits = niche
    ? [...DEFAULT_SUBREDDITS]
    : DEFAULT_SUBREDDITS;

  for (const sub of subreddits.slice(0, 5)) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        headers: {
          "User-Agent": "ShoumyaPortfolio/1.0 (content research tool)",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.log(`[Reddit] Failed r/${sub}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const d = post.data;
        if (d.stickied) continue;
        topics.push({
          title: d.title,
          url: `https://reddit.com${d.permalink}`,
          score: d.score,
          subreddit: d.subreddit,
          source: "reddit",
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.log(`[Reddit] Error r/${sub}:`, err instanceof Error ? err.message : err);
    }
  }

  // Method 2: Search Reddit via DuckDuckGo for niche-specific content
  if (niche) {
    try {
      const searchQuery = `site:reddit.com ${niche} tips OR advice OR guide`;
      const params = new URLSearchParams({ q: searchQuery });
      const res = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html",
        },
      });
      if (res.ok) {
        const html = await res.text();
        const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          let href = match[1];
          const title = match[2].replace(/<[^>]+>/g, "").trim();
          if (href.includes("uddg=")) {
            try {
              const uddg = new URL(href, "https://duckduckgo.com").searchParams.get("uddg");
              if (uddg) href = uddg;
            } catch {}
          }
          href = decodeURIComponent(href);
          if (href.includes("reddit.com") && title.length > 10) {
            const subMatch = href.match(/\/r\/([^/]+)/);
            topics.push({
              title,
              url: href,
              score: 0,
              subreddit: subMatch ? subMatch[1] : "search",
              source: "reddit",
              fetchedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Skip search errors
    }
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = topics.filter(t => {
    const key = t.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => b.score - a.score).slice(0, 50);
}
