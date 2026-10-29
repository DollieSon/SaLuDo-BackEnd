import type { TestProject } from "vitest/node";
import { MongoMemoryServer } from "mongodb-memory-server";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// Starts a throwaway MongoDB for the test run. The first run downloads a
// mongod binary (cached afterwards; MONGOMS_DOWNLOAD_DIR overrides where).
export default async function setup(project: TestProject) {
  const mongo = await MongoMemoryServer.create();
  project.provide("mongoUri", mongo.getUri());

  return async () => {
    await mongo.stop();
  };
}
