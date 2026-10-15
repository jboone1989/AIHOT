import {useEffect,useRef} from "react";
import {useLocation} from "react-router";
import {useUiLanguage} from "./LanguageSwitch";

/** Client-only browser labels. Canonical SSR metadata remains the original publication language. */
function section(path:string){
  if(path==="/")return ["Event Intelligence","Follow current events and their sourced relationships."];
  if(path.startsWith("/all"))return ["All News","Explore original-source reports in AI, crypto and finance."];
  if(path.startsWith("/hot"))return ["Trending Events","Follow events, sources and emerging activity."];
  if(path.startsWith("/knowledge/entity/"))return ["Entity Profile","Review entity relationships and the supporting sources."];
  if(path.startsWith("/knowledge"))return ["Knowledge Graph","Explore the relationships recorded from published reporting."];
  if(path.startsWith("/story/"))return ["Event Detail","Review the event timeline and its original sources."];
  if(path.startsWith("/items/"))return ["Original Report","Read the source reporting and its provenance."];
  if(path==="/topics")return ["Topics","Browse research topics and related coverage."];
  if(path.startsWith("/topics/"))return ["Topic Coverage","Explore recent news for this research topic."];
  if(path==="/daily/archive")return ["Daily Archive","Browse earlier source digests."];
  if(path.startsWith("/daily"))return ["Daily Brief","Daily source coverage and reporting."];
  if(path.startsWith("/weekly"))return ["Weekly Brief","Weekly source coverage and reporting."];
  if(path.startsWith("/monthly"))return ["Monthly Brief","Monthly source coverage and reporting."];
  const map:Record<string,[string,string]>={
    "/about":["About","About LivingRuntime and its evidence-linked approach."],
    "/changelog":["Product Updates","Track product releases and changes."],
    "/feedback":["Feedback","Send feedback and content corrections."],
    "/starred":["Saved Reports","Your locally saved reports."],
    "/more":["Settings","Settings, language and tools."],
    "/agent":["Agent Access","Connect MCP, REST and RSS agents."],
    "/privacy":["Privacy Information","How LivingRuntime handles data."],
    "/terms":["Terms of Use","Current service use policies."],
    "/search-busy":["Search Busy","Search is temporarily busy."],
  };
  return map[path]??["LivingRuntime","Research and news with traceable evidence."];
}
const originalMeta=new Map<string,{title:string;description:string|null}>();
export function ClientLanguageMeta(){
  const lang=useUiLanguage();
  const {pathname}=useLocation();
  const entered=useRef<string|null>(null);
  useEffect(()=>{
    const meta=document.querySelector<HTMLMetaElement>('meta[name="description"]');
    // Capture server values only once per page, before replacing them in EN.
    if(!originalMeta.has(pathname))originalMeta.set(pathname,{title:document.title,description:meta?.content??null});
    const original=originalMeta.get(pathname)!;
    if(lang==="en"){
      const [heading,desc]=section(pathname);
      document.title=heading+" · LivingRuntime";
      if(meta)meta.content=desc;
    }else if(entered.current===pathname){
      document.title=original.title;
      if(meta&&original.description!==null)meta.content=original.description;
    }
    entered.current=pathname;
  },[lang,pathname]);
  return null;
}
