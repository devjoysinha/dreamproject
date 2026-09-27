import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../src/db.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(currentDirectory, '../database/schema.sql'), 'utf8');

try {
  await pool.query(schema);
  console.log('Database schema is current.');
} finally {
  await closePool();
}
