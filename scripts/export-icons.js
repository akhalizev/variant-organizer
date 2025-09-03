/*
  Simple icon exporter: converts icon.svg to PNGs at common sizes.
  Requires: sharp
*/
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const svgPath = path.join(ROOT, 'icon.svg');
const outDir = ROOT;
const sizes = [48, 64, 96, 128, 256];

async function run() {
  if (!fs.existsSync(svgPath)) {
    console.error('icon.svg not found at', svgPath);
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath);
  for (const size of sizes) {
    const outPath = path.join(outDir, `icon-${size}.png`);
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log('Wrote', outPath);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
