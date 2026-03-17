import type { OutreachState } from "./types";

const VALID_TRANSITIONS: Record<OutreachState, OutreachState[]> = {
  found: ["emailed", "rejected"],
  emailed: ["replied", "no_response", "rejected"],
  replied: ["agreed", "rejected"],
  agreed: ["content_sent", "rejected"],
  content_sent: [],
  rejected: [],
  no_response: ["emailed"],
};

export function canTransition(from: OutreachState, to: OutreachState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

export function getNextStates(current: OutreachState): OutreachState[] {
  return VALID_TRANSITIONS[current] || [];
}

export function getStateColor(state: OutreachState): string {
  const colors: Record<OutreachState, string> = {
    found: "var(--color-text-dim)",
    emailed: "var(--color-accent)",
    replied: "var(--color-orange)",
    agreed: "var(--color-green)",
    content_sent: "var(--color-purple)",
    rejected: "rgb(248, 113, 113)",
    no_response: "var(--color-text-dim)",
  };
  return colors[state];
}

export function getStateLabel(state: OutreachState): string {
  const labels: Record<OutreachState, string> = {
    found: "Found",
    emailed: "Emailed",
    replied: "Replied",
    agreed: "Agreed",
    content_sent: "Content Sent",
    rejected: "Rejected",
    no_response: "No Response",
  };
  return labels[state];
}
