import sharp from "sharp";
import fs from "fs";
import path from "path";

async function generatePngIcons() {
  const publicIconsDir = path.join(process.cwd(), "public", "icons");
  const svg192Path = path.join(publicIconsDir, "icon-192.svg");
  const svg512Path = path.join(publicIconsDir, "icon-512.svg");
  const svgMaskablePath = path.join(publicIconsDir, "icon-maskable.svg");

  const svg192Buffer = fs.readFileSync(svg192Path);
  const svg512Buffer = fs.readFileSync(svg512Path);
  const svgMaskableBuffer = fs.existsSync(svgMaskablePath) ? fs.readFileSync(svgMaskablePath) : svg512Buffer;

  // 192x192 PNG
  await sharp(svg192Buffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicIconsDir, "icon-192.png"));
  console.log("Generated icon-192.png");

  // 512x512 PNG
  await sharp(svg512Buffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicIconsDir, "icon-512.png"));
  console.log("Generated icon-512.png");

  // 512x512 Maskable PNG
  await sharp(svgMaskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicIconsDir, "icon-maskable.png"));
  console.log("Generated icon-maskable.png");
}

generatePngIcons().catch(console.error);
