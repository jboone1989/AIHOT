export const ADAPTERS=["chat","embedding","document","safety","special","unconfigured"] as const;
export type ProviderAdapterKind=typeof ADAPTERS[number];
export const COMPLEXITIES=["light","medium","heavy"] as const;
export type Complexity=typeof COMPLEXITIES[number];
export const CAPABILITIES=["text","reasoning","vision","embedding","embedding_vision","document","safety","translation","coding","video","reward"] as const;
export type ModelCapability=typeof CAPABILITIES[number];

/** One model's own request sample and response shape; no user-defined timeout. */
export interface ProviderProbeSpec {
 capability:ModelCapability;
 body:Record<string,unknown>;
 response:"chat"|"embedding"|"json";
 source?:string;
}
/** Every independently configured model is a provider instance, not an entry in a global model switch. */
export interface ProviderProfile{
 vendor:string;modelId:string;adapter:ProviderAdapterKind;endpoint:string|null;
 credentialEnv:string;capabilities:ModelCapability[];
 requestDefaults:Record<string,unknown>;probeSpec:ProviderProbeSpec|null;timeoutMs:number;stream:boolean;
 complexity:Complexity;documentationUrl:string|null;notes:string|null;
 enabled:boolean;routeEnabled:boolean;version:number;updatedAt:string;
 checks:Array<{capability:string;status:string;verifiedAt:string|null;latencyMs:number|null}>;
}
export type ProviderChanges=Partial<Pick<ProviderProfile,"adapter"|"endpoint"|"capabilities"|"requestDefaults"|"probeSpec"|"stream"|"complexity"|"documentationUrl"|"notes"|"enabled"|"routeEnabled">>;
