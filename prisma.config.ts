import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct connection; Accelerate's prisma+postgres:// URL can't run them.
    url: process.env.POSTGRES_URL || env("DATABASE_URL"),
  },
});
