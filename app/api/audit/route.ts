import { getAccess } from "@/lib/access";
import { NextRequest,NextResponse } from "next/server";
import {db,requesterHash,validatePublicUrl} from "@/lib/audit-server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const access = await getAccess();
 if (!access) return NextResponse.json({error:"Connexion requise"},{status:401});
 if (access.role === "director") return NextResponse.json({error:"Acces refuse"},{status:403});
 try{
  const body=await req.json();
  const url=await validatePublicUrl(body?.url);
  const strategy=body?.strategy==="desktop"?"desktop":"mobile";
  const ip=req.headers.get("x-forwarded-for")?.split(',')[0]?.trim()||"unknown";
  const client=db();
  const {data,error}=await client.rpc('enqueue_audit',{p_url:url,p_strategy:strategy,p_hash:requesterHash(ip)});
  if(error){const limited=/RATE_LIMIT|QUEUE_FULL/.test(error.message);return NextResponse.json({error:limited?"Limite d'analyses atteinte. Réessayez plus tard.":"Impossible de créer l'analyse."},{status:limited?429:503});}
  return NextResponse.json({id:data,status:"pending"},{status:202});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Demande invalide"},{status:400});}
}
