"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const projectRoot = path.join(__dirname, "..");
const outputDirectory = path.join(projectRoot, "assets", "installer");
const appIconPath = path.join(projectRoot, "icon.png");

const palette = {
  ink: [8, 5, 18],
  midnight: [20, 10, 40],
  violet: [109, 40, 217],
  purple: [139, 61, 255],
  lavender: [213, 175, 255],
  white: [250, 247, 255],
};

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(left, right, amount) {
  return left.map((channel, index) =>
    clampByte(channel + (right[index] - channel) * amount),
  );
}

function createCanvas(width, height) {
  return {
    width,
    height,
    pixels: Buffer.alloc(width * height * 3),
  };
}

function pixelOffset(canvas, x, y) {
  return (y * canvas.width + x) * 3;
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = pixelOffset(canvas, x, y);
  canvas.pixels[offset] = clampByte(color[0]);
  canvas.pixels[offset + 1] = clampByte(color[1]);
  canvas.pixels[offset + 2] = clampByte(color[2]);
}

function blendPixel(canvas, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = pixelOffset(canvas, x, y);
  canvas.pixels[offset] = clampByte(
    canvas.pixels[offset] + (color[0] - canvas.pixels[offset]) * alpha,
  );
  canvas.pixels[offset + 1] = clampByte(
    canvas.pixels[offset + 1] + (color[1] - canvas.pixels[offset + 1]) * alpha,
  );
  canvas.pixels[offset + 2] = clampByte(
    canvas.pixels[offset + 2] + (color[2] - canvas.pixels[offset + 2]) * alpha,
  );
}

function fillGradient(canvas, top, bottom) {
  for (let y = 0; y < canvas.height; y += 1) {
    const amount = canvas.height === 1 ? 0 : y / (canvas.height - 1);
    const color = mix(top, bottom, amount);
    for (let x = 0; x < canvas.width; x += 1) {
      setPixel(canvas, x, y, color);
    }
  }
}

function radialGlow(canvas, centerX, centerY, radius, color, strength = 1) {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(canvas.width - 1, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(canvas.height - 1, Math.ceil(centerY + radius));
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance > radius) continue;
      const falloff = 1 - distance / radius;
      blendPixel(canvas, x, y, color, falloff * falloff * strength);
    }
  }
}

function fillRect(canvas, x, y, width, height, color, alpha = 1) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (alpha === 1) setPixel(canvas, px, py, color);
      else blendPixel(canvas, px, py, color, alpha);
    }
  }
}

function fillCircle(canvas, centerX, centerY, radius, color, alpha = 1) {
  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
    for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radius ** 2) continue;
      if (alpha === 1) setPixel(canvas, x, y, color);
      else blendPixel(canvas, x, y, color, alpha);
    }
  }
}

function roundedRect(canvas, x, y, width, height, radius, color, alpha = 1) {
  fillRect(canvas, x + radius, y, width - radius * 2, height, color, alpha);
  fillRect(canvas, x, y + radius, radius, height - radius * 2, color, alpha);
  fillRect(canvas, x + width - radius, y + radius, radius, height - radius * 2, color, alpha);
  fillCircle(canvas, x + radius, y + radius, radius, color, alpha);
  fillCircle(canvas, x + width - radius - 1, y + radius, radius, color, alpha);
  fillCircle(canvas, x + radius, y + height - radius - 1, radius, color, alpha);
  fillCircle(canvas, x + width - radius - 1, y + height - radius - 1, radius, color, alpha);
}

function drawAppIcon(canvas, icon, left, top) {
  for (let y = 0; y < icon.height; y += 1) {
    for (let x = 0; x < icon.width; x += 1) {
      const offset = (y * icon.width + x) * 4;
      blendPixel(
        canvas,
        left + x,
        top + y,
        [icon.pixels[offset], icon.pixels[offset + 1], icon.pixels[offset + 2]],
        icon.pixels[offset + 3] / 255,
      );
    }
  }
}

const glyphs = {
  S: ["11111", "10000", "11111", "00001", "11111"],
  P: ["11110", "10001", "11110", "10000", "10000"],
  I: ["11111", "00100", "00100", "00100", "11111"],
  C: ["11111", "10000", "10000", "10000", "11111"],
  E: ["11111", "10000", "11110", "10000", "11111"],
};

