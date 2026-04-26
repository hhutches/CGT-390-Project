import { prisma } from "@/lib/prisma";

async function getProfile(username: string) {
  const profile = await prisma.userProfile.findUnique({
    where: {
      username,
    },
    include: {
      favorites: {
        include: {
          media: {
            include: {
              movieDetails: true,
              showDetails: true,
              bookDetails: true,
              albumDetails: true,
              gameDetails: true,
              externalRefs: {
                select: {
                  id: true,
                  provider: true,
                  externalId: true,
                  externalUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          slotNumber: "asc",
        },
      },

      entries: {
        include: {
          media: {
            include: {
              movieDetails: true,
              showDetails: true,
              bookDetails: true,
              albumDetails: true,
              gameDetails: true,
              externalRefs: {
                select: {
                  id: true,
                  provider: true,
                  externalId: true,
                  externalUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  return profile;
}