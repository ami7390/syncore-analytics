import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function db() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error("Configuration Supabase Audit manquante");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function privateIp(ip:string) {
 if (isIP(ip)===6) return true; // Conservative: disallow all IPv6 in this prototype
 const a=ip.split('.').map(Number);
 if(a.length!==4||a.some(x=>!Number.isInteger(x)||x<0||x>255))return true;
 return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&[18,19].includes(a[1])||a[0]===192&&a[1]===0;
}
export async function validatePublicUrl(raw:string){
 if(typeof raw!=="string"||raw.length>2048)throw new Error("URL invalide");
 let url:URL;try{url=new URL(raw)}catch{throw new Error("URL invalide")}
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.hostname.length>253||!url.hostname.includes('.')||isIP(url.hostname))throw new Error("Seules les URL HTTPS publiques sont autorisées");
 const host=url.hostname.toLowerCase();
 if(/(^|\.)(localhost|local|internal|test|invalid|onion|arpa)$/.test(host)||host.endsWith('.localhost'))throw new Error("Domaine interdit");
 const addresses=await lookup(host,{all:true,verbatim:true});
 if(!addresses.length||addresses.some(a=>privateIp(a.address)))throw new Error("Adresse réseau non publique");
 url.hash='';return url.toString();
}
export function requesterHash(ip:string){
 const secret=process.env.AUDIT_HASH_SECRET;
 if(!secret||secret.length<24)throw new Error("AUDIT_HASH_SECRET manquant ou trop court");
 return createHash('sha256').update(secret+':'+ip).digest('hex');
}
