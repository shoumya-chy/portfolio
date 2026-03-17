import type { Metadata } from "next";
import { GuestPostOutreachClient } from "./client";

export const metadata: Metadata = {
  title: "Guest Post Outreach | Shoumya",
  description: "Automated guest post outreach tool with smart backlink strategy.",
};

export default function GuestPostOutreachPage() {
  return <GuestPostOutreachClient />;
}
