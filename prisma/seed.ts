import "dotenv/config";
import { PrismaClient, MediaType, EntryStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.userProfile.upsert({
    where: { id: "test-user-1" },
    update: {
      username: "hhutches",
      displayName: "kubrick with two bricks",
      bio: "Test profile",
    },
    create: {
      id: "test-user-1",
      username: "hhutches",
      displayName: "kubrick with two bricks",
      bio: "Test profile",
    },
  });

  let movie = await prisma.mediaItem.findFirst({
    where: {
      type: MediaType.MOVIE,
      title: "The Dark Knight",
    },
    include: {
      movieDetails: true,
    },
  });

  if (!movie) {
    movie = await prisma.mediaItem.create({
      data: {
        type: MediaType.MOVIE,
        title: "The Dark Knight",
        description: "Batman faces the Joker in Gotham City.",
        releaseDate: new Date("2008-07-18"),
        movieDetails: {
          create: {
            runtimeMinutes: 152,
          },
        },
      },
      include: {
        movieDetails: true,
      },
    });
  } else {
    await prisma.mediaItem.update({
      where: {
        id: movie.id,
      },
      data: {
        description: "Batman faces the Joker in Gotham City.",
        releaseDate: new Date("2008-07-18"),
        movieDetails: {
          upsert: {
            update: {
              runtimeMinutes: 152,
            },
            create: {
              runtimeMinutes: 152,
            },
          },
        },
      },
    });
  }

  await prisma.userMediaEntry.upsert({
    where: {
      userId_mediaId: {
        userId: user.id,
        mediaId: movie.id,
      },
    },
    update: {
      status: EntryStatus.COMPLETED,
      ratingValue: 10,
      reviewText: "Amazing movie.",
    },
    create: {
      userId: user.id,
      mediaId: movie.id,
      status: EntryStatus.COMPLETED,
      ratingValue: 10,
      reviewText: "Amazing movie.",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });