import path from 'node:path';
import { open, readdir } from 'node:fs/promises';

function directory() {
  const local = process.env.LOCALAPPDATA;
  return process.platform === 'win32' && local ? path.join(local, 'CS Demo Manager/Playbook/Takes') : undefined;
}

const filename = /^[a-z0-9_-]{1,64}\.take\.json$/i;
export async function listPracticeTakes() {
  const dir = directory();
  if (!dir) return [];
  try {
    const files = await readdir(dir, { withFileTypes: true });
    return files
      .filter((file) => file.isFile() && filename.test(file.name))
      .map((file) => file.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function readPracticeTake(name: string) {
  const dir = directory();
  if (!dir || !filename.test(name) || path.basename(name) !== name) throw new Error('Invalid practice take name.');
  const file = await open(path.join(dir, name), 'r');
  try {
    if ((await file.stat()).size > 32 * 1024 * 1024) throw new Error('Take exceeds 32 MiB.');
    return await file.readFile('utf8');
  } finally {
    await file.close();
  }
}
