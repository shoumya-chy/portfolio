import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://shoumya.me"),
  title: {
    default: "Shoumya Chowdhury — Full-Stack Developer & SEO Specialist",
    template: "%s | Shoumya Chowdhury",
  },
  description:
    "Full-Stack Developer and SEO Specialist with 7+ years of experience building high-performance web applications. Expert in React, Next.js, TypeScript, and AI-powered solutions. Based in Melbourne, Australia.",
  keywords: [
    "Shoumya Chowdhury",
    "Full Stack Developer",
    "SEO Specialist",
    "React Developer",
    "Next.js Developer",
    "Melbourne Developer",
    "AI Engineer",
    "Web Developer",
    "Frontend Developer",
  ],
  authors: [{ name: "Shoumya Chowdhury" }],
  creator: "Shoumya Chowdhury",
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: "https://shoumya.me",
    title: "Shoumya Chowdhury — Full-Stack Developer & SEO Specialist",
    description:
      "Full-Stack Developer and SEO Specialist with 7+ years of experience. Expert in React, Next.js, and AI-powered solutions.",
    siteName: "Shoumya Chowdhury",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shoumya Chowdhury — Full-Stack Developer & SEO Specialist",
    description:
      "Full-Stack Developer and SEO Specialist with 7+ years of experience.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Shoumya Chowdhury",
    url: "https://shoumya.me",
    jobTitle: "Full-Stack Developer & SEO Specialist",
    worksFor: { "@type": "Organization", name: "Traffic Radius" },
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "University of Melbourne" },
      { "@type": "CollegeOrUniversity", name: "Chittagong University of Engineering & Technology" },
    ],
    knowsAbout: ["React.js", "Next.js", "SEO", "TypeScript", "AI/ML", "Python", "Node.js"],
    sameAs: ["https://www.linkedin.com/in/shoumya-chowdhury/", "https://github.com/shoumya-chy"],
    address: { "@type": "PostalAddress", addressLocality: "Melbourne", addressRegion: "VIC", addressCountry: "AU" },
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="noise-bg antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
