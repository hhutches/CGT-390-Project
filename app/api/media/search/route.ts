import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const results = await prisma.mediaItem.findMany({
    where: {
      title: {
        contains: q,
        mode: "insensitive",
      },
    },
    include: {
      movieDetails: true,
      showDetails: true,
      bookDetails: true,
      albumDetails: true,
      gameDetails: true,
      externalRefs: true,
    },
    orderBy: {
      title: "asc",
    },
    take: 25,
  });

  return NextResponse.json(results);
}