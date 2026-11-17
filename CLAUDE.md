# Website of the HSG Impact Scholar Community

Instructions for the AI assistant working in this repository, and readable for the person
who maintains the site. Most requests will be one of three: add an event, add a member, add
a newsletter issue. The recipes are below.

## What this is

A static website built with Astro and published by Cloudflare Pages at
https://impact-scholar.community. Every push to the `main` branch is live about a minute
later. If a build fails, nothing is published and the last good version stays online.

Events, members and newsletter issues are Markdown files, one file per item. The build
checks every file against a schema and checks the finished pages (`npm run check`). These
checks protect the people named on the site. Never work around them.

## The one rule

Content lives in `src/content/`. Files that visitors see or download (flyers, photos) live
in `public/media/<collection>/<file name of the item>/`. A content change touches these two
places and nothing else. Layout, styles and scripts stay as they are unless the maintainer
asks for a design change in so many words.

| Path | What |
|---|---|
| `src/content/events/` | One file per event |
| `src/content/members/` | One file per person on the people page |
| `src/content/newsletters/` | One file per archived newsletter issue |
| `src/content/pages/` | Texts of the fixed pages (about, get involved …) |
| `src/content/site/site.yaml` | Contact address, newsletter sign-up link, call-out on the home page |
| `src/content.config.ts` | The schemas: which fields exist and what they may contain |
| `docs/CONTENT-MODEL.md` | How to write each kind of content, in detail |
| `docs/templates/` | A template for each kind of content |

## Recipe: add an event

1. Copy `docs/templates/event.md` to `src/content/events/YYYY-MM-DD-short-title.md`. The
   date in the file name is the day of the event. Lowercase letters, digits and hyphens only.
2. Fill in title, date, times in quotes (`"14:00"`), location, a summary of at most 280
   characters and the sign-up link. Write the description below the frontmatter. If there is
   no sign-up link yet, leave `signup.url` out and write a `signup.note`.
3. Flyer and photos go to `public/media/events/<same name as the file>/`. Run
   `npm run media`. Reference them as `/media/events/<name>/flyer.jpg`. Every photo needs an
   alt text that says what it shows.
4. Run `npm run check`. Commit as `Content: add event <title>` and push.
5. After the event, add photos, links to LinkedIn posts and a `## Looking back` section to
   the same file. Do not create a second file for the recap.

Publish a flyer as an image. Publish its PDF only after reading it: many flyers carry a
personal email address on the second page, and then the PDF stays out.

## Recipe: add a member

1. The person must have agreed to be listed. Ask the maintainer for the person's reply and
   its date if you do not have it. Without it, the profile can only be a draft: leave
   `consent` out and push it to a branch of its own, never to `main`. The branch preview
   shows it marked as a draft, so the person can look at it and confirm.
2. Copy `docs/templates/member.md` to `src/content/members/firstname-lastname.md` and fill
   it in. `group` decides where the person appears: `facilitator`, `alumni` (former
   facilitator) or `supporter` (collaborators and supporters). The text below the
   frontmatter says in two or three sentences what the person does in the community.
3. Set `consent.given: true` and `consent.date` to the day the person agreed. The reply
   itself stays in the facilitators' mailbox, not in this repository.
4. The photo is optional: square, saved as `public/media/members/firstname-lastname.jpg`,
   then `npm run media`.
5. Run `npm run check`. Commit as `Content: add member <name>` and push.

When a facilitator leaves the team, keep the file: set `group: alumni` and add
`facilitatorUntil` with the year.

## Recipe: add a newsletter issue

1. Get the sent issue as a file: the HTML export of the campaign from Brevo, or the email
   saved as `.eml`.
2. Run `npm run import:newsletter -- path/to/file`. This writes a draft to `.import/` (a
   folder that is never committed) and saves the images under `public/media/newsletters/`.
3. Edit the draft by the rules in `docs/CONTENT-MODEL.md`, section "Newsletters": the four
   section headings, a summary, alt texts, and everything on the removal list taken out
   (addresses, meeting links, internal links, attachments, private news about people).
4. List the events the issue covers under `events:` (file names without `.md`).
5. Set `draft: false`, move the file to `src/content/newsletters/`, delete unused images,
   run `npm run media` and `npm run check`. Commit as `Content: add newsletter <date>` and
   push.

Tell the maintainer what you removed and anything you were unsure about, so they can decide.

## Before every push

1. `git pull`
2. `npm run check`. If it fails, it names the file and the problem. Fix that file.
3. Commit with one of three prefixes: `Content:`, `Design:` or `Infra:`.

Content changes go directly to `main`. Changes to design or structure (anything under `src/`
outside `src/content/`, and anything in `scripts/`) go on a branch first. Cloudflare builds a
preview address for every branch; the maintainer looks at the preview before the merge.

## Never

- Publish a personal email address or phone number, in text, images or PDFs. The community
  address in `site.yaml` is the only contact on the site.
- Add a member without their recorded agreement, or set `consent.given` to make a build
  pass.
- Rename or delete a published file. Its file name is its address, and that address is in
  newsletters and LinkedIn posts. If a page really has to move, add a line to
  `public/_redirects`.
- Publish photos in which people can be recognised unless they show a community event and
  the maintainer has said yes.
- Publish private information about a person (family, health, plans told in confidence),
  also when it stood in a newsletter.
- Commit anything from `.import/`, or files named `.env`.
- Force-push, or rewrite history on `main`.
- Add packages, change the layout or "tidy up" code as part of a content change.
- Edit a check, a schema or `scripts/check-dist.mjs` so that a failing build passes.

## When someone asks to be removed

Do it at once. Delete the member file, or remove the name or photo from the event or
newsletter file, run `npm run check`, push. The change is live within minutes. No discussion
and no justification is needed from the person.

## Writing for this site

- English, British spelling in the site's own texts. Newsletter issues keep the wording
  they were sent with.
- Headings in sentence case. Plain sentences, no marketing language, no emoji in the site's
  own texts.
- Do not invent facts. If a date, a room or a name is missing, ask the maintainer or leave
  the field out. Do not write that an event went well unless someone who was there said so.

## Running it

Requires Node 22 or newer.

```sh
npm install
npm run dev      # preview at http://localhost:4321 (stop with: npx astro dev stop)
npm run check    # build the site and check it; run before every push
npm run media    # resize images under public/media/ and remove their metadata
```

Entries with `draft: true` show up with `npm run dev` only, never on the published site.

## If something is unclear

Ask the maintainer before guessing, in particular about anything that names a person. The
facilitators can be reached at the community address in `src/content/site/site.yaml`.
