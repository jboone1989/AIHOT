import { Link } from "react-router";
import type { StoryDetail } from "@aihot/contracts/site";
import { KnowledgeExplorer, type KnowledgeGraph } from "./KnowledgeNetwork";
import { PhoneBar } from "./shell/PhoneBar";
import { IconArrowLeft, IconArrowUpRight, IconClock, IconExternal } from "./icons";

/** Source-derived English display copy: never present a Chinese editorial abstract as English. */
export function englishText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return /[\u3400-\u9fff]/u.test(value) ? null : value.trim();
}

function reportTitle(report: {originalTitle?: string | null; title:string}, index:number) {
  return englishText(report.originalTitle) ?? englishText(report.title) ?? `Original report ${index+1} · Title available in source language`;
}

/** English event view backed by the SAME event and Graphiti records, with honest content fallbacks.
 * The editorial digest and report summaries only exist in Chinese today. They are never labeled as translated.
 */
export function EnglishStory({ story, graph }: { story:StoryDetail; graph:KnowledgeGraph }) {
  const title=englishText(story.englishTitle) ?? englishText(story.title) ?? "Event Timeline";
  const readable=story.timeline.filter(r => englishText(r.originalTitle) || englishText(r.title));
  const summary=englishText(story.digest) ?? englishText(story.summary);
  const date=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-12">
      <PhoneBar back={{to:"/hot",label:"Events"}} title="Event detail" />
      <Link to="/hot" className="hidden items-center gap-2 text-[13px] text-accent lg:inline-flex"><IconArrowLeft size={15}/> All events</Link>
      <header className="lr-knowledge-header mt-5">
        <div className="lr-eyebrow">EVENT INTELLIGENCE / SOURCE TRAIL</div>
        <h1 data-page-title className="lr-page-title mt-3">{title}</h1>
        <div className="mt-5 flex flex-wrap gap-5 text-[12px] text-ink-3">
          <span>{story.reportCount} reports</span><span>{story.sourceCount} sources</span>
          <span>{story.latestAt ? `Last activity: ${date.format(new Date(story.latestAt))}` : "Date unavailable"}</span>
        </div>
        {summary ? <p className="mt-5 text-[14px] leading-[1.9] text-ink-2">{summary}</p> :
          <p className="mt-5 text-[13px] leading-[1.85] text-ink-3">This event's editorial summary is currently available in Chinese. English-original source headlines and the evidence graph remain accessible below; no unreviewed English summary has been invented.</p>}
      </header>
      <section className="mt-6">
        <h2 className="mb-3 text-[20px] font-semibold text-ink">Evidence & relationships</h2>
        <KnowledgeExplorer graph={graph}/>
      </section>
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-ink">Source reports</h2>
          <span className="text-[12px] text-ink-4">{readable.length} with English titles · {story.timeline.length} total</span>
        </div>
        <ol className="mt-3 divide-y divide-line-soft rounded-xl border border-line bg-surface">
          {story.timeline.slice(0,80).map((report,i)=>(
            <li key={report.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3 text-[11px] text-ink-4">
                <span>{englishText(report.source.name) ?? "Source publication"}</span>
                <span className="inline-flex items-center gap-1"><IconClock size={12}/>{date.format(new Date(report.publishedAt))}</span>
              </div>
              <Link to={`/items/${report.id}/original`} className="mt-1.5 block text-[15px] font-semibold leading-[1.6] text-ink hover:text-accent">
                {reportTitle(report,i)}
              </Link>
              {/^https?:\/\//i.test(report.originalUrl ?? "") && (
                <a className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline" target="_blank" rel="noopener noreferrer" href={report.originalUrl}>Publisher's original <IconExternal size={13}/></a>
              )}
            </li>
          ))}
        </ol>
      </section>
      <div className="mt-7 text-[13px] text-ink-4">One event timeline and one evidence graph are shared between languages. Articles written only in Chinese remain marked as original-language material rather than being misrepresented as English translations.</div>
      <Link to="/knowledge" className="lr-inline-link mt-4">Explore the knowledge graph <IconArrowUpRight size={16}/></Link>
    </div>
  );
}
