import { createClient } from 'redis';
import { config } from './config.js';

let client;
let connection;
let available = false;

if (config.REDIS_URL) {
  client = createClient({ url: config.REDIS_URL, socket: { connectTimeout: 1000, reconnectStrategy: false } });
  client.on('error', error => {
    available = false;
    console.warn(`Redis cache unavailable: ${error.message}`);
  });
  connection = client.connect()
    .then(() => { available = true; })
    .catch(error => { console.warn(`Redis cache disabled: ${error.message}`); });
}

async function ready() {
  if (!client || !connection) return false;
  return available && client.isReady;
}

export async function getCachedJson(key) {
  try {
    if (!(await ready())) return null;
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`Redis read skipped: ${error.message}`);
    return null;
  }
}

export async function setCachedJson(key, value, ttlSeconds = 30) {
  try {
    if (!(await ready())) return;
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.warn(`Redis write skipped: ${error.message}`);
  }
}

export async function closeCache() {
  try {
    if (client?.isOpen) await client.quit();
  } catch (error) {
    console.warn(`Redis close skipped: ${error.message}`);
  }
}
