import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q")?.trim();
    const currentUserId = searchParams.get("userId")?.trim() ?? null;

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 }
      );
    }

    const users = await prisma.userProfile.findMany({
      where: {
        AND: [
          currentUserId
            ? {
                id: {
                  not: currentUserId,
                },
              }
            : {},
          {
            OR: [
              {
                username: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                displayName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        privacy: true,
        createdAt: true,
      },
      orderBy: {
        username: "asc",
      },
      take: 20,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("User search route error:", error);

    return NextResponse.json(
      {
        error: "Failed to search users.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}