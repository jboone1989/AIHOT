// The English page of an article (/en/items/:id): the original-language text, the site's English copy and
// what the site knows around the report (its event, other coverage, graph relations, prices).
import { useLoaderData } from "react-router";
import type { Route } from "./+types/item-english";
import type { ItemContext, SiteItemDetail } from "@aihot/contracts/site";
import { apiGet, cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { EnglishItem } from "../components/EnglishItem";
import { itemMeta } from "./item";
export { handle, headers } from "./item";

export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();
export async function loader({ params, request }: Route.LoaderArgs) {
  const id = encodeURIComponent(params.id);
  const [item, context] = await Promise.all([
    loadOr404<SiteItemDetail>(`/api/site/items/${id}/original`, { signal: request.signal }),
    apiGet<ItemContext>(`/api/site/items/${id}/context`, { signal: request.signal, timeoutMs: 5_000 }).catch(() => null),
  ]);
  return cachedPage(600, { item, context });
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }, { name: "robots", content: "noindex" }];
  return itemMeta(loaderData.item, location.pathname, loaderData.context?.indexable ?? false);
}

export default function EnglishItemPage() {
  const { item, context } = useLoaderData<typeof loader>();
  return <EnglishItem item={item} context={context} />;
}
