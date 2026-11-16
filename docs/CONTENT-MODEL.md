# Content model

Everything visitors read is a file under `src/content/`. The exact fields and their rules
are defined in `src/content.config.ts`; that file is the reference and the build enforces
it. This document explains how to write the content.

General rules for all files:

- File name = address. `src/content/events/2026-11-30-mini-methods-jam.md` is
  `/events/2026-11-30-mini-methods-jam/`. Lowercase, digits and hyphens only. Never rename
  a published file.
- Dates are `YYYY-MM-DD`. Times are 24-hour and in quotes: `"14:00"`.
- Files for display or download go to `public/media/<collection>/<file name>/` and are
  referenced as `/media/<collection>/<file name>/flyer.pdf`. Run `npm run media` after
  adding images.
- `draft: true` keeps an entry out of the published site. It is still visible with
  `npm run dev`.
- No personal email addresses or phone numbers, anywhere. The community address from
  `src/content/site/site.yaml` is the only contact.

## Events

`src/content/events/YYYY-MM-DD-short-title.md`. Template: `docs/templates/event.md`.

The text below the frontmatter is the description. After the event, add photos, links to
LinkedIn posts and a `## Looking back` section to the same file.

An event counts as upcoming until the end of its last day. The sign-up button shows while
the event is upcoming and `signup.deadline` has not passed. If there is no link yet, leave
`signup.url` out and write a `signup.note` such as "Sign-up opens soon".

Publish the flyer as an image (`flyer.image`). Add the PDF (`flyer.pdf`) only after reading
all its pages: flyers often carry a personal email address, and the build check does not
look inside PDFs. Sign-up links and QR codes on old flyers are harmless once the form is
closed.

## Members

`src/content/members/firstname-lastname.md`. Template: `docs/templates/member.md`.

A person is listed only after they agreed. Record that in `consent` (`given: true` and the
day they agreed). Keep their message in the facilitators' mailbox, not in this repository.
The text below the frontmatter is an optional bio of two or three sentences.

- `role: facilitator`: part of the current steward team.
- `role: collaborator`: co-organises a format or event with the community.
- `status: alumni`: founders and former facilitators.

## Newsletters

`src/content/newsletters/YYYY-MM-DD-short-title.md`. Template: `docs/templates/newsletter.md`.

The archive should read as one series, whatever tool an issue was sent with. Start from
the draft that `npm run import:newsletter` writes to `.import/`, then edit it by these
rules.

### Frontmatter

- `title`: the subject line without emoji and without the community name in front.
  "Impact Scholar Community Newsletter 2023-04-18 🗞️✨" becomes "Newsletter April 2023".
- `date`: the day it was sent.
- `summary`: one or two plain sentences on what the issue contains, at most 280
  characters. Name the main event or topic.
- `kind`: `newsletter` for an issue with several items, `announcement` for a single
  invitation.
- `signedBy`: first names as in the sign-off, e.g. `[Tabea, Tobias]`.
- `events`: file names (without `.md`) of the community events the issue announces or
  looks back on. Only events that exist in `src/content/events/`.
- `source`: `brevo`, `outlook` or `website-2022`.

### Structure of the text

1. No title in the text. The greeting and the sign-off stay as written, in the place they
   had in the email (often the letter comes first and the details follow).
2. Sections are `##` headings. Use these four names where they fit, whatever the email
   called the section:
   - `## Community events`: upcoming events organised or co-hosted by the community
   - `## Looking back`: recaps of past events
   - `## Community news`: news about the community and its members
   - `## From the HSG ecosystem`: events, calls and news from others

   A section that fits none of them keeps its own heading, without numbering.
3. Each item in a section is a `###` heading with a plain title.
4. For an event, put date, time and place on one line directly under the item heading:
   `30 November 2026, 14:00–16:00 · SQUARE Arena`. Write dates as `30 November 2026`,
   times as `14:00`. Leave out what the email does not say.
5. Keep the wording of the email. Fix obvious typos. Do not shorten, summarise or add.
   Emphasis (bold, italics) stays where the email had it.
6. Emoji stay in running text and are removed from headings and the title.
7. German passages stay in German.

### What is removed

1. **Email addresses.** All of them except the community address, also those of the
   facilitators. Reword the sentence so it reads well: "reach out to Tabea and Tobias"
   stays, the addresses go. If a sentence only says "contact [address]", point to the
   organiser by name or delete the sentence.
2. **Phone numbers, meeting links and join codes** (Teams, Zoom).
3. **Internal links and information.** Links to SharePoint and Teams, internal funding
   details, internal surveys. If an item makes no sense without them, remove the item.
4. **Expired links.** Sign-up forms of past events lose the link, the text stays. Reword
   lightly so the text does not point at something that is gone: "sign up here" becomes
   "sign up", "see the flyer attached" is deleted.
5. **Attachments.** They are not published with the issue. A flyer belongs to the event
   entry.
6. **Requests by named individuals** that were meant for the list only, for example a
   student asking for survey participants for a thesis.
7. **Personal news about named people.** It stays if it is public anyway: the item links
   to a public source (a LinkedIn post, a university page), or it is about a public role
   (speaker, organiser, professor at a chair). Private matters are removed: family,
   health, plans that were shared in confidence. When unsure, remove it and note it for the
   facilitators.
8. **Email furniture.** Footer, "view in browser", unsubscribe line, preheader text, logo
   banner, decoration images.

### What is changed

- Links to the old website (`impact-scholar.community/blog/…`) point to the new address.
- Tracking links are replaced by the real destination. The import script does this.
- Images get a real alt text that says what the image shows. Remove images that are only
  decoration. Photos of people stay only if they show a public event.

### After editing

Delete the `IMPORT NOTES` block, set `draft: false`, move the file to
`src/content/newsletters/`, delete unused images from its media folder, then run
`npm run media` and `npm run build`.

Two issues to look at as models: `2023-09-18-…` (sent with Outlook) and `2026-10-22-…`
(sent with Brevo).
