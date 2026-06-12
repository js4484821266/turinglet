import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from '../db/common.js';

export const ADMIN_BITMAP_WIDTH = 64;
export const ADMIN_BITMAP_HEIGHT = 64;

const PIXEL_OFFSET = 62;
const ROW_BYTES = Math.ceil(ADMIN_BITMAP_WIDTH / 8);
const ROW_STRIDE = Math.ceil(ROW_BYTES / 4) * 4;
const PIXEL_BYTES = ROW_STRIDE * ADMIN_BITMAP_HEIGHT;
export const ADMIN_BITMAP_SIZE = PIXEL_OFFSET + PIXEL_BYTES;
const QUIET_ZONE = 4;
const FINDER_SIZE = 7;
const ALIGNMENT_SIZE = 5;

function setModule(bitmap: Buffer, x: number, y: number, black: boolean): void {
  const bmpRow = ADMIN_BITMAP_HEIGHT - 1 - y;
  const byteOffset = PIXEL_OFFSET + bmpRow * ROW_STRIDE + Math.floor(x / 8);
  const mask = 1 << (7 - (x % 8));
  const currentByte = bitmap.readUInt8(byteOffset);
  bitmap.writeUInt8(black ? currentByte & ~mask : currentByte | mask, byteOffset);
}

function drawFinderPattern(bitmap: Buffer, left: number, top: number): void {
  for (let y = -1; y <= FINDER_SIZE; y += 1) {
    for (let x = -1; x <= FINDER_SIZE; x += 1) {
      const inFinder = x >= 0 && x < FINDER_SIZE && y >= 0 && y < FINDER_SIZE;
      const black =
        inFinder &&
        (x === 0 || x === FINDER_SIZE - 1 || y === 0 || y === FINDER_SIZE - 1 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      setModule(bitmap, left + x, top + y, black);
    }
  }
}

function drawTimingPatterns(bitmap: Buffer, farFinder: number): void {
  const timingAxis = QUIET_ZONE + FINDER_SIZE - 1;
  const timingStart = QUIET_ZONE + FINDER_SIZE + 1;
  const timingEnd = farFinder - 2;

  for (let offset = 0; timingStart + offset <= timingEnd; offset += 1) {
    const black = offset % 2 === 0;
    setModule(bitmap, timingStart + offset, timingAxis, black);
    setModule(bitmap, timingAxis, timingStart + offset, black);
  }
}

function drawAlignmentPattern(bitmap: Buffer, left: number, top: number): void {
  for (let y = -1; y <= ALIGNMENT_SIZE; y += 1) {
    for (let x = -1; x <= ALIGNMENT_SIZE; x += 1) {
      const inPattern = x >= 0 && x < ALIGNMENT_SIZE && y >= 0 && y < ALIGNMENT_SIZE;
      const black =
        inPattern &&
        (x === 0 || x === ALIGNMENT_SIZE - 1 || y === 0 || y === ALIGNMENT_SIZE - 1 || (x === 2 && y === 2));
      setModule(bitmap, left + x, top + y, black);
    }
  }
}

function drawPseudoQrModules(bitmap: Buffer): void {
  bitmap.fill(255, PIXEL_OFFSET);
  const randomBits = crypto.randomBytes(ADMIN_BITMAP_WIDTH * ADMIN_BITMAP_HEIGHT / 8);

  for (let y = QUIET_ZONE; y < ADMIN_BITMAP_HEIGHT - QUIET_ZONE; y += 1) {
    for (let x = QUIET_ZONE; x < ADMIN_BITMAP_WIDTH - QUIET_ZONE; x += 1) {
      const index = y * ADMIN_BITMAP_WIDTH + x;
      const randomByte = randomBits.readUInt8(Math.floor(index / 8));
      const black = (randomByte & (1 << (index % 8))) !== 0;
      setModule(bitmap, x, y, black);
    }
  }

  const farFinder = ADMIN_BITMAP_WIDTH - QUIET_ZONE - FINDER_SIZE;
  drawTimingPatterns(bitmap, farFinder);
  drawFinderPattern(bitmap, QUIET_ZONE, QUIET_ZONE);
  drawFinderPattern(bitmap, farFinder, QUIET_ZONE);
  drawFinderPattern(bitmap, QUIET_ZONE, farFinder);
  drawAlignmentPattern(bitmap, farFinder - 7, farFinder - 7);
}

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
  drawPseudoQrModules(bitmap);
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
