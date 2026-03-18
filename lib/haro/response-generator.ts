import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import { scrapePageContent } from "@/lib/api-clients/content-scraper";
import type { HaroConfig, JournalistQuery } from "./types";

interface SiteContext {
  siteName: string;
  siteUrl: string;
  bio: string;
  expertiseAreas: string[];
  respondAsName: string;
  respondAsTitle: string;
  multiNiche: boolean;
  pageContent: string;
  relevantPages: { url: string; title: string }[];
}

/**
 * Scrape the site to gather context for AI responses
 */
async function gatherSiteContext(config: HaroConfig, topic: string): Promise<SiteContext> {
  const context: SiteContext = {
    siteName: config.siteName,
    siteUrl: config.siteUrl,
    bio: config.bio,
    expertiseAreas: config.expertiseAreas,
    respondAsName: config.respondAsName,
    respondAsTitle: config.respondAsTitle,
    multiNiche: config.multiNiche || false,
    pageContent: "",
    relevantPages: [],
  };

  // Try to scrape the home page and about page for context
  const pagesToTry = [
    config.siteUrl,
    `${config.siteUrl}/about`,
    `${config.siteUrl}/services`,
  ];

  for (const pageUrl of pagesToTry) {
    try {
      const content = await Promise.race([
        scrapePageContent(pageUrl),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (content) {
        context.pageContent += `\n--- ${pageUrl} ---\n${content.bodyText.slice(0, 1500)}`;
        context.relevantPages.push({ url: pageUrl, title: content.title });
      }
    } catch {
      // Skip failed pages
    }
  }

  return context;
}

/**
 * Generate an expert response to a journalist query using Claude.
 * For multi-niche sites, the AI adapts the bio and title to match the query topic.
 */
export async function generateResponse(
  config: HaroConfig,
  query: JournalistQuery
): Promise<{ response: string; relevantLinks: string[]; adaptedTitle?: string }> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const context = await gatherSiteContext(config, query.topic);
  const client = new Anthropic({ apiKey });

  // Multi-niche adaptive instructions
  const multiNicheBlock = context.multiNiche ? `
CRITICAL — MULTI-NICHE SITE:
This is a multi-niche site that covers many topics. You MUST adapt the response to position the expert as knowledgeable in the SPECIFIC topic the journalist is asking about:

1. ADAPT THE TITLE: Do NOT use "${context.respondAsTitle}" literally if it doesn't fit the query topic. Create a title that connects to the query. Examples:
   - Query about health → "Health & Wellness Editor at ${context.siteName}"
   - Query about finance → "Financial Content Strategist at ${context.siteName}"
   - Query about tech → "Technology Editor at ${context.siteName}"
   - Query about travel → "Travel & Lifestyle Editor at ${context.siteName}"
   - Query about food → "Food & Nutrition Contributor at ${context.siteName}"
   The title must sound natural and relevant to the specific query topic.

2. ADAPT THE BIO: Tweak the bio to emphasize experience relevant to the query topic. Don't fabricate credentials, but reframe existing experience to be relevant. If the bio says "digital marketing" and the query is about health, frame it as "helping health brands grow their digital presence."

3. NEVER SKIP A QUERY: Since the site is multi-niche, there is NO topic outside expertise. Every query is a backlink opportunity. Always respond confidently.

4. Include "adaptedTitle" in your JSON response with the topic-appropriate title.
` : "";

  const prompt = `You are writing an expert response to a journalist query on behalf of someone. Your goal is to provide a helpful, quotable response that gets published and includes backlinks to their site.

ABOUT THE EXPERT:
- Name: ${context.respondAsName}
- Title: ${context.respondAsTitle}
- Website: ${context.siteUrl}
- Expertise areas: ${context.expertiseAreas.length > 0 ? context.expertiseAreas.join(", ") : "Multi-topic content coverage"}
${context.bio ? `- Bio: ${context.bio}` : ""}
${context.multiNiche ? `- Site type: MULTI-NICHE (covers many different topics)` : ""}
${multiNicheBlock}
JOURNALIST QUERY:
- Source: ${query.source}
- Topic: ${query.topic}
${query.journalistName ? `- Journalist: ${query.journalistName}` : ""}
${query.outlet ? `- Outlet: ${query.outlet}` : ""}
${query.requirements ? `- Requirements: ${query.requirements}` : ""}

Full query:
"""
${query.queryText.slice(0, 1500)}
"""

SITE CONTENT (for reference and linking):
${context.pageContent.slice(0, 2000)}

INSTRUCTIONS:
1. Write a professional, expert response (200-400 words) that directly answers the journalist's query
2. Write in FIRST PERSON as ${context.respondAsName}
3. Include specific insights, data points, or examples that show genuine expertise in the topic
4. Naturally reference the website (${context.siteUrl}) where relevant — suggest it as a resource
5. Make the response QUOTABLE — journalists love concise, punchy statements they can use directly
6. Be opinionated and specific, not generic. Share a unique perspective or contrarian take when appropriate
7. Include a brief bio line at the end with the adapted title (if multi-niche) or original title
8. If the query has specific questions, answer each one directly
9. Keep the tone professional but conversational — not stiff or overly formal
10. DO NOT start with "Thank you for reaching out" or similar generic openers — start with substance
11. Use concrete numbers, percentages, or timeframes where possible (e.g., "In my experience, 70% of..." or "Over the past 3 years...")

Return JSON only:
{
  "response": "the full expert response text including bio line at the end",
  "relevantLinks": ["${context.siteUrl}/relevant-page-1"],
  "adaptedTitle": "the topic-appropriate title used in the response",
  "subjectLine": "Re: [appropriate subject line]"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    return {
      response: parsed.response || text,
      relevantLinks: parsed.relevantLinks || [context.siteUrl],
      adaptedTitle: parsed.adaptedTitle || undefined,
    };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        response: parsed.response || text,
        relevantLinks: parsed.relevantLinks || [context.siteUrl],
        adaptedTitle: parsed.adaptedTitle || undefined,
      };
    }
    return { response: text, relevantLinks: [context.siteUrl] };
  }
}
