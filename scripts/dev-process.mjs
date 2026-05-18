import { spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';

import { withSystemCaEnv } from './system-ca.mjs';

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const runDir = resolve(projectRoot, '.cache');
const pidPath = resolve(runDir, 'dev-server.pid');
const logPath = resolve(runDir, 'dev-server.log');

const command = process.argv[2];

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  default:
    console.error('Usage: node scripts/dev-process.mjs <start|stop|status>');
    process.exit(1);
}

function start() {
  mkdirSync(runDir, { recursive: true });

  const existingPid = readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`Dev server is already running with PID ${existingPid}.`);
    console.log(`Logs: ${logPath}`);
    return;
  }

  if (existingPid) {
    rmSync(pidPath, { force: true });
  }

  appendFileSync(logPath, `\n--- Starting dev server at ${new Date().toISOString()} ---\n`);
  const out = openSync(logPath, 'a');
  const env = withSystemCaEnv(projectRoot);
  if (env.ALEXA_CHAT_CA_COUNT) {
    appendFileSync(logPath, `Loaded ${env.ALEXA_CHAT_CA_COUNT} macOS CA certificates for Node TLS.\n`);
  }

  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: projectRoot,
    detached: true,
    env,
    stdio: ['ignore', out, out]
  });

  child.unref();
  writeFileSync(pidPath, `${child.pid}\n`);
  console.log(`Started dev server in the background with PID ${child.pid}.`);
  console.log(`Logs: ${logPath}`);
}

function stop() {
  const pid = readPid();
  if (!pid) {
    console.log('No dev server PID file found.');
    return;
  }

  if (!isRunning(pid)) {
    rmSync(pidPath, { force: true });
    console.log(`Removed stale PID file for PID ${pid}.`);
    return;
  }

  process.kill(-pid, 'SIGINT');
  waitForExit(pid, 3000);

  if (isRunning(pid)) {
    process.kill(-pid, 'SIGTERM');
    waitForExit(pid, 3000);
  }

  if (isRunning(pid)) {
    console.error(`Dev server PID ${pid} did not stop. Try: kill -TERM -${pid}`);
    process.exit(1);
  }

  rmSync(pidPath, { force: true });
  console.log(`Stopped dev server PID ${pid}.`);
}

function status() {
  const pid = readPid();
  if (pid && isRunning(pid)) {
    console.log(`Dev server is running with PID ${pid}.`);
    console.log(`Logs: ${logPath}`);
    return;
  }

  if (pid) {
    console.log(`Dev server is not running. Stale PID file points to ${pid}.`);
    return;
  }

  console.log('Dev server is not running.');
}

function readPid() {
  if (!existsSync(pidPath)) {
    return undefined;
  }

  const pid = Number.parseInt(readFileSync(pidPath, 'utf8').trim(), 10);
  return Number.isFinite(pid) ? pid : undefined;
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EPERM') {
      return true;
    }

    return false;
  }
}

function waitForExit(pid, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isRunning(pid)) {
      return;
    }
  }
}
