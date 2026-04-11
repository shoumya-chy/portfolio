import type { Metadata } from "next";
import { BingIndexerClient } from "./client";

export const metadata: Metadata = {
  title: "Bing IndexNow Submitter | Shoumya",
  description:
    "Auto-submit sitemap URLs or individual pages to Bing via IndexNow. Bulk index your site with configurable rate limiting.",
};

export default function BingIndexerPage() {
  return <BingIndexerClient />;
}
