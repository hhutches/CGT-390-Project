import { prisma } from "@/lib/prisma";
import { FriendshipStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const feedMediaSelect = {
  id: true,
  type: true,
  title: true,
  releaseDate: true,
  coverUrl: true,

  movieDetails: {
    select: {
      runtimeMinutes: true,
    },
  },

  showDetails: {
    select: {
      seasonsCount: true,
      episodesCount: true,
      showStatus: true,
    },
  },

  bookDetails: {
    select: {
      pageCount: true,
    },
  },

  albumDetails: {
    select: {
      totalTracks: true,
      durationSeconds: true,
      primaryArtistName: true,
    },
  },

  gameDetails: {
    select: {
      timeToBeatHours: true,
      multiplayer: true,
    },
  },
};

async function getFriendIds(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: {
      userAId: true,
      userBId: true,
    },
  });

  return friendships.map((friendship) =>
    friendship.userAId === userId ? friendship.userBId : friendship.userAId
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId")?.trim() ?? null;
    const scope = searchParams.get("scope")?.trim() ?? "all";

    let userFilter = {};

    if (scope === "me") {
      if (!userId) {
        return NextResponse.json(
          { error: "userId is required for scope=me." },
          { status: 400 }
        );
      }

      userFilter = {
        userId,
      };
    }

    if (scope === "friends") {
      if (!userId) {
        return NextResponse.json(
          { error: "userId is required for scope=friends." },
          { status: 400 }
        );
      }

      const friendIds = await getFriendIds(userId);

      userFilter = {
        userId: {
          in: friendIds,
        },
      };
    }

    if (scope !== "all" && scope !== "me" && scope !== "friends") {
      return NextResponse.json(
        { error: "Invalid scope. Use all, friends, or me." },
        { status: 400 }
      );
    }

    const events = await prisma.userMediaLogEvent.findMany({
      take: 20,
      where: userFilter,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        eventType: true,
        bodyText: true,
        ratingValue: true,
        createdAt: true,

        entry: {
          select: {
            id: true,
            status: true,
            reviewText: true,

            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },

            media: {
              select: feedMediaSelect,
            },
          },
        },
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Feed route error:", error);

    return NextResponse.json(
      {
        error: "Failed to load feed.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}