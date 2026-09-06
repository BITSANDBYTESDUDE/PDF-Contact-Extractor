import { createApp } from './app.js';
import { config } from './config.js';
import { initializeUploads } from './middleware/upload.js';

await initializeUploads();
const { app, jobs } = createApp();
const server = app.listen(config.port, '0.0.0.0', () =>
  console.info(`PDF Contact Extractor API listening on 0.0.0.0:${config.port}`),
);
server.requestTimeout = 120000;
server.headersTimeout = 30000;
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info('Shutting down; stopping workers and deleting temporary uploads.');
  server.close();
  await jobs.dispose();
  server.closeAllConnections();
  process.exit(0);
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
