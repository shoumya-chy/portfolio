import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";

export async function composeOutreachEmail(
  senderName: string,
  senderSite: string,
  niche: string,
  targetDomain: string,
  targetPageTitle: string
): Promise<{ subject: string; body: string }> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Write a professional, personalized guest post outreach email.

Context:
- I run "${senderSite}" in the ${niche} niche
- I want to write a guest post for "${targetDomain}"
- Their page title: "${targetPageTitle}"

Requirements:
- Keep it under 150 words
- Be genuinely personal, not spammy
- Mention their site specifically
- Offer value (expertise, unique perspective)
- Ask politely if they accept guest posts
- Professional but warm tone
- Do NOT include "Dear Sir/Madam" - use a friendly opener

Return JSON only:
{"subject": "email subject", "body": "email body in plain text"}`,
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
