import { PrismaClient } from '../../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Load connection string and resolve local path
const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbPath = dbUrl.replace(/^file:/, '');

// Instantiate the driver adapter factory
const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
