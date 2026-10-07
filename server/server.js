import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';

const startServer = async () => {
  const server = app.listen(env.port, () => {
    console.log(`PropIQ backend listening on http://localhost:${env.port}`);
  });

  server.on('error', (error) => {
    console.error(`Unable to bind PropIQ backend: ${error.message}`);
    process.exitCode = 1;
  });

  await connectDatabase();
};

startServer().catch((error) => {
  console.error(`Unable to start PropIQ backend: ${error.message}`);
  process.exit(1);
});
