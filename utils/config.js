import fs from 'fs';
import path from 'path';

/**
 * Reads key=value pairs from config.properties at the project root.
 * @param {string} file
 * @returns {Record<string, string>}
 */
function loadProperties(file) {
  /** @type {Record<string, string>} */
  const props = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    props[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return props;
}

/**
 * Settings from config.properties, overridden by config.local.properties when it exists.
 * The local file holds the login credentials and is kept out of Git (see .gitignore).
 */
const localFile = path.resolve(process.cwd(), 'config.local.properties');
export const config = {
  ...loadProperties(path.resolve(process.cwd(), 'config.properties')),
  ...(fs.existsSync(localFile) ? loadProperties(localFile) : {}),
};
