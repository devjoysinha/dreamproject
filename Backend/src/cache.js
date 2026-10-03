import { createClient } from 'redis';
import { config } from './config.js';

let client;
let connection;
let available = false;
const developmentPrivateStore = new Map();
const allowDevelopmentPrivateStore = process.env.NODE_ENV !== 'production';

function pruneDevelopmentPrivateStore() {
  const now = Date.now();
  for (const [key, entry] of developmentPrivateStore) if (entry.expiresAt <= now) developmentPrivateStore.delete(key);
}

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

// Authentication state and sessions deliberately use separate helpers from the
// short-lived catalogue cache. Callers must treat a false return as unavailable.
export async function setPrivateJson(key, value, ttlSeconds) {
  try {
    if (!(await ready())) {
      if (!allowDevelopmentPrivateStore) return false;
      pruneDevelopmentPrivateStore();
      developmentPrivateStore.set(key, { value, expiresAt: Date.now() + (ttlSeconds * 1000) });
      return true;
    }
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (error) {
    console.warn(`Redis private write skipped: ${error.message}`);
    return false;
  }
}

export async function getPrivateJson(key) {
  try {
    if (!(await ready())) {
      if (!allowDevelopmentPrivateStore) return null;
      pruneDevelopmentPrivateStore();
      return developmentPrivateStore.get(key)?.value || null;
    }
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`Redis private read skipped: ${error.message}`);
    return null;
  }
}

export async function deletePrivateKey(key) {
  try {
    if (!(await ready())) {
      if (!allowDevelopmentPrivateStore) return false;
      developmentPrivateStore.delete(key);
      return true;
    }
    await client.del(key);
    return true;
  } catch (error) {
    console.warn(`Redis private delete skipped: ${error.message}`);
    return false;
  }
}

export async function closeCache() {
  try {
    if (client?.isOpen) await client.quit();
  } catch (error) {
    console.warn(`Redis close skipped: ${error.message}`);
  }
}
