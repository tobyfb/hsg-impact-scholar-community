import { getCollection, getEntry } from "astro:content";
import { isUpcoming } from "./dates";

// Drafts are visible in `npm run dev` and left out of the published site.
const published = <T extends { data: { draft: boolean } }>(entry: T) =>
  import.meta.env.PROD ? !entry.data.draft : true;

export async function getSite() {
  const entry = await getEntry("site", "site");
  if (!entry) throw new Error("src/content/site/site.yaml is missing");
  return entry.data;
}

export async function getPage(id: string) {
  const entry = await getEntry("pages", id);
  if (!entry) throw new Error(`src/content/pages/${id}.md is missing`);
  return entry;
}

/** All events, oldest first. */
export async function getEvents() {
  return (await getCollection("events", published)).sort(
    (a, b) => a.data.date.valueOf() - b.data.date.valueOf(),
  );
}

export async function getUpcomingEvents() {
  return (await getEvents()).filter((e) => isUpcoming(e.data) && e.data.status !== "cancelled");
}

/** Past events, newest first. */
export async function getPastEvents() {
  return (await getEvents()).filter((e) => !isUpcoming(e.data)).reverse();
}

/** Newsletter issues, newest first. */
export async function getNewsletters() {
  return (await getCollection("newsletters", published)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

// A profile without `consent` is a draft waiting for the person's confirmation. Drafts are
// shown (marked as such) with `npm run dev` and on Cloudflare preview branches. Every other
// build, in particular the one of the live site (branch main), refuses them.
const previewBranch = process.env.CF_PAGES_BRANCH;
const allowUnconfirmed = import.meta.env.DEV || (!!previewBranch && previewBranch !== "main");

/** Members by `order`, then by name. The people page splits them into its three groups. */
export async function getMembers() {
  const members = await getCollection("members", published);
  const unconfirmed = members.filter((m) => !m.data.consent).map((m) => `src/content/members/${m.id}.md`);
  if (unconfirmed.length > 0 && !allowUnconfirmed) {
    throw new Error(
      `No recorded agreement (consent) in: ${unconfirmed.join(", ")}. ` +
        "A profile without consent can be shown on a preview branch, not on the live site.",
    );
  }
  return members.sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}
