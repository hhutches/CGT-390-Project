import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function isValidSlot(slotNumber: number) {
  return Number.isInteger(slotNumber) && slotNumber >= 1 && slotNumber <= 4;
}

const mediaInclude = {
  movieDetails: true,
  showDetails: true,
  bookDetails: true,
  albumDetails: true,
  gameDetails: true,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required." },
      { status: 400 }
    );
  }

  const favorites = await prisma.userProfileFavorite.findMany({
    where: {
      userId,
    },
    include: {
      media: {
        include: mediaInclude,
      },
    },
    orderBy: {
      slotNumber: "asc",
    },
  });

  return NextResponse.json(favorites);
}

export async function POST(request: Request) {
  const body = await request.json();

  const userId = String(body.userId ?? "");
  const mediaId = Number(body.mediaId);
  const slotNumber = Number(body.slotNumber);

  console.log("Saving favorite:", {
    userId,
    mediaId,
    slotNumber,
  });

  if (!userId || !mediaId || !slotNumber) {
    return NextResponse.json(
      { error: "userId, mediaId, and slotNumber are required." },
      { status: 400 }
    );
  }

  if (!isValidSlot(slotNumber)) {
    return NextResponse.json(
      { error: "slotNumber must be between 1 and 4." },
      { status: 400 }
    );
  }

  const user = await prisma.userProfile.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User profile not found." },
      { status: 404 }
    );
  }

  const media = await prisma.mediaItem.findUnique({
    where: {
      id: mediaId,
    },
  });

  if (!media) {
    return NextResponse.json(
      { error: "Media item not found." },
      { status: 404 }
    );
  }

  const favorite = await prisma.$transaction(async (tx) => {
    await tx.userProfileFavorite.deleteMany({
      where: {
        userId,
        mediaId,
        NOT: {
          slotNumber,
        },
      },
    });

    return tx.userProfileFavorite.upsert({
      where: {
        userId_slotNumber: {
          userId,
          slotNumber,
        },
      },
      update: {
        mediaId,
      },
      create: {
        userId,
        slotNumber,
        mediaId,
      },
      include: {
        media: {
          include: mediaInclude,
        },
      },
    });
  });

  return NextResponse.json(favorite);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);

  const userId = searchParams.get("userId");
  const slotNumber = Number(searchParams.get("slotNumber"));

  if (!userId || !isValidSlot(slotNumber)) {
    return NextResponse.json(
      { error: "Valid userId and slotNumber are required." },
      { status: 400 }
    );
  }

  await prisma.userProfileFavorite.delete({
    where: {
      userId_slotNumber: {
        userId,
        slotNumber,
      },
    },
  });

  return NextResponse.json({
    deleted: true,
  });
}