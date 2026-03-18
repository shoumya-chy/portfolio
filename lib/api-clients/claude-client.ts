import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, AnalysisResult } from "@/lib/types";
import { getApiKey } from "@/lib/config";
import { fetchWordPressData, formatWPContentForAnalysis } from "@/lib/api-clients/wordpress-client";

export async function analyzeContentIdeas(
  keywords: Keyword[],
  trendingTopics: TrendingTopic[],
  siteUrl?: string
): Promise<AnalysisResult> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured. Add it in Settings.");

  // Fetch WordPress content data for dedup and analysis
  let existingContentBlock = "";

  if (siteUrl) {
    const wpData = await fetchWordPressData(siteUrl);
    if (wpData && wpData.content.length > 0) {
      existingContentBlock = formatWPContentForAnalysis(wpData);
      console.log(`[Analysis] Using WordPress data: ${wpData.content.length} posts/pages`);
    } else {
      console.log(`[Analysis] No WordPress data available for ${siteUrl}. Install the SEO Bridge plugin for better content dedup.`);
    }
  }

  const client = new Anthropic({ apiKey });

  const topKeywords = keywords
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 150)
    .map((k) => `${k.query} | imp: ${k.impressions} | clicks: ${k.clicks} | pos: ${k.position}`)
    .join("\n");

  const topTopics = trendingTopics
    .slice(0, 20)
    .map((t) => `${t.title} (${t.source}${t.subreddit ? `, r/${t.subreddit}` : ""})`)
    .join("\n");

  const prompt = `You are an SEO content strategist. I need you to suggest 10 NEW articles to write.

${existingContentBlock}

## KEYWORD DATA FROM SEARCH CONSOLE & BING (last 28 days)
These are queries people search and find this site for. "imp" = impressions, "pos" = average position.
${topKeywords}

## TRENDING TOPICS FROM REDDIT & QUORA
${topTopics || "(none available)"}

## YOUR TASK
Generate exactly 10 NEW content ideas ranked by priority (1 = publish first).

CRITICAL RULES:
- NEVER suggest a topic that already exists on the site. Read the existing content list very carefully. If there's already an article about "SAT to ATAR conversion", do NOT suggest anything about SAT-to-ATAR conversions. If there's "how long for coe", do NOT suggest anything about CoE processing times.
- Look at keywords where the site gets HIGH impressions but has a POOR position (position > 10). These are the biggest opportunities.
- Also look for keyword clusters — groups of related queries that could be answered by one comprehensive article.
- Cross-reference with trending Reddit/Quora topics for timely content.
- Each idea must target a specific keyword or keyword cluster from the data.
- Include the PRIMARY keyword to target in relatedKeywords[0].
- If thin content exists (under 500 words), you may suggest expanding it — but mark it clearly as "UPDATE existing" in the title.

Return ONLY valid JSON, no other text:
{
  "ideas": [
    {
      "title": "Exact article title",
      "description": "What to cover and why this will rank (2-3 sentences)",
      "relatedKeywords": ["primary target keyword", "secondary keyword"],
      "difficulty": "low|medium|high",
      "contentType": "blog|guide|case-study|tool|video",
      "estimatedSearchVolume": "low|medium|high",
      "day": 1,
      "reason": "Why this is high priority — reference actual keyword data"
    }
  ],
  "summary": "Brief strategy summary"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = JSON.parse(text);
    return {
      ideas: result.ideas || [],
      clusters: [],
      gaps: [],
      summary: result.summary || "",
      analyzedAt: new Date().toISOString(),
    };
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        ideas: result.ideas || [],
        clusters: [],
        gaps: [],
        summary: result.summary || "",
        analyzedAt: new Date().toISOString(),
      };
    }
    throw new Error("Failed to parse Claude response as JSON");
  }
}
