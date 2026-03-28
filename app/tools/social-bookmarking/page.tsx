import type { Metadata } from "next";
import { SocialBookmarkClient } from "./client";

export const metadata: Metadata = {
  title: "Social Bookmarking Submitter | Shoumya",
  description: "Automatically submit your posts to 30+ social bookmarking platforms for SEO backlinks.",
};

export default function SocialBookmarkingPage() {
  return <SocialBookmarkClient />;
}
