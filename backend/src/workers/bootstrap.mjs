import { workerData } from 'node:worker_threads';
// Register a normal ESM loader in dev, not a namespaced tsImport loader:
// PDF.js uses createRequire for native canvas modules and Node builtins.
if (workerData.module.endsWith('.ts')) {
  const { register } = await import('tsx/esm/api');
  register();
}
await import(workerData.module);
