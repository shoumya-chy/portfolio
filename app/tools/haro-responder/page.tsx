import type { Metadata } from "next";
import { HaroResponderClient } from "./client";

export const metadata: Metadata = {
  title: "HARO Auto-Responder | Shoumya Chowdhury",
  description: "Automatically respond to journalist queries from SourceBottle, Qwoted, and Featured to earn media coverage and backlinks.",
};

export default function HaroResponderPage() {
  return <HaroResponderClient />;
}
