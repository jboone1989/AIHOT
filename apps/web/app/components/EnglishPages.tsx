import { FollowControls } from "./FollowButton";
import {Link} from "react-router";
import {SITE} from "@aihot/site";
import type {ReportDetail,ReportCitation,ReportIndexEntry,TopicSummary,TopicPage,TopicsResponse,SiteStats,ChangelogRelease} from "@aihot/contracts/site";
import {DayList,Pagination} from "../features/feed/DayList";
import {PhoneBar} from "./shell/PhoneBar";
import {IconArrowRight,IconExternal} from "./icons";
const han=/[\u3400-\u9fff]/u;
export const englishOnly=(s:string|null|undefined)=>s&&!han.test(s)?s:null;
const TOPICS: Record<string,[string,string]>={
"ai-models":["AI Models & Applications","Models, capabilities and applications"],"ai-infrastructure":["AI Infrastructure","Compute, chips and AI economics"],"ai-agents":["AI Agents","Agent systems and automation"],
bitcoin:["Bitcoin","The Bitcoin ecosystem, ETFs and markets"],stablecoins:["Stablecoins & Payments","Issuance, settlement and regulation"],onchain:["On-chain Finance","DeFi and on-chain market structure"],
macro:["Rates & Liquidity","Monetary policy, bonds and capital flows"],etf:["ETFs & Markets","Capital markets and fund flows"],regulation:["Policy & Regulation","Financial, AI and crypto oversight"],
"original-research":["Original Research","Independent experiments and analysis"],explainers:["Deep Dives","Explaining how systems work"],"data-analysis":["Data Analysis","Data, indicators and methods"],"practical-guides":["Practical Guides","Reusable workflows and tutorials"],
openai:["OpenAI","OpenAI research and product updates"],anthropic:["Anthropic","Anthropic research and product updates"],google:["Google / DeepMind","Models, research and announcements"],meta:["Meta","AI and technology developments"],
nvidia:["NVIDIA","AI infrastructure and semiconductor technology"],"hugging-face":["Hugging Face","Open-source AI research"],ethereum:["Ethereum","Network changes and ecosystem activity"],
"federal-reserve":["Federal Reserve","Monetary policy and rates"],sec:["U.S. SEC","Securities policy and regulation"],geopolitics:["Geopolitics & Markets","Sanctions, trade and conflict"],energy:["Energy & Commodities","Energy supply and commodities"],semiconductor:["Semiconductors","Supply chains and chip production"],"macro-releases":["Economic Data","Official inflation, jobs and GDP reports"]};
export const enTopic=(t:Pick<TopicSummary,"slug"|"name">)=>TOPICS[t.slug]?.[0]??englishOnly(t.name)??"Research topic";
export const enDescription=(t:Pick<TopicSummary,"slug"|"definition">)=>TOPICS[t.slug]?.[1]??englishOnly(t.definition)??"Original reports and research";
const enDate=(s:string)=>new Intl.DateTimeFormat("en-US",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(s));
function Header({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){
 return <header className="lr-knowledge-header mb-6"><div className="lr-eyebrow text-accent">{eyebrow}</div><h1 data-page-title className="lr-page-title mt-3">{title}</h1><p className="mt-3 max-w-[760px] text-[14px] leading-[1.85] text-ink-3">{description}</p></header>;
}
export function EnglishAbout({stats}:{stats:SiteStats|null}){
 const fields:[string,number][] = stats?[["Tracked sources",stats.sources],["Collected reports",stats.items],["Selected reports",stats.selected],["Published daily issues",stats.dailies]]:[];
 return <main className="pb-12"><PhoneBar back={{to:"/more",label:"More"}} title="About"/>
 <Header eyebrow={`ABOUT ${SITE.name.toUpperCase()}`} title="Follow events. Connect the facts." description={`${SITE.name} is an AI, crypto and financial intelligence network. It organizes original-source reporting into evolving events and connects documented facts in a persistent knowledge graph.`}/>
 <div className="grid gap-3 sm:grid-cols-4">{fields.map(([k,v])=><div key={k} className="rounded-xl border border-line bg-surface p-4"><strong className="text-[25px] font-semibold">{v.toLocaleString("en-US")}</strong><p className="text-[12px] text-ink-4">{k}</p></div>)}</div>
 <div className="mt-7 grid gap-4 md:grid-cols-3">{[["Observe","News gathered from public sources, cross-checked and organized around events."],["Connect","Graphiti and Neo4j store evolving relationships extracted from evidence."],["Verify","Trace connections back to the reporting. AI-extracted facts may require verification."]].map(([h,d])=><section key={h} className="rounded-xl border border-line bg-surface p-5"><h2 className="font-bold">{h}</h2><p className="mt-2 text-[13px] leading-[1.8] text-ink-3">{d}</p></section>)}</div>
 <div className="mt-6 flex gap-5"><Link to="/knowledge" className="lr-inline-link">Knowledge Graph <IconArrowRight size={16}/></Link><Link to="/feedback" className="lr-inline-link">Feedback <IconArrowRight size={16}/></Link></div></main>;
}
export function EnglishTopics({groups,topics}:{groups:TopicsResponse["groups"];topics:TopicsResponse["topics"]}){
 const headings:Record<string,[string,string]>={field:["Explore by field","Technology, finance and markets"],genre:["Research & explainers","Methods, analysis and tutorials"],company:["Organizations","Company releases and institutional updates"]};
 return <main className="pb-12"><PhoneBar back={{to:"/more",label:"More"}} title="Topics"/>
 <Header eyebrow="RESEARCH INDEX" title="Explore by topic" description={"Follow "+topics.length+" topics across AI, cryptocurrency, finance and research."}/>
 {groups.map(g=><section key={g.key} className="mt-7"><h2 className="text-[19px] font-bold">{headings[g.key]?.[0]??"Topics"}</h2><p className="text-[12px] text-ink-3">{headings[g.key]?.[1]}</p>
 <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{topics.filter(t=>t.group===g.key).map(t=><Link key={t.slug} to={"/topics/"+t.slug} className="rounded-xl border border-line bg-surface p-5 hover:border-accent"><h3 className="font-semibold">{enTopic(t)}</h3><p className="mt-2 text-[12px] text-ink-3">{enDescription(t)}</p><span className="mt-3 inline-flex gap-1 text-[11px] text-ink-4">{t.total} reports <IconArrowRight size={12}/></span></Link>)}</div></section>)}</main>;
}
export function EnglishTopic({data}:{data:TopicPage}){
 const {topic,items,page,pageCount,pageSize}=data;
 const href=(p:number)=>p<=1?"/topics/"+topic.slug:"/topics/"+topic.slug+"/page/"+p;
 return <main className="pb-12"><PhoneBar back={{to:"/topics",label:"Topics"}} title={enTopic(topic)}/>
 <Header eyebrow="TOPIC REPORTING" title={enTopic(topic)} description={enDescription(topic)}/>
 <div className="mb-4"><FollowControls kind="topic" id={topic.slug} name={topic.name}/></div>
 <p className="mb-4 text-[12px] text-ink-3">{topic.total} selected reports · {topic.recent} in the last 30 days · {topic.poolTotal} indexed</p>
 {items.length?<DayList items={items} headerAside={<span className="text-[12px] text-ink-4">Items {(page-1)*pageSize+1}–{(page-1)*pageSize+items.length}</span>}/>:<p className="rounded-xl border border-line p-6">No reports available yet.</p>}
 <Pagination page={page} pageCount={pageCount} href={href}/></main>;
}
function Citation({c,i}:{c:ReportCitation;i:number}){
 const title=englishOnly(c.originalTitle)??englishOnly(c.title)??"Source report "+(i+1)+" — view original";
 if(!c.available)return <li className="px-5 py-4 text-[12px] text-ink-4">Withdrawn report</li>;
 const link=c.itemId?"/items/"+c.itemId+"/original":null;
 return <li className="border-b border-line-soft px-5 py-4 last:border-0">
 <div className="text-[11px] text-ink-4">{englishOnly(c.sourceName)??"Publisher"}{c.publishedAt?" · "+enDate(c.publishedAt):""}</div>
 {link?<Link to={link} className="mt-1 block text-[14px] font-semibold leading-[1.7] hover:text-accent">{title}</Link>:<div className="mt-1 text-[14px] font-semibold">{title}</div>}
 {/^[Hh][Tt][Tt][Pp][Ss]?:\/\//.test(c.sourceUrl)&&<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">Publisher source <IconExternal size={12}/></a>}
 </li>;
}
const kindName=(kind:string)=>kind==="weekly"?"Weekly":kind==="monthly"?"Monthly":"Daily";
export function EnglishReport({report,kind="daily",graph}:{report:ReportDetail|null;kind?:string;graph?:React.ReactNode}){
 const name=kindName(report?.kind??kind);
 const raw=report?[...report.highlights,...report.sections.flatMap(s=>s.items),...report.flashes]:[];
 const uniq=raw.filter((c,i)=>raw.findIndex(x=>x.itemId?x.itemId===c.itemId:x.title===c.title)===i);
 return <main className="pb-12"><PhoneBar back={{to:"/daily",label:"Daily"}} title={name+" Brief"}/>
 <Header eyebrow="SOURCE DIGEST / ENGLISH" title={name+" Brief"+(report?" · "+report.key:"")}
 description={report?"Issue #"+report.issueNumber+" · "+uniq.length+" source-linked reports. This English digest uses publisher headlines. The original Chinese editorial commentary has not been translated.":"No issue published yet."}/>
 {report&&<><div className="mb-5 flex flex-wrap gap-4 text-[12px]">{report.prev&&<Link to={"/"+report.kind+"/"+report.prev} className="lr-inline-link">← Previous</Link>}{report.next&&<Link to={"/"+report.kind+"/"+report.next} className="lr-inline-link">Next →</Link>}<Link to="/daily/archive" className="lr-inline-link">Archive <IconArrowRight size={14}/></Link></div>
 <h2 className="mb-3 text-[19px] font-semibold">Source coverage</h2><ol className="overflow-hidden rounded-xl border border-line bg-surface">{uniq.length?uniq.map((c,i)=><Citation key={c.itemId??c.title} c={c} i={i}/>):<li className="p-5 text-ink-3">No public citations available.</li>}</ol></>}{graph}</main>;
}
export function EnglishArchive({index}:{index:ReportIndexEntry[]}){
 return <main className="pb-12"><PhoneBar back={{to:"/daily",label:"Daily"}} title="Daily Archive"/>
 <Header eyebrow="ARCHIVE" title="Daily archive" description={index.length+" issues, with source-linked coverage."}/>
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{index.map(e=><Link key={e.key} to={"/daily/"+e.key} className="rounded-xl border border-line bg-surface px-5 py-4 hover:border-accent"><strong>{e.key}</strong><p className="text-[12px] text-ink-4">Issue #{e.issueNumber} · {e.count} reports</p></Link>)}</div></main>;
}
export function EnglishUpdates({releases}:{releases:ChangelogRelease[]}){
 const kinds:Record<string,string>={"更新":"Update","优化":"Improvement","公告":"Notice","下线":"Retired"};
 return <main className="pb-12"><PhoneBar back={{to:"/more",label:"More"}} title="Updates"/>
 <Header eyebrow="RELEASE HISTORY" title="Product updates" description="Release dates and categories are listed here. Release details are shown in English where translated; older entries retain their original-language source until reviewed."/>
 <ol className="rounded-xl border border-line bg-surface">{releases.map((r,i)=><li key={r.date+r.time+i} className="flex justify-between gap-4 border-b border-line-soft px-5 py-4 last:border-0">
 <div><div className="text-[12px] text-ink-4">{r.date} · {r.time}</div><strong className="mt-1 block text-[14px]">{r.title==="网站上线"?"Website launched":(kinds[r.kind]??"Release")}{r.urgent?" · Important":""}</strong>{r.title==="网站上线"&&<p className="mt-1 max-w-[650px] text-[12px] text-ink-3">The website launched with source monitoring, curated reporting, event grouping and a daily brief.</p>}</div><span className="text-[11px] text-ink-4">{r.title==="网站上线"?"Published":"Source-language notes"}</span></li>)}</ol></main>;
}
