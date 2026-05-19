import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const filename = dbUrl.startsWith("file:")
  ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl.slice("file:".length))
  : dbUrl;

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${filename}` }),
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
