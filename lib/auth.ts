import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "crypto";

const DEFAULT_COOKIE_NAME = "media_app_session";
const SESSION_LENGTH_DAYS = 30;

export function getAuthCookieName() {
  return process.env.AUTH_COOKIE_NAME ?? DEFAULT_COOKIE_NAME;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function createSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

export function getSessionExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_LENGTH_DAYS);
  return expiresAt;
}

export async function createAuthSession(userId: string) {
  const sessionId = createSessionId();
  const expiresAt = getSessionExpiryDate();

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set(getAuthCookieName(), sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return {
    sessionId,
    expiresAt,
  };
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(getAuthCookieName())?.value;

  if (sessionId) {
    await prisma.authSession.deleteMany({
      where: {
        id: sessionId,
      },
    });
  }

  cookieStore.delete(getAuthCookieName());
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(getAuthCookieName())?.value;

  if (!sessionId) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          bannerUrl: true,
          privacy: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.authSession.delete({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  return session.user;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim().toLowerCase();

  return trimmed || null;
}

export function validateUsername(username: string) {
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return "Username must be 3-24 characters and can only use lowercase letters, numbers, and underscores.";
  }

  return null;
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return null;
}