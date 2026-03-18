import type { TrendingTopic } from "@/lib/types";

export async function fetchQuoraTopics(niche?: string): Promise<TrendingTopic[]> {
  const topics: TrendingTopic[] = [];

  const searchQueries = niche
    ? [
        `site:quora.com "${niche}" tips`,
        `site:quora.com "${niche}" how to`,
        `site:quora.com "${niche}" best practices`,
      ]
    : [
        `site:quora.com SEO tips 2024 2025`,
        `site:quora.com content marketing strategy`,
        `site:quora.com blog traffic growth`,
        `site:quora.com web development best practices`,
      ];

  for (const query of searchQueries) {
    try {
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html",
        },
      });

      if (!res.ok) continue;
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
        if (href.includes("quora.com") && title.length > 10) {
          topics.push({
            title: title.replace(/ - Quora$/i, "").trim(),
            url: href,
            score: 0,
            source: "quora",
            fetchedAt: new Date().toISOString(),
          });
        }
      }

      // Be polite between queries
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      // Skip errors
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = topics.filter(t => {
    const key = t.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 30);
}
