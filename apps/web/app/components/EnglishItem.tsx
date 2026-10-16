import { Link } from "react-router";
import { SITE } from "@aihot/site";
import type { ItemContext, SiteItemDetail } from "@aihot/contracts/site";
import { PhoneBar } from "./shell/PhoneBar";
import { ArticleBody } from "../features/item/ArticleBody";
import { IconExternal, IconArrowLeft, IconArrowRight, IconClock } from "./icons";
import { englishText } from "./EnglishStory";

const price = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : n >= 1 ? 2 : 4 });
const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-5 lg:p-6">
      <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
      {children}
      {note && <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">{note}</p>}
    </section>
  );
}

/** What the site knows around the report: its event and other coverage, graph relations, prices. */
function Context({ context }: { context: ItemContext }) {
  const { story, coverage, facts, market } = context;
  const lead = story?.english?.digest.split("\n\n")[0] ?? null;
  return (
    <>
      {story && (story.english || story.reportCount > 1) && (
        <Panel title="The event so far">
          {story.english && <Link to={`/en/story/${story.publicId}`} className="mt-2 block text-[15px] font-semibold leading-[1.6] text-ink hover:text-accent">{story.english.title}</Link>}
          {lead && <p className="mt-2 text-[14px] leading-[1.8] text-ink-2">{lead}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-ink-4">
            <span>{story.reportCount} reports · {story.sourceCount} sources</span>
            <Link to={`/en/story/${story.publicId}`} className="lr-inline-link">Full event timeline <IconArrowRight size={14}/></Link>
          </div>
        </Panel>
      )}
      {coverage.length > 0 && (
        <Panel title="Other coverage of this event">
          <ol className="mt-2 divide-y divide-line-soft">
            {coverage.map((c) => (
              <li key={c.id} className="py-3">
                <div className="text-[11.5px] text-ink-4">{c.earlier ? "Earlier" : "Later"} · {/[\u3400-\u9fff]/u.test(c.source) ? "Publisher" : c.source} · {when.format(new Date(c.publishedAt))} UTC</div>
                <Link to={`/en/items/${c.id}`} className="mt-0.5 block text-[14px] font-medium leading-[1.6] text-ink hover:text-accent">{c.title ?? "Original-language report"}</Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}
      {facts.length > 0 && (
        <Panel title="In the knowledge graph" note="Relations extracted by AI from this report and stored in the site's knowledge graph; check them against the original.">
          <ul className="mt-2 divide-y divide-line-soft">
            {facts.map((f) => (
              <li key={f.fact} className="py-3">
                <div className="text-[13px] font-semibold text-ink">{f.subject} <span className="font-mono text-[10.5px] uppercase tracking-wide text-accent">{f.predicate.replace(/_/g, " ")}</span> {f.object}</div>
                <p className="mt-0.5 text-[13px] leading-[1.7] text-ink-3">{f.fact}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {market && (
        <Panel title="Prices around this report" note={`Binance/OKX spot snapshots just before the report (${when.format(new Date(market.eventAt))} UTC) and a day later, shown side by side for reference. They don't imply the report moved the price. Not investment advice.`}>
          <ul className="mt-2 divide-y divide-line-soft">
            {market.assets.map((a) => (
              <li key={a.asset} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-baseline gap-2 py-2.5">
                <b className="font-mono text-[12px] text-ink">{a.asset}</b>
                <span className="num text-[13px] text-ink-3">{price(a.before.priceUsdt)} → {price(a.after.priceUsdt)} <span className="text-[11px] text-ink-4">{a.after.latest ? "latest" : "24h later"}</span></span>
                <span className={`num text-[14px] font-semibold ${a.changePercent >= 0 ? "text-ok" : "text-down"}`}>{a.changePercent > 0 ? "+" : ""}{a.changePercent.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

export function EnglishItem({item, context = null}: {item:SiteItemDetail; context?: ItemContext | null}) {
  const english=item.english ?? null;
  const title=english?.title ?? englishText(item.originalTitle) ?? englishText(item.title) ?? "Publisher's original report";
  const publisherTitle=english && englishText(item.originalTitle) && item.originalTitle!.trim()!==english.title ? item.originalTitle : null;
  const source=englishText(item.source.name) ?? "Publisher";
  const body=item.body?.original ?? null;
  // No automatic translation is implied. A Chinese-only body remains available at the publisher.
  const readableBody=body && !/[\u3400-\u9fff]/u.test(body.replace(/<[^>]*>/g,""));
  const date=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
  const timestamp=item.publishedAt??item.discoveredAt;
  return (
    <article className="mx-auto max-w-[var(--page-max-reading)] pb-12">
      <PhoneBar back={{to:"/all",label:"News"}} title={title} />
      <Link to="/all" className="hidden items-center gap-2 text-[13px] text-accent lg:inline-flex"><IconArrowLeft size={15}/> Back to news</Link>
      <header className="mt-5 border-b border-line pb-6">
        <div className="lr-eyebrow">{english ? "BRIEFING / SOURCE-LINKED" : "ORIGINAL REPORT / SOURCE RECORD"}</div>
        <h1 data-page-title className="mt-3 text-[26px] font-bold leading-[1.45] text-ink lg:text-[36px]">{title}</h1>
        {publisherTitle && <p className="mt-2.5 text-[14px] leading-relaxed text-ink-4">Publisher's headline: {publisherTitle}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
          <span>{source}</span><span className="inline-flex items-center gap-1.5"><IconClock size={13}/>{date.format(new Date(timestamp))}</span>
        </div>
        <a href={item.links.original} target="_blank" rel="noopener noreferrer" className="lr-button-primary mt-5">
          Read at publisher <IconExternal size={15}/>
        </a>
      </header>
      {english && (
        <section className="mt-6 space-y-5">
          <p className="text-[16px] leading-[1.85] text-ink-2">{english.summary}</p>
          {english.reason && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-accent">Why it matters</h2>
              <p className="mt-2 text-[14.5px] leading-[1.8] text-ink-2">{english.reason}</p>
            </div>
          )}
          <p className="text-[12px] leading-[1.7] text-ink-4">Written by {SITE.name} with AI assistance from the publisher's report. Read the original for full details and quotes.</p>
        </section>
      )}
      {readableBody && body ? (
        <section className="mt-6">
          <div className="mb-3 text-[12px] font-semibold text-ink-4">Original article</div>
          <ArticleBody html={body}/>
          <p className="mt-6 text-[12px] text-ink-4">Original-language content. Reproduced only when the publisher's content policy allows it.</p>
        </section>
      ) : english ? null : (
        <section className="mt-7 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-[18px] font-semibold text-ink">Original reporting</h2>
          <p className="mt-2 text-[13.5px] leading-[1.8] text-ink-3">
            An English full-text version is not available on {SITE.name} for this report. The source link above takes you to the original publication. We do not label Chinese summaries as English translations.
          </p>
        </section>
      )}
      {context && <Context context={context} />}
      {!context?.story && item.relatedStories.length > 0 && <div className="mt-6">
        <Link to={`/en/story/${item.relatedStories[0]!.publicId}`} className="lr-inline-link">Explore the related event</Link>
      </div>}
    </article>
  );
}
