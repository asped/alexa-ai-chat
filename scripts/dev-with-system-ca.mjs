import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

import { withSystemCaEnv } from './system-ca.mjs';

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const env = withSystemCaEnv(projectRoot);

if (env.ALEXA_CHAT_CA_COUNT) {
  console.log(`Loaded ${env.ALEXA_CHAT_CA_COUNT} macOS CA certificates for Node TLS.`);
} else if (process.platform === 'darwin') {
  console.warn('No macOS CA certificates were exported. Starting with Node defaults.');
}

const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
