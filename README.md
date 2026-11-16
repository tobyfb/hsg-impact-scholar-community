# hsg-impact-scholar-community

Website of the HSG Impact Scholar Community: https://impact-scholar.community

A static site built with [Astro](https://astro.build). Events, members and newsletter
issues are Markdown files, one file per item, checked against a schema when the site is
built.

## Run it locally

Requires Node 22 or newer.

```sh
npm install
npm run dev      # http://localhost:4321 (stop with: npx astro dev stop)
npm run build    # builds into ./dist and fails on invalid content
npm run media    # resizes images under public/media/ and strips their metadata
```

## Where things are

| Path | What |
|---|---|
| `src/content/events/` | One Markdown file per event. File name = URL: `/events/<file name>/` |
| `src/content/members/` | One file per person on the people page |
| `src/content/newsletters/` | One file per archived newsletter issue |
| `src/content/pages/` | Texts of the fixed pages (about, get involved, …) |
| `src/content/site/site.yaml` | Site name, contact address, newsletter signup link, home page call-out |
| `src/content.config.ts` | The schemas: which fields exist and what they may contain |
| `public/media/` | Flyers, photos and other files, in `<collection>/<file name of the item>/` |
| `public/brand/` | Logos and the default link-preview image |
| `public/_redirects` | Redirects from old addresses |
| `src/layouts/`, `src/components/`, `src/pages/`, `src/styles/` | Layout and design |
| `scripts/` | Helper scripts |

## Content rules in short

- Never rename a published file: its name is its URL.
- Dates are written `YYYY-MM-DD`, times in quotes as `"14:00"`.
- No personal email addresses or phone numbers anywhere. The community address in
  `site.yaml` is the only contact.
- A member file needs `consent.given: true` and the date the person agreed. Without it the
  build fails.
- Run `npm run media` after adding images, and `npm run build` before pushing.

The site before November 2026 (Hugo with the Apéro theme) is kept under the Git tag
`legacy-hugo-2024`.
