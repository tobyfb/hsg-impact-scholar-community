// Turns a sent newsletter (.eml file, or the HTML exported from Brevo) into a Markdown
// draft for the archive. It does the mechanical part only:
//
//   - HTML → Markdown, email footer and invisible padding removed
//   - tracking links resolved to their real destination
//   - images saved to public/media/newsletters/<slug>/
//   - every email address except the community address removed
//   - links to Teams and SharePoint removed
//
// The draft is written to .import/ (not tracked by Git, because a raw newsletter can
// still contain things that must not be published). A person or an assistant then
// edits it into the house format (docs/CONTENT-MODEL.md) and moves it to
// src/content/newsletters/.
//
//   npm run import:newsletter -- path/to/mail.eml
//   npm run import:newsletter -- path/to/campaign.html --date 2027-03-02
//
// Options:
//   --date YYYY-MM-DD   day the newsletter was sent (required for .html input)
//   --slug some-name    file name without date; default is built from the subject
//   --drop-forms        also remove links to sign-up forms (for old issues: they are expired)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import PostalMime from "postal-mime";
import TurndownService from "turndown";
import sharp from "sharp";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dropForms = args.includes("--drop-forms");

if (!input) {
  console.error("Usage: npm run import:newsletter -- <file.eml|file.html> [--date YYYY-MM-DD] [--slug name] [--drop-forms]");
  process.exit(1);
}

const OUT_DIR = ".import";
const TRACKING_HOST = /(^|\.)(r\.[a-z0-9-]*brevo\.net|r\.mailin\.fr|sendibt\d*\.com|sendibm\d*\.com)$/i;
const INTERNAL_HOST = /(teams\.microsoft\.com|teams\.live\.com|sharepoint\.com|onedrive\.live\.com|1drv\.ms)$/i;
const FORM_HOST = /(forms\.office\.com|forms\.microsoft\.com|forms\.gle|docs\.google\.com|sibforms\.com)$/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const AUTO_ALT = /automatically generated|automatisch generiert|ein bild, das|a picture containing|description:/i;

// The one address that may stay: the community address from site.yaml.
const siteYaml = await readFile("src/content/site/site.yaml", "utf8");
const allowedEmail = (siteYaml.match(/^email:\s*(\S+)/m)?.[1] ?? "").toLowerCase();

// ---------- read the input ----------

const raw = await readFile(input);
let subject = "";
let sentDate;
let html = "";
let attachments = [];
let fromBrevo = false;

if (extname(input).toLowerCase() === ".eml") {
  const mail = await PostalMime.parse(raw);
  subject = mail.subject ?? "";
  sentDate = mail.date ? new Date(mail.date) : undefined;
  html = mail.html ?? `<pre>${mail.text ?? ""}</pre>`;
  attachments = mail.attachments ?? [];
  fromBrevo = /brevo|mailin\.fr|sendinblue/i.test(mail.messageId ?? "") || /maas\./i.test(mail.from?.address ?? "");
} else {
  html = raw.toString("utf8");
  subject = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  fromBrevo = true;
}

const dateOption = option("date");
if (dateOption) sentDate = new Date(`${dateOption}T12:00:00Z`);
if (!sentDate || Number.isNaN(sentDate.valueOf())) {
  console.error("Could not read the date. Pass it with --date YYYY-MM-DD.");
  process.exit(1);
}
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(sentDate);

// ---------- title and slug ----------

const stripEmoji = (s) =>
  s
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
const title = stripEmoji(subject) || "Newsletter";
const kebab = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const defaultSlug = kebab(title.replace(/HSG|Impact Scholar Community/gi, " ")).split("-").filter(Boolean).slice(0, 6).join("-");
const slug = `${day}-${option("slug") ?? (defaultSlug || "newsletter")}`;
const mediaDir = join("public/media/newsletters", slug);
const mediaUrl = `/media/newsletters/${slug}`;

const notes = [];

// ---------- clean the HTML ----------

