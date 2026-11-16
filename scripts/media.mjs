// Prepares images under public/media/ for the web: at most 1600 px wide, re-encoded,
// all metadata removed (phone photos carry GPS coordinates). Safe to run repeatedly:
// files that are already fine are left untouched.
//
//   npm run media            process everything under public/media/
//   npm run media -- --check report only, exit 1 if something needs processing
import { readdir, stat, rename, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import sharp from "sharp";

const ROOT = "public/media";
export const MAX_WIDTH = 1600;
export const MAX_BYTES = 600 * 1024;
const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const checkOnly = process.argv.includes("--check");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (IMAGE.has(extname(entry.name).toLowerCase())) yield path;
  }
}

async function reasons(path) {
  const meta = await sharp(path).metadata();
  const { size } = await stat(path);
  const why = [];
  if ((meta.width ?? 0) > MAX_WIDTH) why.push(`${meta.width} px wide`);
  if (meta.exif || meta.xmp || meta.iptc) why.push("has metadata");
  if (size > MAX_BYTES) why.push(`${Math.round(size / 1024)} KB`);
  return why;
}

async function encode(path, quality) {
  const ext = extname(path).toLowerCase();
  // rotate() applies the EXIF orientation before the metadata is dropped
  let img = sharp(path).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (ext === ".png") img = img.png({ compressionLevel: 9, palette: quality < 80 });
  else if (ext === ".webp") img = img.webp({ quality });
  else img = img.jpeg({ quality, mozjpeg: true });
  return img.toBuffer();
}

let pending = 0;
for await (const path of walk(ROOT)) {
  const why = await reasons(path);
  if (why.length === 0) continue;
  pending++;
  if (checkOnly) {
    console.log(`needs processing: ${path} (${why.join(", ")})`);
    continue;
  }
  let buffer;
  for (const quality of [82, 74, 66, 58]) {
    buffer = await encode(path, quality);
    if (buffer.length <= MAX_BYTES) break;
  }
  const tmp = `${path}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, path);
  const note = buffer.length > MAX_BYTES ? "  STILL TOO LARGE, crop or use a smaller image" : "";
  console.log(`processed: ${path} (${why.join(", ")}) → ${Math.round(buffer.length / 1024)} KB${note}`);
}

if (checkOnly && pending > 0) {
  console.error(`\n${pending} image(s) need processing. Run: npm run media`);
  process.exit(1);
}
if (pending === 0) console.log("All images under public/media/ are fine.");
