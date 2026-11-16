// Checks the built site in dist/ and fails the build if something is wrong.
// Runs automatically after `astro build` (see "build" in package.json).
//
//   1. No email address other than the community address from src/content/site/site.yaml
//      (also catches spellings such as "name (at) unisg.ch").
//   2. No meeting links (Teams, Zoom) and no links to SharePoint.
//   3. Every internal link and every file under /media/, /brand/ … exists.
//   4. The date at the start of an event or newsletter file name is the date in the file.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const DIST = "dist";
const problems = [];
const problem = (where, what) => problems.push(`${where}: ${what}`);

async function* walk(dir, ext) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path, ext);
    else if (entry.name.endsWith(ext)) yield path;
  }
}

const exists = (path) => stat(path).then(() => true, () => false);

// --- allowlist --------------------------------------------------------------------------
const siteYaml = await readFile("src/content/site/site.yaml", "utf8");
const communityEmail = siteYaml.match(/^email:\s*["']?([^"'\s]+)/m)?.[1]?.toLowerCase();
if (!communityEmail) {
  console.error("check-dist: no email found in src/content/site/site.yaml");
  process.exit(1);
}

// --- built pages ------------------------------------------------------------------------
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const EMAIL_SPELLED = /[a-z0-9._%+-]+\s*(?:\(at\)|\[at\]|\{at\})\s*[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const NOT_A_DOMAIN = /\.(png|jpe?g|webp|svg|gif|css|js|pdf)$/i;
const FORBIDDEN_LINKS = [
  [/teams\.microsoft\.com|teams\.live\.com/i, "link to Microsoft Teams"],
  [/[a-z0-9-]+\.sharepoint\.com/i, "link to SharePoint"],
  [/zoom\.us\/(j|my|w)\//i, "Zoom meeting link"],
];

let pages = 0;
for await (const file of walk(DIST, ".html")) {
  pages++;
  const where = "/" + relative(DIST, file).replace(/index\.html$/, "");
  const raw = await readFile(file, "utf8");
  const html = raw.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  const decoded = html.replace(/&#64;|&#x40;|&commat;/gi, "@").replace(/%40/g, "@");

  const addresses = new Set();
  for (const m of decoded.match(EMAIL) ?? []) {
    if (!NOT_A_DOMAIN.test(m)) addresses.add(m.toLowerCase());
  }
  for (const m of decoded.match(EMAIL_SPELLED) ?? []) addresses.add(m.toLowerCase());
  for (const address of addresses) {
    if (address !== communityEmail) problem(where, `email address ${address}`);
  }

  for (const [pattern, label] of FORBIDDEN_LINKS) {
    if (pattern.test(html)) problem(where, label);
  }

  const targets = new Set();
  for (const m of html.matchAll(/\b(?:href|src|poster)="(\/[^"#?]*)/g)) targets.add(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content="https:\/\/impact-scholar\.community(\/[^"#?]*)"/g)) {
    targets.add(m[1]);
  }
  for (const target of targets) {
    if (target.startsWith("//")) continue;
    const path = join(DIST, decodeURIComponent(target));
    const ok = target.endsWith("/")
      ? await exists(join(path, "index.html"))
      : (await exists(path)) || (await exists(join(path, "index.html")));
    if (!ok) problem(where, `link to ${target}, which does not exist`);
  }
}

// --- content files ----------------------------------------------------------------------
for (const collection of ["events", "newsletters"]) {
  const dir = join("src/content", collection);
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".md")) continue;
    const where = join(dir, name);
    const inName = name.match(/^(\d{4}-\d{2}-\d{2})-[a-z0-9-]+\.md$/)?.[1];
    if (!inName) {
      problem(where, "file name must look like 2026-11-30-short-title.md (lowercase, digits, hyphens)");
      continue;
    }
    const text = await readFile(where, "utf8");
    const inFile = text.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1];
    if (inFile && inFile !== inName) {
      problem(where, `file name says ${inName}, but date in the file is ${inFile}`);
    }
  }
}

if (problems.length) {
  console.error(`\ncheck-dist: ${problems.length} problem(s) found\n`);
  for (const p of problems) console.error("  ✗ " + p);
  console.error("\nFix the content file behind each line and build again. See docs/CONTENT-MODEL.md.\n");
  process.exit(1);
}
console.log(`check-dist: ${pages} pages checked, no problems.`);
