import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import type { BacklinkTarget, GeneratedGuestPost } from "@/lib/outreach/types";

export async function generateGuestPost(
  niche: string,
  targetDomain: string,
  targetSiteStyle: string,
  senderSite: string,
  backlinkTargets: BacklinkTarget[],
  guidelines?: string
): Promise<GeneratedGuestPost> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });

  // Select top 1-2 backlink targets
  const selectedBacklinks = backlinkTargets
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const backlinkInstructions = selectedBacklinks.map((bl, i) =>
    `Backlink ${i + 1}: Link to "${bl.url}" with natural anchor text related to the page topic`
  ).join("\n");

  const nicheContext = niche ? `in the ${niche} niche` : "(multi-niche site — match the target site's topic area)";
  const prompt = `You are a seasoned freelance writer who writes for real blogs and publications. You've been hired to write a guest post for "${targetDomain}" ${nicheContext}. You are a real human being — you write from personal experience, real-world observations, and your own unique perspective.

## CRITICAL WRITING RULES — READ CAREFULLY:

You must write this content so that NO AI detection tool (GPTZero, Originality.ai, Copyleaks, ZeroGPT, etc.) can flag it as AI-written. This is absolutely essential. Here's how:

1. **Vary sentence structure naturally** — Mix short punchy sentences with longer complex ones. Real humans don't write in uniform patterns. Some sentences should be 4 words. Others might ramble a bit, with dashes and parenthetical asides (like this one), before getting to the point.

2. **Use first person and personal anecdotes** — Say "I", "I've found", "In my experience", "When I first started", etc. Share a brief personal story or observation related to the topic. Make it feel real.

3. **Imperfect language is good** — Humans don't write perfectly polished prose every single sentence. Use contractions (don't, I've, it's, they're). Start a sentence with "And" or "But" occasionally. Use dashes — like this. Use "honestly" or "look" as casual transitions sometimes.

4. **Avoid these AI tells at all costs**:
   - Never use "In today's digital landscape" or "In the ever-evolving world of"
   - Never use "It's important to note that" or "It's worth mentioning"
   - Never use "Whether you're a beginner or expert"
   - Never use "Let's dive in" or "Let's explore"
   - Never use "In conclusion" — just wrap it up naturally
   - Never use "leverage", "utilize", "delve", "foster", "streamline", "empower", "harness", "navigate", "robust", "pivotal", "crucial", "elevate"
   - Never use "game-changer", "a must-have", "take it to the next level"
   - Never start paragraphs with "Moreover", "Furthermore", "Additionally", "Consequently"
   - Never use perfectly parallel structure in lists (real humans aren't that organized)
   - Avoid excessive transition words between paragraphs

5. **Be opinionated** — Take a stance. Disagree with popular advice sometimes. Say "I think most people get this wrong" or "This might be unpopular, but..." — real writers have opinions.

6. **Include specific details** — Reference specific tools, specific numbers, specific examples. Don't be vague. Instead of "many businesses," say "a SaaS company I worked with" or "one ecommerce store."

7. **Burstiness** — Mix paragraph lengths. One paragraph can be 2 sentences. The next can be 6. Don't make them all the same length.

8. **Natural headings** — Don't use generic "Ultimate Guide" style H2s. Make them conversational: "Why Most People Get X Wrong", "The Part Nobody Talks About", "What Actually Works (And What Doesn't)".

9. **Write like you talk** — If you wouldn't say it in a conversation, don't write it. Keep it natural, direct, and human.

## Target Site Style (match this voice):
${targetSiteStyle.slice(0, 2000)}

## Requirements:
- Around 1200 words (can be 1100-1400, don't aim for an exact count)
- Match the target site's audience level and tone
- Practical, with tips that come from experience not textbooks
- Use H2 subheadings to break up the content
- Write something their readers would actually bookmark
${guidelines ? `\n## Site-Specific Guidelines:\n${guidelines}` : ""}

## Backlinks to Include (weave seamlessly):
${backlinkInstructions}
- Use markdown links: [anchor text](url)
- The anchor text should feel like part of the sentence — if someone removed the link, the sentence should still read perfectly
- Don't draw attention to the links or say "check out this resource"

## Output Format:
Return JSON only, no markdown fences:
{
  "title": "A title that sounds like a human writer came up with it — not generic, not clickbaity",
  "body": "Full article in markdown. Remember: varied sentences, personal voice, opinions, specific details, natural flow. This MUST pass AI detection tools.",
  "backlinks": [{"url": "...", "anchorText": "..."}]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.9,
    messages: [
      {
        role: "user",
        content: prompt,
      },
      {
        role: "assistant",
        content: '{"title":',
      },
    ],
  });

  const text = '{"title":' + (message.content[0].type === "text" ? message.content[0].text : "");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse guest post");
  }

  return {
    title: parsed.title,
    body: parsed.body,
    wordCount: parsed.body.split(/\s+/).length,
    backlinks: parsed.backlinks || selectedBacklinks.map(bl => ({ url: bl.url, anchorText: bl.title })),
    generatedAt: new Date().toISOString(),
  };
}
