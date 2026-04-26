import {
  createAuthSession,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(identifier);
    const username = normalizeUsername(identifier);

    const credential = await prisma.authCredential.findFirst({
      where: {
        OR: [
          {
            email,
          },
          {
            user: {
              username,
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 }
      );
    }

    const validPassword = await verifyPassword(
      password,
      credential.passwordHash
    );

    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 }
      );
    }

    await createAuthSession(credential.userId);

    return NextResponse.json({
      user: credential.user,
    });
  } catch (error) {
    console.error("Login route error:", error);

    return NextResponse.json(
      {
        error: "Failed to log in.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}