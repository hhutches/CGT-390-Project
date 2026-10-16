import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseConnectionString } from "./lib/database-environment";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseConnectionString(process.env),
  },
});
