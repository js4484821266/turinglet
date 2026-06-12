import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from '../db/common.js';

export const ADMIN_BITMAP_WIDTH = 1024;
export const ADMIN_BITMAP_HEIGHT = 1;
export const ADMIN_BITMAP_SIZE = 190;

const PIXEL_OFFSET = 62;
const PIXEL_BYTES = ADMIN_BITMAP_WIDTH / 8;

export function createRandomAdminBitmap(): Buffer {
  const bitmap = Buffer.alloc(ADMIN_BITMAP_SIZE);
  bitmap.write('BM', 0, 'ascii');
  bitmap.writeUInt32LE(ADMIN_BITMAP_SIZE, 2);
  bitmap.writeUInt32LE(PIXEL_OFFSET, 10);
  bitmap.writeUInt32LE(40, 14);
  bitmap.writeInt32LE(ADMIN_BITMAP_WIDTH, 18);
  bitmap.writeInt32LE(ADMIN_BITMAP_HEIGHT, 22);
  bitmap.writeUInt16LE(1, 26);
  bitmap.writeUInt16LE(1, 28);
  bitmap.writeUInt32LE(PIXEL_BYTES, 34);
  bitmap.writeInt32LE(2835, 38);
  bitmap.writeInt32LE(2835, 42);
  bitmap.writeUInt32LE(2, 46);
  bitmap.writeUInt32LE(2, 50);

  bitmap.fill(0, 54, 58);
  bitmap[58] = 255;
  bitmap[59] = 255;
  bitmap[60] = 255;
  crypto.randomFillSync(bitmap, PIXEL_OFFSET, PIXEL_BYTES);
  return bitmap;
}

export function isValidAdminBitmap(bitmap: Buffer): boolean {
  if (bitmap.length !== ADMIN_BITMAP_SIZE || bitmap.toString('ascii', 0, 2) !== 'BM') return false;
  return (
    bitmap.readUInt32LE(10) === PIXEL_OFFSET &&
    bitmap.readUInt32LE(14) === 40 &&
    bitmap.readInt32LE(18) === ADMIN_BITMAP_WIDTH &&
    bitmap.readInt32LE(22) === ADMIN_BITMAP_HEIGHT &&
    bitmap.readUInt16LE(26) === 1 &&
    bitmap.readUInt16LE(28) === 1 &&
    bitmap.readUInt32LE(30) === 0
  );
}

export function adminBitmapDigest(bitmap: Buffer): Buffer {
  return crypto.createHash('sha256').update(bitmap).digest();
}

export function createAndSaveAdminBitmap(): Buffer {
  const bitmap = createRandomAdminBitmap();
  const repoRoot = findRepoRoot(process.cwd());
  const outputPath = path.join(repoRoot, 'runtime', 'achrai-admin-key.bmp');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bitmap);
  console.log(`Admin bitmap key created: ${outputPath}`);
  return bitmap;
}
