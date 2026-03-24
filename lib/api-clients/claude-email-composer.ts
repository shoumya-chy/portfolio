import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import type { TopicSuggestion } from "@/lib/outreach/topic-selector";

/**
 * Compose a highly convincing guest post outreach email.
 *
 * Uses AI-selected topics (based on prospect niche + our SEO needs) to write
 * a personalized email that pitches specific article ideas with clear value.
 */
export async function composeOutreachEmail(
  senderName: string,
  senderSite: string,
  niche: string,
  targetDomain: string,
  targetPageTitle: string,
  topics: TopicSuggestion[]
): Promise<{ subject: string; body: string }> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });

  // Build topic pitch section
  const topicPitches = topics.map((t, i) =>
    `${i + 1}. "${t.topic}" — ${t.angle}${t.whyRelevant ? ` (${t.whyRelevant})` : ""}`
  ).join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Write a highly convincing guest post outreach email that will get a REPLY.

=== SENDER ===
Name: ${senderName}
Site: ${senderSite}
Expertise: ${niche}

=== RECIPIENT ===
Website: ${targetDomain}
Page we found: "${targetPageTitle}"

=== TOPIC PITCHES (AI-selected based on their niche + our expertise) ===
${topicPitches}

=== EMAIL WRITING RULES ===
1. OPENING: Start with something specific about THEIR site — mention a recent post, their audience, or something that shows you actually visited. Do NOT use "Dear Sir/Madam" or "Dear Editor". Use "Hi there" or "Hey" for a natural tone.

2. CREDIBILITY: Briefly mention your expertise or a result you've achieved. Keep this to ONE sentence. Don't brag.

3. TOPIC PITCH: Present the ${topics.length} topic ideas naturally — not as a numbered list but woven into the email. Explain WHY each topic would benefit THEIR readers specifically. This is the KEY part.

4. VALUE PROPOSITION: Make it clear what they get:
   - Original, well-researched content (1500-2000 words)
   - Unique insights they won't find elsewhere
   - You'll promote the post to your audience too
   - You'll follow their editorial guidelines exactly

5. CALL TO ACTION: End with a soft ask — "Would any of these topics interest your readers?" or "Happy to adjust the angle if you have something specific in mind."

6. TONE: Professional but warm. Like a colleague reaching out, not a salesperson. No exclamation marks. No "I came across your website" (overused). No "I hope this email finds you well" (cliché).

7. LENGTH: 120-180 words. Every sentence must earn its place.

8. FORMAT: Plain text only, no HTML. Short paragraphs (2-3 sentences max each).

Return ONLY valid JSON:
{"subject": "compelling subject line (under 50 chars, no clickbait)", "body": "the email body"}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse email composition");
  }
}

/**
 * Classify an inbound reply to determine if the recipient agreed to a guest post.
 */
export async function classifyReply(
  replyText: string,
  originalSubject: string
): Promise<{ isAgreement: boolean; confidence: number; reason: string }> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: `Classify this email reply to a guest post outreach. Did the recipient AGREE to accept a guest post?

Original subject: "${originalSubject}"

Reply:
"""
${replyText.slice(0, 1000)}
"""

Return JSON only:
{"isAgreement": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { isAgreement: false, confidence: 0, reason: "Failed to parse" };
  }
}
