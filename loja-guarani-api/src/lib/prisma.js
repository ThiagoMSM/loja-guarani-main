const { PrismaClient } = require("@prisma/client");

let prisma;

if (!global.__prismaInstance) {
  global.__prismaInstance = new PrismaClient();
}

prisma = global.__prismaInstance;

module.exports = prisma;
