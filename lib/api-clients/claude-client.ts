import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, AnalysisResult } from "@/lib/types";
import { getApiKey } from "@/lib/config";

export async function analyzeContentIdeas(
  keywords: Keyword[],
  trendingTopics: TrendingTopic[]
): Promise<AnalysisResult> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured. Add it in Settings.");

  const client = new Anthropic({ apiKey });

  const topKeywords = keywords
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 100)
    .map((k) => `"${k.query}" (imp: ${k.impressions}, clicks: ${k.clicks}, pos: ${k.position})`)
    .join("\n");

  const topTopics = trendingTopics
    .slice(0, 20)
    .map((t) => `"${t.title}" (score: ${t.score}, r/${t.subreddit})`)
    .join("\n");

  const prompt = `You are an expert SEO content strategist. Analyze the following search data and trending topics, then provide strategic content recommendations.

## My Current Search Console Keywords (top 100):
${topKeywords}

## Trending Topics on Reddit:
${topTopics}

Based on this data, provide your analysis as a JSON object with this exact structure:
{
  "ideas": [
    {
      "title": "Blog post title",
      "description": "2-3 sentence description of what to cover",
      "relatedKeywords": ["keyword1", "keyword2"],
      "difficulty": "low|medium|high",
      "contentType": "blog|guide|case-study|tool|video",
      "estimatedSearchVolume": "low|medium|high"
    }
  ],
  "clusters": [
    {
      "pillarTopic": "Main topic name",
      "subtopics": ["subtopic1", "subtopic2"],
      "keywords": ["keyword1", "keyword2"],
      "opportunity": "high|medium|low"
    }
  ],
  "gaps": [
    {
      "topic": "Gap topic",
      "description": "Why this is an opportunity",
      "keywords": ["keyword1"],
      "opportunity": "high|medium|low"
    }
  ],
  "summary": "2-3 sentence executive summary of the content strategy"
}

Generate 8-12 content ideas, 4-6 topic clusters, and 3-5 content gaps. Focus on actionable, specific recommendations based on the actual data provided. Return ONLY valid JSON, no markdown.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = JSON.parse(text);
    return { ...result, analyzedAt: new Date().toISOString() };
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return { ...result, analyzedAt: new Date().toISOString() };
    }
    throw new Error("Failed to parse Claude response as JSON");
  }
}
