import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, ImageData } from 'canvas';
import aseprite from 'aseprite';

const { parse } = aseprite;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, '..');
const sourceDir = path.resolve(projectDir, '..', 'Pixel Crawler - Free Pack');
const outputDir = path.resolve(projectDir, '..', 'PNG-EXPORT', 'Pixel-Crawler-PNG');

function toPngPath(relativePath, suffix = '') {
  return path.join(outputDir, relativePath.replace(/\.(png|ase|aseprite)$/i, `${suffix}.png`));
}

function toImageData(pixels, width, height) {
  if (!pixels || !width || !height) {
    return null;
  }

  const buffer = Buffer.isBuffer(pixels) ? pixels : Uint8Array.from(pixels);
  return new ImageData(new Uint8ClampedArray(buffer), width, height);
}

async function findFiles(directory, extensions) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findFiles(filePath, extensions));
    } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(filePath);
    }
  }

  return files;
}

async function copyPngs() {
  const files = await findFiles(sourceDir, new Set(['.png']));
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath);
    const destination = toPngPath(relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(filePath, destination);
  }
  return files.length;
}

async function convertAseprite(filePath) {
  const data = parse(await fs.readFile(filePath), { inflate: true, clean: true });
  const frames = [];

  for (const frame of data.frames || []) {
    const width = Number(data.header?.width) || Number(frame.width) || Number(frame.header?.width) || 1;
    const height = Number(data.header?.height) || Number(frame.height) || Number(frame.header?.height) || 1;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;

    for (const chunk of frame.chunks || []) {
      const cel = chunk?.data;
      if (!cel) {
        continue;
      }

      const celWidth = Number(cel.width) || Number(cel.w) || 0;
      const celHeight = Number(cel.height) || Number(cel.h) || 0;
      const imageData = toImageData(
        cel.pixels ?? cel.pixelData ?? cel.pixelsCompressed,
        celWidth,
        celHeight
      );
      if (imageData) {
        context.putImageData(imageData, Number(cel.x) || 0, Number(cel.y) || 0);
      }
    }

    frames.push(canvas);
  }

  if (!frames.length) {
    return false;
  }

  const frameWidth = Math.max(...frames.map((frame) => frame.width));
  const frameHeight = Math.max(...frames.map((frame) => frame.height));
  const sheet = createCanvas(frameWidth * frames.length, frameHeight);
  const context = sheet.getContext('2d');
  context.imageSmoothingEnabled = false;
  frames.forEach((frame, index) => {
    context.drawImage(frame, index * frameWidth, 0);
  });

  const relativePath = path.relative(sourceDir, filePath);
  const destination = toPngPath(relativePath, '-converted');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, sheet.toBuffer('image/png'));
  return true;
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const copiedPngs = await copyPngs();
  const asepriteFiles = await findFiles(sourceDir, new Set(['.ase', '.aseprite']));
  let convertedAseprites = 0;

  for (const filePath of asepriteFiles) {
    if (await convertAseprite(filePath)) {
      convertedAseprites += 1;
    }
  }

  console.log(`PNG files copied: ${copiedPngs}`);
  console.log(`Aseprite files converted: ${convertedAseprites}`);
  console.log(`Export directory: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});