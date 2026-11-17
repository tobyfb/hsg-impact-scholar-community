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

/** Members by `order`, then by name. The people page splits them into its three groups. */
export async function getMembers() {
  return (await getCollection("members", published)).sort(
    (a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name),
  );
}
