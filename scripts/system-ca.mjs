import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function withSystemCaEnv(projectRoot, baseEnv = process.env) {
  const env = { ...baseEnv };

  if (process.platform !== 'darwin') {
    return env;
  }

  const caBundlePath = resolve(projectRoot, '.cache', 'macos-system-ca.pem');
  const keychains = [
    '/System/Library/Keychains/SystemRootCertificates.keychain',
    '/Library/Keychains/System.keychain',
    `${env.HOME}/Library/Keychains/login.keychain-db`
  ].filter(Boolean);

  const certs = keychains
    .filter((keychain) => existsSync(keychain))
    .flatMap((keychain) => {
      try {
        const output = execFileSync('/usr/bin/security', ['find-certificate', '-a', '-p', keychain], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        });
        return output.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
      } catch {
        return [];
      }
    });

  const uniqueCerts = [...new Set(certs)];
  if (uniqueCerts.length > 0) {
    mkdirSync(dirname(caBundlePath), { recursive: true });
    writeFileSync(caBundlePath, `${uniqueCerts.join('\n')}\n`);
    env.NODE_EXTRA_CA_CERTS = caBundlePath;
    env.ALEXA_CHAT_CA_COUNT = String(uniqueCerts.length);
  }

  return env;
}
