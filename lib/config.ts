import fs from "fs";
import path from "path";

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  sitemapUrl?: string;
  wpApiUrl?: string;
  wpApiKey?: string;
}

export interface AppConfig {
  admin: {
    email: string;
    passwordHash: string;
  };
  apiKeys: {
    anthropic: string;
    bing: string;
  };
  gsc: {
    credentialsJson: string;
  };
  outreach: {
    googleCSEId: string;
    googleCSEApiKey?: string;
  };
  sites: SiteConfig[];
}

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

function ensureConfigDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const DEFAULT_CONFIG: AppConfig = {
  admin: { email: "shoumyachowdhury@gmail.com", passwordHash: "" },
  apiKeys: { anthropic: "", bing: "" },
  gsc: { credentialsJson: "" },
  outreach: { googleCSEId: "" },
  sites: [],
};

export function readConfig(): AppConfig {
  ensureConfigDir();
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    writeConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

export function writeConfig(config: AppConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getApiKey(key: "anthropic" | "bing"): string {
  return readConfig().apiKeys[key] || "";
}

export function getGscCredentials(): string {
  return readConfig().gsc.credentialsJson || "";
}

export function getGoogleCSEId(): string {
  return readConfig().outreach?.googleCSEId || "";
}

export function getGoogleCSEApiKey(): string {
  const config = readConfig();
  return config.outreach?.googleCSEApiKey || "";
}

export function getSites(): SiteConfig[] {
  return readConfig().sites || [];
}

export function getAdminEmail(): string {
  return readConfig().admin.email;
}

export function getAdminPasswordHash(): string {
  return readConfig().admin.passwordHash;
}
