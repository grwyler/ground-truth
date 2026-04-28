export function createPersistenceConfig(env = process.env) {
  return {
    databaseUrl: env.DATABASE_URL ?? "",
    storageProvider: env.STORAGE_PROVIDER ?? "local",
    storageRoot: env.STORAGE_LOCAL_ROOT ?? ".data/uploads"
  };
}
