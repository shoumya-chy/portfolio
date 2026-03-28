/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * Forces all DNS resolution to prefer IPv4 over IPv6.
 * Many VPS (DigitalOcean droplets) don't have IPv6 connectivity,
 * causing ENETUNREACH errors when connecting to Cloudflare-hosted
 * services (SMTP, DuckDuckGo, etc.) that resolve to IPv6 first.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
