import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";

/**
 * Compose a follow-up email for a non-responsive prospect.
 *
 * Follow-up #1 (after ~5 days): Short, casual bump. Reference original topics.
 * Follow-up #2 (after ~10 days): Final attempt with different angle. Add urgency.
 */
export async function composeFollowUpEmail(
  senderName: string,
  targetDomain: string,
  originalSubject: string,
  originalBody: string,
  followUpNumber: number,
  pitchedTopics: string[]
): Promise<{ subject: string; body: string }> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey });

  const topicList = pitchedTopics.length > 0
    ? pitchedTopics.map(t => `"${t}"`).join(", ")
    : "a guest post";

  const followUpContext = followUpNumber === 1
    ? `This is the FIRST follow-up (5 days after initial email). Keep it very short (50-80 words).
       Be casual — "bumping this up" or "circling back" style. Reference the topics briefly.
       Don't repeat the whole pitch. Just a friendly nudge.`
    : `This is the FINAL follow-up (10 days after initial email). Keep it short (60-90 words).
       Try a different angle — maybe mention you have another topic idea, or ask if there's a different person you should contact.
       Add soft urgency: "I'm scheduling my content calendar for next month" or similar.
       Be graceful — make it easy for them to say no.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Write a follow-up email for a guest post outreach that got no response.

=== CONTEXT ===
Sender: ${senderName}
Recipient's site: ${targetDomain}
Original subject: "${originalSubject}"
Topics I pitched: ${topicList}
Follow-up #: ${followUpNumber}

${followUpContext}

=== RULES ===
1. Subject line: "Re: ${originalSubject}" (makes it look like a reply thread)
2. NO "Dear Sir/Madam". Use "Hi" or "Hey" or "Hi there"
3. Do NOT sound desperate or pushy
4. Professional but human — like texting a work colleague
5. Do NOT apologize for following up
6. Plain text, no HTML
7. End with a simple question, not a statement

Return ONLY valid JSON:
{"subject": "Re: ${originalSubject}", "body": "the follow-up email body"}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);

    // Hardcoded fallback
    if (followUpNumber === 1) {
      return {
        subject: `Re: ${originalSubject}`,
        body: `Hi there,\n\nJust bumping this up in case it got buried. I pitched a few guest post ideas for ${targetDomain} last week — specifically around ${topicList}.\n\nWould any of these work for your editorial calendar?\n\nBest,\n${senderName}`,
      };
    }
    return {
      subject: `Re: ${originalSubject}`,
      body: `Hey,\n\nI know inboxes get crazy, so this is my last follow-up. I'd love to contribute to ${targetDomain} — I'm planning my content calendar for next month and would prioritize your site.\n\nIf guest posts aren't a fit right now, no worries at all. Is there someone else on your team I should reach out to?\n\nThanks,\n${senderName}`,
    };
  }
}
