export type Strategy = "mobile" | "desktop";
export type AuditResult = { strategy:Strategy; scores:Record<string,number|null>; metrics:Record<string,string>; opportunities:{title:string;description:string}[]; fetchedAt:string; url:string };
const categories=["performance","accessibility","best-practices","seo"];
export async function fetchPageSpeed(url:string,strategy:Strategy):Promise<AuditResult>{
 const endpoint=new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");endpoint.searchParams.set("url",url);endpoint.searchParams.set("strategy",strategy);
 for(const c of categories)endpoint.searchParams.append("category",c);
 if(process.env.PAGESPEED_API_KEY)endpoint.searchParams.set("key",process.env.PAGESPEED_API_KEY);
 const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(115000)});
 const json=await response.json();if(!response.ok||!json.lighthouseResult)throw new Error(json.error?.message||"Analyse PageSpeed indisponible.");
 const lhr=json.lighthouseResult;const scores:Record<string,number|null>={};for(const c of categories)scores[c]=typeof lhr.categories?.[c]?.score==="number"?Math.round(lhr.categories[c].score*100):null;
 const metrics:Record<string,string>={};for(const [key,label] of [["first-contentful-paint","FCP"],["largest-contentful-paint","LCP"],["speed-index","Speed Index"],["total-blocking-time","TBT"],["cumulative-layout-shift","CLS"]])metrics[label]=lhr.audits?.[key]?.displayValue||"Non disponible";
 const opportunities=Object.values(lhr.audits||{}).filter((v:any)=>v?.details?.type==="opportunity"&&v?.score!==null&&v?.score<0.9).slice(0,8).map((v:any)=>({title:String(v.title),description:String(v.description||"").replace(/<[^>]+>/g,"").slice(0,240)}));
 return {strategy,scores,metrics,opportunities,fetchedAt:new Date().toISOString(),url:lhr.finalUrl||url};
}
