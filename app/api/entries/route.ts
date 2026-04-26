import { prisma } from "@/lib/prisma";
import { EntryStatus, LogEventType } from "@prisma/client";
import { NextResponse } from "next/server";

function getEventType({
  previousEntryExists,
  status,
  ratingValue,
  reviewText,
}: {
  previousEntryExists: boolean;
  status: EntryStatus;
  ratingValue: number | null;
  reviewText: string | null;
}) {
  if (!previousEntryExists) {
    return LogEventType.ADDED;
  }

  if (reviewText && reviewText.trim().length > 0) {
    return LogEventType.REVIEWED;
  }

  if (ratingValue !== null) {
    return LogEventType.RATED;
  }

  if (status === EntryStatus.COMPLETED) {
    return LogEventType.COMPLETED;
  }

  if (status === EntryStatus.IN_PROGRESS) {
    return LogEventType.STARTED;
  }

  return LogEventType.UPDATED;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = String(body.userId ?? "");
    const mediaId = Number(body.mediaId);
    const status = body.status as EntryStatus;
    const ratingValue =
      body.ratingValue === null || body.ratingValue === ""
        ? null
        : Number(body.ratingValue);
    const reviewText =
      typeof body.reviewText === "string" && body.reviewText.trim().length > 0
        ? body.reviewText.trim()
        : null;

    if (!userId || !mediaId) {
      return NextResponse.json(
        { error: "userId and mediaId are required." },
        { status: 400 }
      );
    }

    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    const media = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      return NextResponse.json(
        { error: "Media item not found." },
        { status: 404 }
      );
    }

    const existingEntry = await prisma.userMediaEntry.findUnique({
      where: {
        userId_mediaId: {
          userId,
          mediaId,
        },
      },
    });

    const eventType = getEventType({
      previousEntryExists: Boolean(existingEntry),
      status,
      ratingValue,
      reviewText,
    });

    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.userMediaEntry.upsert({
        where: {
          userId_mediaId: {
            userId,
            mediaId,
          },
        },
        update: {
          status,
          ratingValue,
          reviewText,
          lastActivityAt: new Date(),
        },
        create: {
          userId,
          mediaId,
          status,
          ratingValue,
          reviewText,
          lastActivityAt: new Date(),
        },
        include: {
          media: true,
          user: true,
        },
      });

      const logEvent = await tx.userMediaLogEvent.create({
        data: {
          entryId: entry.id,
          mediaId,
          userId,
          eventType,
          bodyText: reviewText,
          ratingValue,
          details: {
            status,
          },
        },
      });

      return {
        entry,
        logEvent,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Entry route error:", error);

    return NextResponse.json(
      {
        error: "Internal entry error.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}