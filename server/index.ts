import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { systemClock } from './clock.ts';

// Entry point for `npm run dev:server` and `npm start`. Validates config, then listens.
async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp({ dbPath: config.DB_PATH, clock: systemClock, config });

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`OGame clone listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
