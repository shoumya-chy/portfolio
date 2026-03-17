import type { TrendingTopic } from "@/lib/types";

// Quora doesn't have a public API, so we scrape trending/popular questions
// using their sitemap and search-based approach
const QUORA_TOPICS = [
  "SEO", "Digital+Marketing", "Content+Marketing", "Web+Development",
  "Blogging", "Search+Engine+Optimization", "Website+Traffic",
];

export async function fetchQuoraTopics(): Promise<TrendingTopic[]> {
  const topics: TrendingTopic[] = [];

  for (const topic of QUORA_TOPICS) {
    try {
      // Fetch Quora topic page via their public endpoint
      const res = await fetch(
        `https://www.quora.com/topic/${topic}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ShoumyaPortfolio/1.0)",
            Accept: "text/html",
          },
        }
      );

      if (!res.ok) continue;
      const html = await res.text();

      // Extract question titles from the HTML
      // Quora uses structured data and meta tags with questions
      const questionMatches = html.matchAll(/"text":"((?:How|What|Why|When|Where|Which|Can|Should|Is|Are|Do|Does|Will|Has|Have|Would)[^"]{10,200}\??)"/g);

      const seen = new Set<string>();
      for (const match of questionMatches) {
        const title = match[1]
          .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
          .replace(/\\n/g, " ")
          .replace(/\\/g, "")
          .trim();

        if (title.length < 15 || title.length > 300 || seen.has(title)) continue;
        seen.add(title);

        topics.push({
          title,
          url: `https://www.quora.com/search?q=${encodeURIComponent(title)}`,
          score: 0,
          source: "quora",
          fetchedAt: new Date().toISOString(),
        });

        if (topics.length >= 30) break;
      }

      if (topics.length >= 30) break;
    } catch {
      // Skip failed topics
    }
  }

  // If direct scraping doesn't work well, try Google for Quora results
  if (topics.length < 5) {
    for (const query of ["SEO tips", "content marketing strategy", "blog traffic growth"]) {
      try {
        const res = await fetch(
          `https://www.google.com/search?q=site:quora.com+${encodeURIComponent(query)}&num=10`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; ShoumyaPortfolio/1.0)",
            },
          }
        );
        if (!res.ok) continue;
        const html = await res.text();

        // Extract Quora question titles from Google results
        const titleMatches = html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g);
        for (const match of titleMatches) {
          const title = match[1].replace(/<[^>]+>/g, "").replace(/ - Quora/g, "").trim();
          if (title.length < 15 || title.length > 300) continue;
          topics.push({
            title,
            url: `https://www.quora.com/search?q=${encodeURIComponent(title)}`,
            score: 0,
            source: "quora",
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch {
        // Skip
      }
    }
  }

  return topics.slice(0, 30);
}
