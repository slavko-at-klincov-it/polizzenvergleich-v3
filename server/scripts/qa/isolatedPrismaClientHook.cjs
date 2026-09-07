const Module = require("node:module");
const path = require("node:path");

const clientPath = process.env.POLICY_QA_PRISMA_CLIENT_PATH;
const databasePath = process.env.POLICY_QA_DATABASE_PATH;

if (!clientPath || !databasePath)
  throw new Error(
    "POLICY_QA_PRISMA_CLIENT_PATH and POLICY_QA_DATABASE_PATH are required"
  );

const originalLoad = Module._load;
const prismaModule = originalLoad(path.resolve(clientPath), module, false);

class IsolatedPrismaClient extends prismaModule.PrismaClient {
  constructor(options = {}) {
    super({
      ...options,
      datasources: {
        ...(options.datasources || {}),
        db: { url: `file:${path.resolve(databasePath)}` },
      },
    });
  }
}

const isolatedPrismaModule = {
  ...prismaModule,
  PrismaClient: IsolatedPrismaClient,
};

Module._load = function loadWithIsolatedPrisma(request, parent, isMain) {
  if (request === "@prisma/client") return isolatedPrismaModule;
  return originalLoad.call(this, request, parent, isMain);
};
