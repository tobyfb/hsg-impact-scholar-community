import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// Content layer: one file per item under src/content/ (see CLAUDE.md).
// Every schema is strict: a field that is not listed here fails the build and
// names the file. That catches typos such as "sigup:" which would otherwise
// silently drop the signup button.

const time = z
  .string({ error: 'Write times in quotes, e.g. "14:00"' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour "HH:MM" in quotes, e.g. "14:00"');

// Files for display or download live in public/media/<collection>/<slug>/.
const media = z
  .string()
  .regex(/^\/media\/[a-z0-9/._-]+$/, "Must start with /media/ and use lowercase letters, digits, - . _ (no spaces)");

const url = z.url();

// File name = slug = URL: src/content/events/2026-11-30-mini-methods-jam.md
// → /events/2026-11-30-mini-methods-jam/. Never rename a published file.
const events = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/events" }),
  schema: z
    .object({
      title: z.string().max(90),
      date: z.coerce.date(), // first day, YYYY-MM-DD
      endDate: z.coerce.date().optional(), // only for multi-day events
      startTime: time.optional(),
      endTime: time.optional(),
      location: z.string().optional(), // "SQUARE Arena"
      locationNote: z.string().optional(), // room number, address, "followed by an apéro"
      online: z.boolean().default(false),
      format: z.string().optional(), // "Workshop", "Panel", "Poster session"
      series: z
        .enum([
          "methods",
          "hosted-by",
          "academic-poster-session",
          "conference-practice-space",
          "semester-kick-off",
          "holiday-event",
          "career",
        ])
        .optional(),
      summary: z.string().max(280), // cards, link previews, meta description
      people: z
        .array(
          z
            .object({
              name: z.string(),
              role: z.string().optional(), // "Speaker", "Host", "Moderator"
              affiliation: z.string().optional(),
            })
            .strict(),
        )
        .default([]),
      partners: z.array(z.string()).default([]), // co-hosting units, e.g. "IWE-HSG"
      signup: z
        .object({
          url: url.optional(), // leave out while there is no link yet
          label: z.string().default("Sign up"),
          deadline: z.coerce.date().optional(),
          note: z.string().optional(), // "Free, places limited" or "Sign-up opens soon"
        })
        .strict()
        .optional(),
      flyer: z.object({ image: media.optional(), pdf: media.optional() }).strict().optional(),
      shareImage: media.optional(), // 1200×630 preview for LinkedIn etc.; falls back to the flyer image
      photos: z
        .array(
          z
            .object({
              src: media,
              alt: z.string().min(5, "Describe what the photo shows"),
              credit: z.string().optional(),
            })
            .strict(),
        )
        .default([]),
      links: z
        .array(
          z
            .object({
              label: z.string(),
              url,
              kind: z.enum(["linkedin", "report", "slides", "video", "other"]).default("other"),
            })
            .strict(),
        )
        .default([]),
      status: z.enum(["scheduled", "postponed", "cancelled"]).default("scheduled"),
      draft: z.boolean().default(false), // true = visible in `npm run dev` only
    })
    .strict(),
});

// src/content/members/firstname-lastname.md. No email or phone field on purpose:
// contact runs through the community address.
const year = z.number().int().min(2021).max(2100);

const members = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/members" }),
  schema: z
    .object({
      name: z.string(),
      // The three groups of the people page.
      group: z.enum(["facilitator", "alumni", "supporter"]),
      facilitatorFrom: year.optional(), // year they joined the facilitator team
      facilitatorUntil: year.optional(), // year they left it (alumni only)
      roleNote: z.string().optional(), // "Co-founder", "Co-host of the Academic Poster Session"
      position: z.string().optional(), // "PhD candidate", "Postdoc", "Assistant professor"
      unit: z.string(), // institute or organisation, written out; for alumni where they are now
      unitUrl: url.optional(),
      photo: media.optional(), // square, at least 600 px; initials are shown if missing
      // One or two sentences in the person's own words.
      researchInterests: z
        .string()
        .max(400, "Keep research interests to one or two sentences (at most 400 characters)")
        .optional(),
      methods: z.array(z.string()).max(6).default([]),
      links: z
        .object({
          profile: url.optional(), // HSG profile page
          website: url.optional(),
          linkedin: url.optional(),
          bluesky: url.optional(),
          scholar: url.optional(), // Google Scholar
          orcid: url.optional(),
        })
        .strict()
        .default({}),
      // A member file only builds once the person has agreed to be listed publicly.
      consent: z
        .object({
          given: z.literal(true, {
            error: "consent.given must be true, and only once the person has agreed to be listed",
          }),
          date: z.coerce.date(), // day they agreed
        })
        .strict(),
      order: z.number().default(100),
      draft: z.boolean().default(false),
    })
    .strict()
    .superRefine((m, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
      if (m.group === "facilitator" && !m.researchInterests?.trim()) {
        issue("researchInterests", "A facilitator needs one or two sentences on their research interests");
      }
      if (m.group === "facilitator" && m.facilitatorUntil) {
        issue("facilitatorUntil", "An end year means the person has left the team: set group to alumni");
      }
      if (m.group === "supporter" && (m.facilitatorFrom || m.facilitatorUntil)) {
        issue("facilitatorFrom", "Facilitator years are for the groups facilitator and alumni only");
      }
      if (m.facilitatorFrom && m.facilitatorUntil && m.facilitatorUntil < m.facilitatorFrom) {
        issue("facilitatorUntil", "facilitatorUntil is earlier than facilitatorFrom");
      }
    }),
});

// src/content/newsletters/YYYY-MM-DD-short-title.md, body in the house format
// (docs/CONTENT-MODEL.md).
const newsletters = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/newsletters" }),
  schema: z
    .object({
      title: z.string(), // subject line without emoji
      date: z.coerce.date(), // day it was sent
      summary: z.string().max(280),
      kind: z.enum(["newsletter", "announcement"]).default("newsletter"),
      signedBy: z.array(z.string()).default([]), // first names as signed
      events: z.array(reference("events")).default([]), // file names (without .md) of events it covers
      source: z.enum(["website-2022", "outlook", "brevo"]),
      draft: z.boolean().default(false),
    })
    .strict(),
});

// Page texts: one file per page, body = main text.
const pages = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/pages" }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().max(200), // meta description and link previews
      lead: z.string().optional(), // intro paragraph under the title
    })
    .strict(),
});

// Global settings: src/content/site/site.yaml
const site = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/site" }),
  schema: z
    .object({
      name: z.string(),
      claim: z.string(),
      description: z.string(),
      email: z.email(), // the only address that may appear on the site
      foundedYear: z.number(),
      newsletterSignupUrl: url,
      linkedinUrl: url.optional(),
      teamsUrl: url.optional(),
      globalCommunityUrl: url,
      // Optional call-out on the home page. Remove the block to hide it.
      callout: z
        .object({ title: z.string(), text: z.string(), linkLabel: z.string(), linkUrl: z.string() })
        .strict()
        .optional(),
    })
    .strict(),
});

export const collections = { events, members, newsletters, pages, site };
