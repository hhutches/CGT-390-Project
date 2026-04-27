import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FriendshipStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const FEED_LIMIT = 20;

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

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);

  headers.set("Cache-Control", "private, no-store, max-age=0");

  return NextResponse.json(data, {
    ...init,
    headers,
  });
}

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
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return json({ error: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope")?.trim() ?? "all";
    const userId = currentUser.id;

    if (scope !== "all" && scope !== "me" && scope !== "friends") {
      return json(
        { error: "Invalid scope. Use all, friends, or me." },
        { status: 400 }
      );
    }

    let userFilter:
      | {}
      | {
          userId: string | { in: string[] };
        } = {};

    if (scope === "me") {
      userFilter = {
        userId,
      };
    }

    if (scope === "friends") {
      const friendIds = await getFriendIds(userId);

      if (friendIds.length === 0) {
        return json([]);
      }

      userFilter = {
        userId: {
          in: friendIds,
        },
      };
    }

    const events = await prisma.userMediaLogEvent.findMany({
      take: FEED_LIMIT,
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

    return json(events);
  } catch (error) {
    console.error("Feed route error:", error);

    return json(
      {
        error: "Failed to load feed.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}