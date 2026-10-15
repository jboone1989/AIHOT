import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/knowledge-entity";
import { cachedPage, apiGet } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta } from "../lib/seo";
import { PhoneBar } from "../components/shell/PhoneBar";
import type { Screen } from "../components/shell/screens";
import { KnowledgeExplorer, type KnowledgeGraph } from "../components/KnowledgeNetwork";
import { IconArrowLeft } from "../components/icons";
import { useText,useUiLanguage } from "../components/LanguageSwitch";

export const handle: Screen = { tab: "knowledge", name: "实体档案" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();
export async function loader({ params, request }: Route.LoaderArgs) {
  const entity = await apiGet<KnowledgeGraph & {entity:{key:string;name:string;kind:string}|null}>(`/api/site/knowledge/entities/${encodeURIComponent(params.key)}`,{signal:request.signal, timeoutMs:4_000})
    .catch(()=>({entity:null,entities:0,edges:[],status:"unavailable"} as KnowledgeGraph & {entity:null}));
  return cachedPage(60,{entity});
}
export function meta({loaderData,params}:Route.MetaArgs) {return pageMeta({title:`${loaderData?.entity.entity?.name ?? "实体档案"} · 知识网络`,path:`/knowledge/entity/${encodeURIComponent(params.key)}`,noindex:true});}
export default function KnowledgeEntity() {
  const {entity: data} = useLoaderData<typeof loader>();
  const name=data.entity?.name;
  const t=useText();
  const lang=useUiLanguage();
  const displayName=lang==="en" && name && /[\u3400-\u9fff]/u.test(name) ? "Entity "+data.entity?.key.slice(0,8) : name;
  return (
    <div className="lr-knowledge-page pb-12">
      <PhoneBar back={{to:"/knowledge",label:t("知识网络","Knowledge Graph")}} title={displayName??t("实体档案","Entity Profile")}/>
      <Link to="/knowledge" className="lr-inline-link hidden lg:inline-flex"><IconArrowLeft size={16}/> {t("返回知识网络","Back to Knowledge Graph")}</Link>
      <header className="lr-knowledge-header mt-4">
        <div className="lr-eyebrow">ENTITY PROFILE / {t("知识节点","ENTITY NETWORK")}</div>
        <h1 data-page-title className="lr-page-title mt-4">{displayName ?? t("尚未收录此实体","Entity not found")}</h1>
        <p className="mt-3 text-[14px] leading-[1.8] text-ink-3">{name ? t("沿着已知关系探索该实体，相关事实与来源随新的报道持续更新。","Explore this entity through documented relationships. Sources and facts update as news arrives.") : data.status === "unavailable" ? t("知识网络暂时无法访问。","Knowledge graph temporarily unavailable.") : t("此节点没有可公开展示的关系，或已合并到其他实体。","This entity has no public relationships or has been merged.")}</p>
      </header>
      {name && <div className="mt-7"><KnowledgeExplorer graph={{entities:data.entities,edges:data.edges,status:data.status}}/></div>}
    </div>
  );
}
