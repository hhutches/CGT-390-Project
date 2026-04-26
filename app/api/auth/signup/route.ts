import {
  createAuthSession,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username = normalizeUsername(String(body.username ?? ""));
    const displayName = String(body.displayName ?? "").trim() || username;
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const existingProfile = await prisma.userProfile.findUnique({
      where: {
        username,
      },
      select: {
        id: true,
      },
    });

    if (existingProfile) {
      return NextResponse.json(
        { error: "Username is already taken." },
        { status: 409 }
      );
    }

    if (email) {
      const existingEmail = await prisma.authCredential.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { error: "Email is already in use." },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.userProfile.create({
      data: {
        id: crypto.randomUUID(),
        username,
        displayName,
        bio: null,
        authCredential: {
          create: {
            email,
            passwordHash,
          },
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
      },
    });

    await createAuthSession(user.id);

    return NextResponse.json({
      user,
    });
  } catch (error) {
    console.error("Signup route error:", error);

    return NextResponse.json(
      {
        error: "Failed to sign up.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}