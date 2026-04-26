import { prisma } from "@/lib/prisma";
import { FriendshipStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function normalizeFriendPair(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new Error("You cannot friend yourself.");
  }

  const [userAId, userBId] = [userId, targetUserId].sort();

  return {
    userAId,
    userBId,
  };
}

function getOtherUser(friendship: any, currentUserId: string) {
  if (friendship.userAId === currentUserId) {
    return friendship.userB;
  }

  return friendship.userA;
}

const friendshipInclude = {
  userA: {
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      privacy: true,
    },
  },
  userB: {
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      privacy: true,
    },
  },
  actionUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required query parameter: userId" },
        { status: 400 }
      );
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: friendshipInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    const friends = friendships
      .filter((friendship) => friendship.status === FriendshipStatus.ACCEPTED)
      .map((friendship) => ({
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        user: getOtherUser(friendship, userId),
      }));

    const incomingRequests = friendships
      .filter(
        (friendship) =>
          friendship.status === FriendshipStatus.PENDING &&
          friendship.actionUserId !== userId
      )
      .map((friendship) => ({
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        fromUser: getOtherUser(friendship, userId),
      }));

    const outgoingRequests = friendships
      .filter(
        (friendship) =>
          friendship.status === FriendshipStatus.PENDING &&
          friendship.actionUserId === userId
      )
      .map((friendship) => ({
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        toUser: getOtherUser(friendship, userId),
      }));

    const blocked = friendships
      .filter((friendship) => friendship.status === FriendshipStatus.BLOCKED)
      .map((friendship) => ({
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        user: getOtherUser(friendship, userId),
        actionUser: friendship.actionUser,
      }));

    return NextResponse.json({
      friends,
      incomingRequests,
      outgoingRequests,
      blocked,
    });
  } catch (error) {
    console.error("Friends GET route error:", error);

    return NextResponse.json(
      {
        error: "Failed to load friends.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const userId = String(body.userId ?? "").trim();
    const targetUserId = String(body.targetUserId ?? "").trim();

    if (!userId || !targetUserId) {
      return NextResponse.json(
        { error: "userId and targetUserId are required." },
        { status: 400 }
      );
    }

    const { userAId, userBId } = normalizeFriendPair(userId, targetUserId);

    const users = await prisma.userProfile.findMany({
      where: {
        id: {
          in: [userId, targetUserId],
        },
      },
      select: {
        id: true,
      },
    });

    if (users.length !== 2) {
      return NextResponse.json(
        { error: "One or both users do not exist." },
        { status: 404 }
      );
    }

    const existing = await prisma.friendship.findUnique({
      where: {
        userAId_userBId: {
          userAId,
          userBId,
        },
      },
      include: friendshipInclude,
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        return NextResponse.json(
          { error: "Users are already friends.", friendship: existing },
          { status: 409 }
        );
      }

      if (existing.status === FriendshipStatus.PENDING) {
        return NextResponse.json(
          { error: "Friend request already pending.", friendship: existing },
          { status: 409 }
        );
      }

      if (existing.status === FriendshipStatus.BLOCKED) {
        return NextResponse.json(
          { error: "Friend request cannot be sent." },
          { status: 403 }
        );
      }

      const friendship = await prisma.friendship.update({
        where: {
          id: existing.id,
        },
        data: {
          status: FriendshipStatus.PENDING,
          actionUserId: userId,
        },
        include: friendshipInclude,
      });

      return NextResponse.json({
        created: false,
        friendship,
      });
    }

    const friendship = await prisma.friendship.create({
      data: {
        userAId,
        userBId,
        actionUserId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: friendshipInclude,
    });

    return NextResponse.json({
      created: true,
      friendship,
    });
  } catch (error) {
    console.error("Friends POST route error:", error);

    return NextResponse.json(
      {
        error: "Failed to send friend request.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const userId = String(body.userId ?? "").trim();
    const friendshipId = Number(body.friendshipId);
    const action = String(body.action ?? "").trim();

    if (!userId || !Number.isInteger(friendshipId) || !action) {
      return NextResponse.json(
        { error: "userId, friendshipId, and action are required." },
        { status: 400 }
      );
    }

    const friendship = await prisma.friendship.findUnique({
      where: {
        id: friendshipId,
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found." },
        { status: 404 }
      );
    }

    if (friendship.userAId !== userId && friendship.userBId !== userId) {
      return NextResponse.json(
        { error: "You are not part of this friendship." },
        { status: 403 }
      );
    }

    if (action === "accept") {
      if (friendship.status !== FriendshipStatus.PENDING) {
        return NextResponse.json(
          { error: "Only pending requests can be accepted." },
          { status: 400 }
        );
      }

      if (friendship.actionUserId === userId) {
        return NextResponse.json(
          { error: "You cannot accept your own outgoing request." },
          { status: 400 }
        );
      }

      const updated = await prisma.friendship.update({
        where: {
          id: friendshipId,
        },
        data: {
          status: FriendshipStatus.ACCEPTED,
          actionUserId: userId,
        },
        include: friendshipInclude,
      });

      return NextResponse.json({
        friendship: updated,
      });
    }

    if (action === "decline") {
      if (friendship.status !== FriendshipStatus.PENDING) {
        return NextResponse.json(
          { error: "Only pending requests can be declined." },
          { status: 400 }
        );
      }

      const updated = await prisma.friendship.update({
        where: {
          id: friendshipId,
        },
        data: {
          status: FriendshipStatus.DECLINED,
          actionUserId: userId,
        },
        include: friendshipInclude,
      });

      return NextResponse.json({
        friendship: updated,
      });
    }

    if (action === "block") {
      const updated = await prisma.friendship.update({
        where: {
          id: friendshipId,
        },
        data: {
          status: FriendshipStatus.BLOCKED,
          actionUserId: userId,
        },
        include: friendshipInclude,
      });

      return NextResponse.json({
        friendship: updated,
      });
    }

    return NextResponse.json(
      { error: "Unsupported action. Use accept, decline, or block." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Friends PATCH route error:", error);

    return NextResponse.json(
      {
        error: "Failed to update friendship.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId")?.trim();
    const friendshipId = Number(searchParams.get("friendshipId"));

    if (!userId || !Number.isInteger(friendshipId)) {
      return NextResponse.json(
        { error: "userId and friendshipId are required." },
        { status: 400 }
      );
    }

    const friendship = await prisma.friendship.findUnique({
      where: {
        id: friendshipId,
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found." },
        { status: 404 }
      );
    }

    if (friendship.userAId !== userId && friendship.userBId !== userId) {
      return NextResponse.json(
        { error: "You are not part of this friendship." },
        { status: 403 }
      );
    }

    await prisma.friendship.delete({
      where: {
        id: friendshipId,
      },
    });

    return NextResponse.json({
      deleted: true,
      friendshipId,
    });
  } catch (error) {
    console.error("Friends DELETE route error:", error);

    return NextResponse.json(
      {
        error: "Failed to remove friendship.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}