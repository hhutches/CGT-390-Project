import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const entries = await prisma.userMediaEntry.findMany({
      where: {
        updatedAt: {
          gte: weekAgo,
        },
      },
      include: {
        user: true,
        media: {
          include: {
            movieDetails: true,
            showDetails: true,
            bookDetails: true,
            albumDetails: true,
            gameDetails: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 200,
    });

    const scoreByMediaId = new Map<number, number>();

    for (const entry of entries) {
      const mediaId = entry.media.id;
      scoreByMediaId.set(mediaId, (scoreByMediaId.get(mediaId) || 0) + 1);
    }

    const bestEntryByMediaId = new Map<number, (typeof entries)[number]>();

    for (const entry of entries) {
      const mediaId = entry.media.id;

      if (!bestEntryByMediaId.has(mediaId)) {
        bestEntryByMediaId.set(mediaId, entry);
      }
    }

    const popularEvents = [...bestEntryByMediaId.values()]
      .sort((a, b) => {
        const aScore = scoreByMediaId.get(a.media.id) || 0;
        const bScore = scoreByMediaId.get(b.media.id) || 0;

        return bScore - aScore;
      })
      .slice(0, 50)
      .map((entry) => {
        const score = scoreByMediaId.get(entry.media.id) || 1;

        return {
          id: entry.id,
          eventType: "UPDATED",
          bodyText: `${score} activity ${score === 1 ? "entry" : "entries"} this week`,
          ratingValue: entry.ratingValue,
          createdAt: entry.updatedAt,
          entry: {
            id: entry.id,
            status: entry.status,
            reviewText: entry.reviewText,
            user: entry.user,
            media: entry.media,
          },
        };
      });

    return NextResponse.json(popularEvents);
  } catch (error) {
    console.error("Popular this week error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load popular this week.",
      },
      { status: 500 }
    );
  }
}