function drawWord(canvas, word, x, y, scale, color) {
  let cursor = x;
  for (const character of word) {
    const rows = glyphs[character];
    if (!rows) continue;
    rows.forEach((row, rowIndex) => {
      [...row].forEach((value, columnIndex) => {
        if (value === "1") {
          fillRect(
            canvas,
            cursor + columnIndex * scale,
            y + rowIndex * scale,
            scale,
            scale,
            color,
          );
        }
      });
    });
    cursor += 6 * scale;
  }
}

function drawWaveform(canvas, y, color) {
  const heights = [10, 18, 27, 14, 34, 22, 43, 28, 18, 36, 25, 14, 21, 11];
  const barWidth = 4;
  const gap = 5;
  const totalWidth = heights.length * barWidth + (heights.length - 1) * gap;
  let x = Math.round((canvas.width - totalWidth) / 2);
  heights.forEach((height, index) => {
    const alpha = 0.42 + (index / heights.length) * 0.45;
    roundedRect(canvas, x, y - Math.round(height / 2), barWidth, height, 2, color, alpha);
    x += barWidth + gap;
  });
}

function addTexture(canvas) {
  let seed = 0x5f3759df;
  for (let index = 0; index < Math.floor(canvas.width * canvas.height * 0.012); index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % canvas.width;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % canvas.height;
    blendPixel(canvas, x, y, palette.lavender, 0.2);
  }
}

function encodeBmp24(canvas) {
  const rowBytes = canvas.width * 3;
  const paddedRowBytes = (rowBytes + 3) & ~3;
  const pixelBytes = paddedRowBytes * canvas.height;
  const output = Buffer.alloc(54 + pixelBytes);

  output.write("BM", 0, 2, "ascii");
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(canvas.width, 18);
  output.writeInt32LE(canvas.height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(pixelBytes, 34);
  output.writeInt32LE(2835, 38);
  output.writeInt32LE(2835, 42);

  for (let y = 0; y < canvas.height; y += 1) {
    const sourceY = canvas.height - 1 - y;
    const targetRow = 54 + y * paddedRowBytes;
    for (let x = 0; x < canvas.width; x += 1) {
      const source = pixelOffset(canvas, x, sourceY);
      const target = targetRow + x * 3;
      output[target] = canvas.pixels[source + 2];
      output[target + 1] = canvas.pixels[source + 1];
      output[target + 2] = canvas.pixels[source];
    }
  }
  return output;
}

function createSidebar(icon) {
  const canvas = createCanvas(164, 314);
  fillGradient(canvas, palette.ink, palette.midnight);
  radialGlow(canvas, 115, 64, 135, palette.violet, 0.48);
  radialGlow(canvas, 18, 264, 100, palette.purple, 0.2);
  addTexture(canvas);
  drawAppIcon(canvas, icon, Math.round((canvas.width - icon.width) / 2), 62);
  drawWord(canvas, "SPICE", 22, 175, 4, palette.white);
  fillRect(canvas, 22, 202, 116, 2, palette.purple, 0.82);
  drawWaveform(canvas, 266, palette.lavender);
  fillRect(canvas, 163, 0, 1, 314, palette.purple, 0.55);
  return canvas;
}

function createHeader(icon) {
  const canvas = createCanvas(150, 57);
  fillGradient(canvas, palette.ink, palette.midnight);
  radialGlow(canvas, 28, 27, 50, palette.violet, 0.58);
  radialGlow(canvas, 132, 10, 48, palette.purple, 0.28);
  addTexture(canvas);
  drawAppIcon(canvas, icon, 8, Math.round((canvas.height - icon.height) / 2));
  drawWord(canvas, "SPICE", 49, 17, 3, palette.white);
  fillRect(canvas, 49, 45, 88, 2, palette.purple, 0.82);
  return canvas;
}

async function resizedAppIcon(size) {
  const { data, info } = await sharp(appIconPath)
    .resize(size, size, { fit: "contain" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, pixels: data };
}

async function main() {
  const [sidebarIcon, headerIcon] = await Promise.all([
    resizedAppIcon(58),
    resizedAppIcon(34),
  ]);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "installerSidebar.bmp"),
    encodeBmp24(createSidebar(sidebarIcon)),
  );
  fs.writeFileSync(
    path.join(outputDirectory, "installerHeader.bmp"),
    encodeBmp24(createHeader(headerIcon)),
  );
  process.stdout.write(`Generated branded installer artwork in ${outputDirectory}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
