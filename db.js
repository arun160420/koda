const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

let prisma = null;
let isConnected = false;

const DATABASE_URL = process.env.DATABASE_URL || '';

if (DATABASE_URL && !DATABASE_URL.startsWith('replace')) {
  try {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  } catch (err) {
    console.warn('[DB] Could not initialize PrismaClient:', err.message);
  }
}

async function testConnection() {
  if (!prisma) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    isConnected = true;
    console.log('[DB] Connected to PostgreSQL via Prisma.');
    return true;
  } catch (error) {
    isConnected = false;
    console.warn('[DB] PostgreSQL connection check failed. Falling back to local store.', error.message);
    return false;
  }
}

// Check initial connection asynchronously if DATABASE_URL is set
if (prisma) {
  testConnection().catch(() => {});
}

module.exports = {
  prisma,
  isConnected: () => isConnected,
  testConnection
};
