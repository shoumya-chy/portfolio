import type { Metadata } from "next";
import { DirectorySubmitterClient } from "./client";

export const metadata: Metadata = {
  title: "Directory Submitter | Shoumya",
  description: "Automatically submit your websites to 60+ free web directories for SEO backlinks.",
};

export default function DirectorySubmitterPage() {
  return <DirectorySubmitterClient />;
}
