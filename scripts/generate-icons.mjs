/**
 * Rasterise web/public/icons/favicon.svg into the PNG sizes the manifest and
 * iOS need. Run with `node scripts/generate-icons.mjs` after editing the SVG.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const iconDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/public/icons');
const source = await fs.readFile(path.join(iconDir, 'favicon.svg'));

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  // Maskable icons are cropped to a circle by some launchers, so the glyph
  // needs breathing room inside the safe zone.
  { file: 'icon-512-maskable.png', size: 512, padding: 64 },
  // iOS composites the home-screen icon onto white and applies its own mask.
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
];

for (const { file, size, padding } of targets) {
  const inner = size - padding * 2;
  const glyph = await sharp(source, { density: 512 }).resize(inner, inner).png().toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: padding > 0 ? { r: 0, g: 96, b: 223, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: glyph, top: padding, left: padding }])
    .png()
    .toFile(path.join(iconDir, file));

  console.log(`wrote ${file} (${size}x${size})`);
}
