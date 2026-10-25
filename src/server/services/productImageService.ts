import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_PRODUCT_IMAGE_BYTES } from '../../shared/productImages.ts';

export const productImageDirectory = process.env.VERIPAY_UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads', 'products');

export async function saveProductImage(bytes: Buffer, mimeType: string): Promise<string> {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('Choose an image to upload');
  if (bytes.length > MAX_PRODUCT_IMAGE_BYTES) throw new Error('Images must be 5 MB or smaller');
  let extension: string | undefined;
  if (mimeType === 'image/png' && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR') extension = 'png';
  if (mimeType === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) extension = 'jpg';
  if (mimeType === 'image/webp' && bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') extension = 'webp';
  if (!extension) throw new Error('Upload a valid JPG, PNG, or WebP image');
  const filename = `${randomUUID()}.${extension}`;
  await mkdir(productImageDirectory, { recursive: true });
  await writeFile(path.join(productImageDirectory, filename), bytes, { flag: 'wx' });
  return `/uploads/products/${filename}`;
}