html = html
  .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<o:p>\s*<\/o:p>/gi, "");

// ---------- links ----------

const hostOf = (href) => {
  try {
    return new URL(href).hostname;
  } catch {
    return "";
  }
};

async function resolveTracking(href) {
  let current = href;
  for (let hop = 0; hop < 4; hop++) {
    if (!TRACKING_HOST.test(hostOf(current))) return current;
    try {
      const res = await fetch(current, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(12000) });
      let next = res.headers.get("location");
      if (!next) {
        // Brevo answers with a small page that redirects by meta refresh or script
        const body = await res.text();
        next =
          body.match(/http-equiv="refresh"\s+content="[^;"]*;\s*(?:url=)?([^"]+)"/i)?.[1] ??
          body.match(/location\s*=\s*'([^']+)'/i)?.[1]?.replace(/\\\//g, "/");
        next = next?.replace(/&amp;/g, "&");
      }
      if (!next) return null;
      current = new URL(next, current).href;
    } catch {
      return null;
    }
  }
  return TRACKING_HOST.test(hostOf(current)) ? null : current;
}

const hrefs = [...new Set([...html.matchAll(/href="([^"]*)"/gi)].map((m) => m[1]))];
const linkMap = new Map(); // original href → final href, or "" to drop the link and keep its text
let unresolved = 0;
let internalRemoved = 0;
let formsFound = 0;
let unsubscribeLinks = 0;

for (const href of hrefs) {
  const decoded = href.replace(/&amp;/g, "&");
  if (!/^https?:/i.test(decoded)) {
    linkMap.set(href, ""); // mailto:, file:, relative paths, anchors
    continue;
  }
  let final = decoded;
  if (TRACKING_HOST.test(hostOf(decoded)) && /\/mk\/(mr|un)\//.test(decoded)) {
    linkMap.set(href, ""); // "view in browser" and "unsubscribe"
    continue;
  }
  if (TRACKING_HOST.test(hostOf(decoded))) {
    final = await resolveTracking(decoded);
    if (!final) {
      unresolved++;
      linkMap.set(href, "");
      continue;
    }
  }
  const host = hostOf(final);
  if (/unsubscribe|\/mk\/un\/|mirror|\/mk\/mr\//i.test(final) && /brevo|mailin|sendib/i.test(host)) {
    unsubscribeLinks++;
    linkMap.set(href, "");
  } else if (INTERNAL_HOST.test(host)) {
    internalRemoved++;
    linkMap.set(href, "");
  } else if (FORM_HOST.test(host)) {
    formsFound++;
    linkMap.set(href, dropForms ? "" : final);
  } else {
    // drop tracking parameters that newsletters add
    const url = new URL(final);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|sib|_hsenc|_hsmi|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    linkMap.set(href, url.href);
  }
}
if (unresolved) notes.push(`${unresolved} tracking link(s) could not be resolved: the text is kept, the link is gone. Add the real link by hand if it matters.`);
if (internalRemoved) notes.push(`${internalRemoved} link(s) to Teams or SharePoint removed (internal). Check that the sentence around them still makes sense.`);
if (formsFound) notes.push(dropForms ? `${formsFound} link(s) to sign-up forms removed (--drop-forms).` : `${formsFound} link(s) to sign-up forms kept. Remove them if the form is closed.`);

// ---------- images ----------

const cidMap = new Map(attachments.filter((a) => a.contentId).map((a) => [a.contentId.replace(/^<|>$/g, ""), a]));
const imageMap = new Map(); // original src → local url, or "" to drop
let imageCount = 0;

async function saveImage(buffer, mimeType) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return "";
  }
  // spacers, tracking pixels, social icons
  if ((meta.width ?? 0) <= 60 || (meta.height ?? 0) <= 30) return "";
  const ext = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif" }[meta.format] ?? (mimeType?.split("/")[1] || "png");
  if (ext === "gif") buffer = await sharp(buffer).png().toBuffer();
  imageCount++;
  const name = `image-${String(imageCount).padStart(2, "0")}.${ext === "gif" ? "png" : ext}`;
  await mkdir(mediaDir, { recursive: true });
  await writeFile(join(mediaDir, name), Buffer.from(buffer));
  return `${mediaUrl}/${name}`;
}

