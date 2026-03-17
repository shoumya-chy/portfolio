import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getAdminEmail, getAdminPasswordHash } from "./config";
import type { AuthPayload } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "sc_auth";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function verifyLogin(email: string, password: string): Promise<boolean> {
  const adminEmail = getAdminEmail();
  const passwordHash = getAdminPasswordHash();
  if (!adminEmail || !passwordHash) return false;
  if (email.toLowerCase() !== adminEmail.toLowerCase()) return false;
  return bcrypt.compare(password, passwordHash);
}

export function generateToken(): string {
  return jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: MAX_AGE });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function getAuthFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.isAdmin === true;
}

export function authCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
