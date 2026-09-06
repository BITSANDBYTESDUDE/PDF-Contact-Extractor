import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
if (
  !existsSync(path.join(root, 'backend/dist/server.js')) ||
  !existsSync(path.join(root, 'frontend/.next/BUILD_ID'))
) {
  console.error('Production files are missing. Run npm run build before npm start.');
  process.exit(1);
}
const env = { ...process.env, NODE_ENV: 'production' };
const children = [
  spawn(process.execPath, ['dist/server.js'], { cwd: path.join(root, 'backend'), stdio: 'inherit', env }),
  spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '0.0.0.0',
      '--port',
      process.env.FRONTEND_PORT || '3000',
    ],
    { cwd: path.join(root, 'frontend'), stdio: 'inherit', env },
  ),
];
let stopping = false;
let exitCode = 0;
let exited = 0;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  }, 10000).unref();
}
for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start the application:', error.message);
    shutdown(1);
  });
  child.on('exit', (code) => {
    exited++;
    if (!stopping) shutdown(code ?? 1);
    if (exited === children.length) process.exit(exitCode);
  });
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
