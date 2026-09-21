const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_IMAGE_PATH = 'C:/Users/DELL/.gemini/antigravity-ide/brain/ffd27750-69be-4dd8-93f0-54c1b40941a9/.user_uploaded/media_1789123527060.jpg';

async function main() {
  console.log('Loading source image from:', SOURCE_IMAGE_PATH);
  const src = sharp(SOURCE_IMAGE_PATH);
  const meta = await src.metadata();
  console.log(`Source dimensions: ${meta.width}x${meta.height}`);

  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;

  // Target background color sampled from logo interior
  const targetR = 0;
  const targetG = 180;
  const targetB = 254;

  // 1. Create Full-Bleed Master (Solid background edge-to-edge for maskable & apple-touch-icon)
  const fullBleedBuf = Buffer.alloc(width * height * 4);
  
  // 2. Create Squircle Master (Transparent outside squircle for "any" icons)
  const squircleBuf = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inIdx = (y * width + x) * 3;
      const outIdx = (y * width + x) * 4;
      const r = data[inIdx];
      const g = data[inIdx + 1];
      const b = data[inIdx + 2];

      const isCornerRegion = (x < 180 || x > width - 180 || y < 180 || y > height - 180);

      // FULL BLEED MASTER:
      // If in corner/edge region and fading to black (b < 180), fill with target background blue
      if (isCornerRegion && b < 180) {
        fullBleedBuf[outIdx] = targetR;
        fullBleedBuf[outIdx + 1] = targetG;
        fullBleedBuf[outIdx + 2] = targetB;
        fullBleedBuf[outIdx + 3] = 255;
      } else {
        fullBleedBuf[outIdx] = r;
        fullBleedBuf[outIdx + 1] = g;
        fullBleedBuf[outIdx + 2] = b;
        fullBleedBuf[outIdx + 3] = 255;
      }

      // SQUIRCLE MASTER:
      // Replace outer black pixels with transparency, smooth anti-aliased edge
      if (isCornerRegion) {
        if (b < 15) {
          // Pure black outer area -> transparent
          squircleBuf[outIdx] = 0;
          squircleBuf[outIdx + 1] = 0;
          squircleBuf[outIdx + 2] = 0;
          squircleBuf[outIdx + 3] = 0;
        } else if (b < 240) {
          // Anti-aliased transition edge
          const alpha = Math.min(255, Math.max(0, Math.round((b / 250) * 255)));
          squircleBuf[outIdx] = targetR;
          squircleBuf[outIdx + 1] = targetG;
          squircleBuf[outIdx + 2] = targetB;
          squircleBuf[outIdx + 3] = alpha;
        } else {
          squircleBuf[outIdx] = r;
          squircleBuf[outIdx + 1] = g;
          squircleBuf[outIdx + 2] = b;
          squircleBuf[outIdx + 3] = 255;
        }
      } else {
        squircleBuf[outIdx] = r;
        squircleBuf[outIdx + 1] = g;
        squircleBuf[outIdx + 2] = b;
        squircleBuf[outIdx + 3] = 255;
      }
    }
  }

  const fullBleedSharp = sharp(fullBleedBuf, { raw: { width, height, channels: 4 } });
  const squircleSharp = sharp(squircleBuf, { raw: { width, height, channels: 4 } });

  const tasks = [
    // Marketing Website (Root domain)
    {
      sharpInst: fullBleedSharp,
      size: 180,
      dest: path.resolve(__dirname, '../public/apple-touch-icon.png')
    },
    {
      sharpInst: squircleSharp,
      size: 192,
      dest: path.resolve(__dirname, '../public/icon-192.png')
    },
    {
      sharpInst: squircleSharp,
      size: 512,
      dest: path.resolve(__dirname, '../public/icon-512.png')
    },
    {
      sharpInst: fullBleedSharp,
      size: 192,
      dest: path.resolve(__dirname, '../public/icon-192-maskable.png')
    },
    {
      sharpInst: fullBleedSharp,
      size: 512,
      dest: path.resolve(__dirname, '../public/icon-512-maskable.png')
    },

    // Frontend PWA App (app.edrops.in)
    {
      sharpInst: fullBleedSharp,
      size: 180,
      dest: path.resolve(__dirname, '../../frontend/public/apple-touch-icon.png')
    },
    {
      sharpInst: squircleSharp,
      size: 192,
      dest: path.resolve(__dirname, '../../frontend/public/icon-192.png')
    },
    {
      sharpInst: squircleSharp,
      size: 512,
      dest: path.resolve(__dirname, '../../frontend/public/icon-512.png')
    },
    {
      sharpInst: fullBleedSharp,
      size: 192,
      dest: path.resolve(__dirname, '../../frontend/public/icon-192-maskable.png')
    },
    {
      sharpInst: fullBleedSharp,
      size: 512,
      dest: path.resolve(__dirname, '../../frontend/public/icon-512-maskable.png')
    },
    {
      sharpInst: squircleSharp,
      size: 512,
      dest: path.resolve(__dirname, '../../frontend/public/logo-pwa.png')
    },

    // Frontend Assets (bundled with app)
    {
      sharpInst: squircleSharp,
      size: 192,
      dest: path.resolve(__dirname, '../../frontend/src/assets/icon-192.png')
    },
    {
      sharpInst: squircleSharp,
      size: 512,
      dest: path.resolve(__dirname, '../../frontend/src/assets/icon-512.png')
    },
    {
      sharpInst: squircleSharp,
      size: 512,
      dest: path.resolve(__dirname, '../../frontend/src/assets/logo-pwa.png')
    }
  ];

  for (const task of tasks) {
    await task.sharpInst
      .clone()
      .resize(task.size, task.size, { kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toFile(task.dest);
    console.log(`Generated: ${path.relative(path.resolve(__dirname, '../..'), task.dest)} (${task.size}x${task.size})`);
  }

  console.log('All PWA icon assets generated successfully!');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
