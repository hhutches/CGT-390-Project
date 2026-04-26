import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  // delete entry first if it exists (to avoid foreign key issues)
  await prisma.userMediaEntry.deleteMany({
    where: {
      mediaId: 2,
    },
  });

  // then delete the duplicate movie
  await prisma.mediaItem.delete({
    where: {
      id: 2,
    },
  });

  console.log("Deleted duplicate movie (id = 2)");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });