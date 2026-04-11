import type { Metadata } from "next";
import { PinterestClient } from "./client";

export const metadata: Metadata = {
  title: "Pinterest Auto-Pinner | Shoumya",
  description: "Automated Pinterest pinning — fetches WordPress posts, generates AI images, and publishes optimised pins daily.",
};

export default function PinterestPage() {
  return <PinterestClient />;
}
