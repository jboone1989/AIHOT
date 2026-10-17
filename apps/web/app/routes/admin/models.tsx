import {Link} from "react-router";
import type {Route} from "./+types/models";
import type {AdminProviderProfile} from "@aihot/contracts/admin";
import {SITE} from "@aihot/site";
import {adminGet} from "../../lib/admin.server";
import {AdminPage} from "../../features/admin/ui";
import {ModelProvidersAdmin} from "../../features/admin/ModelProvidersAdmin";

export async function loader({request}:Route.LoaderArgs){
 return adminGet<{providers:AdminProviderProfile[]}>(request,"/api/admin/model-providers");
}
export const meta:Route.MetaFunction=()=>[{title:"Provider 管理 · "+SITE.name+" 后台"}];
export default function ModelsAdmin({loaderData}:Route.ComponentProps){
 return <AdminPage title="Provider 管理" subtitle="每个模型独立配置请求、能力和状态；批量测试读取各模型自己的请求样例并显示实际耗时。"
  actions={<Link to="/admin/selectbench" className="text-sm text-accent hover:underline">SelectBench 评测 →</Link>}>
  <ModelProvidersAdmin providers={loaderData.providers}/>
 </AdminPage>;
}
