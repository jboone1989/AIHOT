// Rebuild all raster brand assets from the owned vector mark.
// Run: node scripts/generate-livingruntime-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = await readFile(new URL("../site/brand/logo.svg", import.meta.url));
const root = new URL("../site/brand/", import.meta.url);
const image = async (size) => sharp(source).resize(size, size).png().toBuffer();
for (const [file,size] of [["icon.png",512],["icon-192.png",192],["apple-icon.png",180]]) {
  await writeFile(new URL(file,root),await image(size));
}
const sizes = [16,32,48];
const images = await Promise.all(sizes.map(image));
const header = Buffer.alloc(6 + sizes.length*16);
header.writeUInt16LE(0,0);
header.writeUInt16LE(1,2);
header.writeUInt16LE(sizes.length,4);
let offset = header.length;
images.forEach((payload,i) => {
  const o=6+i*16;
  header.writeUInt8(sizes[i],o);
  header.writeUInt8(sizes[i],o+1);
  header.writeUInt8(0,o+2);
  header.writeUInt8(0,o+3);
  header.writeUInt16LE(1,o+4);
  header.writeUInt16LE(32,o+6);
  header.writeUInt32LE(payload.length,o+8);
  header.writeUInt32LE(offset,o+12);
  offset += payload.length;
});
await writeFile(new URL("favicon.ico",root),Buffer.concat([header,...images]));
console.log("LivingRuntime assets regenerated from site/brand/logo.svg");
