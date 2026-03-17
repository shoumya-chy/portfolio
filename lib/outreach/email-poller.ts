import { listProspects, saveProspect, recalculateStats } from "@/lib/outreach/storage";
import type { OutreachProject, OutreachProspect, InboundEmail } from "@/lib/outreach/types";
import { canTransition } from "@/lib/outreach/state-machine";
import { fetchInboxEmails } from "@/lib/api-clients/email-client";
import { classifyReply } from "@/lib/api-clients/claude-email-composer";

/**
 * Polls IMAP inbox for replies and classifies them
 */
export async function pollForReplies(
  project: OutreachProject
): Promise<{ processed: number; agreements: number }> {
  let processed = 0;
  let agreements = 0;

  try {
    // Fetch emails from last 14 days
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const inboxEmails = await fetchInboxEmails(project.imapConfig, since);

    // Get emailed prospects
    const prospects = listProspects(project.id, "emailed");

    // Map by contact email for fast lookup
    const emailMap = new Map<string, OutreachProspect>();
    for (const p of prospects) {
      emailMap.set(p.contactEmail.toLowerCase(), p);
    }

    for (const msg of inboxEmails) {
      const senderEmail = msg.from.toLowerCase();
      const prospect = emailMap.get(senderEmail);

      if (!prospect) continue;

      // Classify the reply
      const classification = await classifyReply(msg.text, msg.subject);

      // Create inbound email record
      const inbound: InboundEmail = {
        receivedAt: new Date(msg.date).toISOString(),
        from: msg.from,
        subject: msg.subject,
        snippet: msg.text.slice(0, 200),
        messageId: msg.messageId,
        isAgreement: classification.isAgreement,
      };

      prospect.inboundEmails.push(inbound);

      // Determine next state
      if (classification.isAgreement && classification.confidence > 0.7) {
        if (canTransition(prospect.state, "agreed")) {
          prospect.state = "agreed";
          prospect.agreedAt = new Date().toISOString();
          agreements++;
        }
      } else if (!classification.isAgreement && classification.confidence > 0.7) {
        if (canTransition(prospect.state, "rejected")) {
          prospect.state = "rejected";
        }
      } else {
        if (canTransition(prospect.state, "replied")) {
          prospect.state = "replied";
          prospect.repliedAt = new Date().toISOString();
        }
      }

      saveProspect(prospect);
      processed++;

      // Remove from map to avoid processing same prospect twice
      emailMap.delete(senderEmail);
    }

    recalculateStats(project.id);
    return { processed, agreements };
  } catch (error) {
    console.log("[EmailPoller] Error:", error instanceof Error ? error.message : error);
    return { processed, agreements };
  }
}
