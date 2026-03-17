import * as cheerio from "cheerio";

export interface ScrapedContent {
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  wordCount: number;
  sampleParagraphs: string[];
}

export async function scrapePageContent(url: string): Promise<ScrapedContent> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ShoumyaPortfolio/1.0)",
      Accept: "text/html",
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

export async function extractContactEmail(url: string): Promise<string | null> {
  try {
    // Try the write-for-us page itself
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShoumyaPortfolio/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for email patterns
    const emailMatch = html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
    if (emailMatch) {
      // Filter out common non-contact emails
      const filtered = emailMatch.filter(
        e => !e.includes("example.com") && !e.includes("wixpress") && !e.includes("wordpress") && !e.includes("sentry")
      );
      if (filtered.length > 0) return filtered[0];
    }

    // Try /contact page
    const domain = new URL(url).origin;
    for (const contactPath of ["/contact", "/contact-us", "/about"]) {
      try {
        const contactRes = await fetch(domain + contactPath, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ShoumyaPortfolio/1.0)" },
        });
        if (!contactRes.ok) continue;
        const contactHtml = await contactRes.text();
        const contactEmail = contactHtml.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
        if (contactEmail) {
          const filtered = contactEmail.filter(
            e => !e.includes("example.com") && !e.includes("wixpress") && !e.includes("wordpress")
          );
          if (filtered.length > 0) return filtered[0];
        }
      } catch { /* skip */ }
    }

    return null;
  } catch {
    return null;
  }
}