const srcs = [...new Set([...html.matchAll(/<img\b[^>]*?\bsrc="([^"]*)"/gi)].map((m) => m[1]))];
for (const src of srcs) {
  const decoded = src.replace(/&amp;/g, "&");
  try {
    if (decoded.startsWith("cid:")) {
      const part = cidMap.get(decoded.slice(4));
      imageMap.set(src, part ? await saveImage(Buffer.from(part.content), part.mimeType) : "");
    } else if (/^https?:/i.test(decoded)) {
      if (TRACKING_HOST.test(hostOf(decoded))) {
        imageMap.set(src, "");
        continue;
      }
      const res = await fetch(decoded, { signal: AbortSignal.timeout(20000) });
      imageMap.set(src, res.ok ? await saveImage(Buffer.from(await res.arrayBuffer()), res.headers.get("content-type")) : "");
      if (!res.ok) notes.push(`An image could not be downloaded (HTTP ${res.status}).`);
    } else if (decoded.startsWith("data:image/")) {
      const [, mime, data] = decoded.match(/^data:(image\/[a-z+]+);base64,(.*)$/i) ?? [];
      imageMap.set(src, data ? await saveImage(Buffer.from(data, "base64"), mime) : "");
    } else {
      imageMap.set(src, "");
    }
  } catch {
    imageMap.set(src, "");
    notes.push("An image could not be read and was left out.");
  }
}
if (imageCount) notes.push(`${imageCount} image(s) saved to ${mediaDir}/. Delete the ones you do not use (logo banners, decoration), write a real alt text for the rest, then run: npm run media`);

const dropped = attachments.filter((a) => !a.contentId || !srcs.some((s) => s === `cid:${a.contentId.replace(/^<|>$/g, "")}`));
if (dropped.length) notes.push(`Attachments not carried over: ${dropped.map((a) => a.filename ?? a.mimeType).join(", ")}. Flyers belong to the event entry.`);

// ---------- HTML → Markdown ----------

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", emDelimiter: "*", hr: "---" });

turndown.addRule("hidden", {
  filter: (node) => /display:\s*none|mso-hide:\s*all|max-height:\s*0/i.test(node.getAttribute?.("style") ?? ""),
  replacement: () => "",
});

turndown.addRule("links", {
  filter: "a",
  replacement: (content, node) => {
    const text = content.trim();
    if (!text) return "";
    const href = node.getAttribute("href") ?? "";
    const final = linkMap.get(href) ?? linkMap.get(href.replace(/&/g, "&amp;")) ?? "";
    if (!final) return text;
    return `[${text}](${final})`;
  },
});

turndown.addRule("images", {
  filter: "img",
  replacement: (_content, node) => {
    const src = node.getAttribute("src") ?? "";
    const local = imageMap.get(src) ?? imageMap.get(src.replace(/&/g, "&amp;")) ?? "";
    if (!local) return "";
    const alt = (node.getAttribute("alt") ?? "").trim();
    return `\n\n![${!alt || AUTO_ALT.test(alt) ? "TODO describe this image" : alt}](${local})\n\n`;
  },
});

// Layout tables (Brevo) carry no tabular data: keep the cell contents as blocks.
turndown.addRule("tables", {
  filter: ["table", "tbody", "thead", "tr"],
  replacement: (content) => `\n\n${content}\n\n`,
});
turndown.addRule("cells", {
  filter: ["td", "th"],
  replacement: (content) => `\n\n${content.trim()}\n\n`,
});

let md = turndown.turndown(html);

// ---------- clean the Markdown ----------

// invisible padding of email previews, non-breaking spaces
md = md.replace(/[​‌‍­͏﻿ ⁠]/g, "").replace(/ /g, " ");
// "bold" letters built from mathematical Unicode symbols → normal letters
md = md.replace(/[\u{1D400}-\u{1D7FF}]/gu, (c) => c.normalize("NFKC"));

let removedAddresses = 0;
md = md.replace(EMAIL, (address) => {
  if (address.toLowerCase() === allowedEmail) return address;
  removedAddresses++;
  return "[address removed]";
});
if (removedAddresses) notes.push(`${removedAddresses} email address(es) removed, marked "[address removed]". Rewrite those sentences so they read well without the address.`);

// footer of the mailing tool
const FOOTER_LINE = [
  /^\[?(open|view) (this (e-?mail|mail) )?in (your )?browser\]?/i,
  /im browser (öffnen|anzeigen)/i,
  /^diese e-mail wurde an/i,
  /^sie haben die e-mail erhalten/i,
  /^this e-?mail was sent to/i,
  /^you('ve| have)? received th(is|e) e-?mail/i,
  /^(\[?unsubscribe\]?|abmelden|open in browser \| unsubscribe)/i,
  /^sent (with|by)\s*(brevo)?$/i,
  /^brevo$/i,
  /^Müller-Friedbergstrasse 6\/8,?\s*9000/i,
];
let lines = md.split("\n").map((line) => line.replace(/\s+$/, ""));
const addressLine = lines.findIndex((line) => /^Müller-Friedbergstrasse 6\/8,?\s*9000/i.test(line.trim()));
if (addressLine > lines.length * 0.6) {
  let start = addressLine;
  for (let i = addressLine - 1; i >= 0 && addressLine - i < 6; i--) {
    if (/^\**(HSG )?Impact Scholar Community\**$/i.test(lines[i].trim())) start = i;
  }
  lines = lines.slice(0, start);
}
lines = lines.filter((line) => !FOOTER_LINE.some((re) => re.test(line.trim())));
md = lines
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/^(?:\s*\n)+/, "")
  .trim();

// things a person has to look at
const checks = [];
for (const [label, re] of [
  ["meeting or join code", /(meeting[- ]id|passcode|kenncode|join code|team code|code:\s*[a-z0-9]{6,8}\b)/i],
  ["phone number", /(\+41|0041)[\s\d]{9,}|\b0\d{2}\s\d{3}\s\d{2}\s\d{2}\b/],
  ["mention of an attachment", /\b(attached|attachment|im anhang|anbei)\b/i],
  ["survey or thesis request by a named person", /\b(master'?s? thesis|bachelor'?s? thesis|my survey|masterarbeit)\b/i],
]) {
  const hit = md.split("\n").find((line) => re.test(line));
  if (hit) checks.push(`${label}: "${hit.trim().slice(0, 90)}"`);
}

// ---------- write the draft ----------

const noteBlock = [
  "<!-- IMPORT NOTES: delete this block before publishing.",
  "",
  "Edit this draft into the house format (docs/CONTENT-MODEL.md), then move the file to",
  "src/content/newsletters/ and set draft: false.",
  "",
  ...notes.map((n) => `- ${n}`),
  ...(checks.length ? ["", "Check by hand:", ...checks.map((c) => `- ${c}`)] : []),
  "",
  "Always check by hand: personal news about named people, internal information,",
  "anything that was meant for the mailing list only.",
  "-->",
].join("\n");

const frontmatter = [
  "---",
  `title: ${JSON.stringify(title)}`,
  `date: ${day}`,
  'summary: "TODO: one or two sentences, at most 280 characters"',
  "kind: newsletter",
  "signedBy: []",
  `source: ${fromBrevo ? "brevo" : "outlook"}`,
  "draft: true",
  "---",
].join("\n");

await mkdir(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, `${slug}.md`);
await writeFile(outFile, `${frontmatter}\n\n${noteBlock}\n\n${md}\n`);

console.log(`Draft written: ${outFile}`);
for (const n of notes) console.log(`  - ${n}`);
for (const c of checks) console.log(`  ! ${c}`);
