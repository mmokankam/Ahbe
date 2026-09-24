import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, ImageData, loadImage } from 'canvas';
import aseprite from 'aseprite';

const { parse } = aseprite;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.resolve(
  process.argv[2] || path.join(PROJECT_DIR, '..', 'Pixel Crawler - Free Pack')
);
const OUTPUT_DIR = path.resolve(
  process.argv[3] || path.join(PROJECT_DIR, 'public', 'assets')
);
const FRAME_WIDTH = Number(process.env.PIXEL_CRAWLER_FRAME_WIDTH || 32);
const FRAME_HEIGHT = Number(process.env.PIXEL_CRAWLER_FRAME_HEIGHT || 32);
const SLICE_SHEETS = process.env.PIXEL_CRAWLER_SLICE_SHEETS === 'true';
const PADDING = 2;
const MAX_ATLAS_WIDTH = 4096;
const INPUT_DIRS = [
  'Environment/Props',
  'Environment/Structures',
  'Entities',
  'Weapons',
  'MockUps'
];
const ASEPRITE_DIRS = [...INPUT_DIRS, 'Environment/Tilesets'];
const TILESET_FILES = {
  floors: 'Floors_Tiles.png',
  water: 'Water_tiles.png',
  walls: 'Wall_Tiles.png',
  wallVariations: 'Wall_Variations.png',
  dungeon: 'Dungeon_Tiles.png'
};

function slugify(value) {
  return value
    .replace(/\.png$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

async function findPngFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findPngFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(entryPath);
    }
  }

  return files;
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

function createFrame(filename, x, y, width, height) {
  return {
    filename,
    frame: { x, y, w: width, h: height },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: width, h: height },
    sourceSize: { w: width, h: height }
  };
}

async function createAtlasEntries(files) {
  const entries = [];

  for (const filePath of files) {
    const image = await loadImage(filePath);
    const relativePath = path.relative(SOURCE_DIR, filePath);
    const baseName = slugify(relativePath.replaceAll(path.sep, '_'));
    const isSheet = SLICE_SHEETS && /-sheet\.png$/i.test(filePath);

    if (!isSheet) {
      entries.push({
        name: baseName,
        image,
        width: image.width,
        height: image.height
      });
      continue;
    }

    if (image.width % FRAME_WIDTH !== 0 || image.height % FRAME_HEIGHT !== 0) {
      throw new Error(
        `${relativePath} is ${image.width}x${image.height}, not divisible by ${FRAME_WIDTH}x${FRAME_HEIGHT}`
      );
    }

    for (let y = 0, frameIndex = 0; y < image.height; y += FRAME_HEIGHT) {
      for (let x = 0; x < image.width; x += FRAME_WIDTH, frameIndex += 1) {
        entries.push({
          name: `${baseName}_${String(frameIndex).padStart(2, '0')}`,
          image,
          sourceX: x,
          sourceY: y,
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT
        });
      }
    }
  }

  return entries;
}

function toImageData(pixels, width, height) {
  if (!pixels || !width || !height) {
    return null;
  }

  const buffer = Buffer.isBuffer(pixels) ? pixels : Uint8Array.from(pixels);
  return new ImageData(new Uint8ClampedArray(buffer), width, height);
}

async function createAsepriteEntries(files) {
  const entries = [];

  for (const filePath of files) {
    const data = parse(await fs.readFile(filePath), { inflate: true, clean: true });
    const relativePath = path.relative(SOURCE_DIR, filePath);
    const baseName = `aseprite_${slugify(relativePath.replaceAll(path.sep, '_'))}`;
    const frameEntries = Array.isArray(data.frames) ? data.frames : [];

    frameEntries.forEach((frame, frameIndex) => {
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

      entries.push({
        name: `${baseName}_${String(frameIndex).padStart(2, '0')}`,
        image: canvas,
        width,
        height
      });
    });
  }

  return entries;
}

async function findFiles(directory, extensions) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findFiles(entryPath, extensions));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files;
}

function packEntries(entries) {
  const sortedEntries = [...entries].sort((left, right) => right.height - left.height || right.width - left.width);
  const width = Math.min(
    MAX_ATLAS_WIDTH,
    Math.max(
      4096,
      nextPowerOfTwo(Math.max(...sortedEntries.map((entry) => entry.width + PADDING * 2)))
    )
  );
  let x = PADDING;
  let y = PADDING;
  let rowHeight = 0;

  for (const entry of sortedEntries) {
    if (x + entry.width + PADDING > width) {
      x = PADDING;
      y += rowHeight + PADDING;
      rowHeight = 0;
    }

    entry.x = x;
    entry.y = y;
    x += entry.width + PADDING;
    rowHeight = Math.max(rowHeight, entry.height + PADDING);
  }

  return { width, height: nextPowerOfTwo(y + rowHeight + PADDING), entries: sortedEntries };
}

async function writeAtlas(entries) {
  const packed = packEntries(entries);
  const canvas = createCanvas(packed.width, packed.height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, packed.width, packed.height);

  const frames = {};
  for (const entry of packed.entries) {
    context.drawImage(
      entry.image,
      entry.sourceX || 0,
      entry.sourceY || 0,
      entry.width,
      entry.height,
      entry.x,
      entry.y,
      entry.width,
      entry.height
    );
    frames[entry.name] = createFrame(entry.name, entry.x, entry.y, entry.width, entry.height);
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'pixel_crawler_environment_atlas.png'),
    canvas.toBuffer('image/png')
  );
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'pixel_crawler_environment_atlas.json'),
    `${JSON.stringify({
      frames,
      meta: {
        app: 'Ahh MMORPG',
        version: '1.0',
        image: 'pixel_crawler_environment_atlas.png',
        format: 'RGBA8888',
        size: { w: packed.width, h: packed.height },
        scale: '1'
      }
    }, null, 2)}\n`
  );
  return packed;
}

async function copyTilesets() {
  const tilesetDir = path.join(SOURCE_DIR, 'Environment', 'Tilesets');
  for (const [key, filename] of Object.entries(TILESET_FILES)) {
    await fs.copyFile(
      path.join(tilesetDir, filename),
      path.join(OUTPUT_DIR, `pixel_crawler_${key}_tileset.png`)
    );
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const files = [];
  for (const directory of INPUT_DIRS) {
    files.push(...await findPngFiles(path.join(SOURCE_DIR, directory)));
  }
  const asepriteFiles = [];
  for (const directory of ASEPRITE_DIRS) {
    asepriteFiles.push(...await findFiles(path.join(SOURCE_DIR, directory), new Set(['.ase', '.aseprite'])));
  }

  const entries = [
    ...await createAtlasEntries(files),
    ...await createAsepriteEntries(asepriteFiles)
  ];
  const packed = await writeAtlas(entries);
  await copyTilesets();
  console.log(`Pixel Crawler atlas written: ${entries.length} frames, ${packed.width}x${packed.height}`);
  console.log(`Tilesets copied: ${Object.keys(TILESET_FILES).length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});