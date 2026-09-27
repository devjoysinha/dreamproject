import { createHash } from 'node:crypto';

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'model';
}

export function stableId(prefix, value) {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}
