import { prisma } from "@/lib/prisma";

export async function getMediaById(id: number) {
  return prisma.mediaItem.findUnique({
    where: {
      id,
    },
    include: {
      movieDetails: true,
      showDetails: true,
      bookDetails: true,
      albumDetails: true,
      gameDetails: true,
      externalRefs: true,

      genres: {
        include: {
          genre: true,
        },
      },

      credits: {
        include: {
          person: true,
        },
        orderBy: {
          billingOrder: "asc",
        },
      },

      entries: {
        include: {
          user: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });
}