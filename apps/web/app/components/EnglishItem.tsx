import { Link } from "react-router";
import { SITE } from "@aihot/site";
import type { SiteItemDetail } from "@aihot/contracts/site";
import { PhoneBar } from "./shell/PhoneBar";
import { ArticleBody } from "../features/item/ArticleBody";
import { IconExternal, IconArrowLeft, IconClock } from "./icons";
import { englishText } from "./EnglishStory";

export function EnglishItem({item}: {item:SiteItemDetail}) {
  const title=englishText(item.originalTitle) ?? englishText(item.title) ?? "Publisher's original report";
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
        <div className="lr-eyebrow">ORIGINAL REPORT / SOURCE RECORD</div>
        <h1 data-page-title className="mt-3 text-[26px] font-bold leading-[1.45] text-ink lg:text-[36px]">{title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
          <span>{source}</span><span className="inline-flex items-center gap-1.5"><IconClock size={13}/>{date.format(new Date(timestamp))}</span>
        </div>
        <a href={item.links.original} target="_blank" rel="noopener noreferrer" className="lr-button-primary mt-5">
          Read at publisher <IconExternal size={15}/>
        </a>
      </header>
      {readableBody && body ? (
        <section className="mt-6">
          <div className="mb-3 text-[12px] font-semibold text-ink-4">Original article</div>
          <ArticleBody html={body}/>
          <p className="mt-6 text-[12px] text-ink-4">Original-language content. Reproduced only when the publisher's content policy allows it.</p>
        </section>
      ) : (
        <section className="mt-7 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-[18px] font-semibold text-ink">Original reporting</h2>
          <p className="mt-2 text-[13.5px] leading-[1.8] text-ink-3">
            An English full-text version is not available on {SITE.name} for this report. The source link above takes you to the original publication. We do not label Chinese summaries as English translations.
          </p>
        </section>
      )}
      {item.relatedStories.length > 0 && <div className="mt-6">
        <Link to="/hot" className="lr-inline-link">Explore related events</Link>
      </div>}
    </article>
  );
}
