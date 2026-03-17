import type { TrendingTopic } from "@/lib/types";

const SUBREDDITS = ["SEO", "webdev", "nextjs", "javascript", "blogging", "ContentMarketing", "digital_marketing"];

export async function fetchRedditTopics(): Promise<TrendingTopic[]> {
  const topics: TrendingTopic[] = [];

  for (const sub of SUBREDDITS) {
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

  return topics.sort((a, b) => b.score - a.score).slice(0, 50);
}
