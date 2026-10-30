import {NextResponse} from "next/server";
import {db} from "@/lib/audit-server";
export const runtime="nodejs";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Identifiant invalide"},{status:400});
 try{
  const {data,error}=await db().from('audit_jobs').select('status,result,error').eq('id',id).single();
  if(error||!data)return NextResponse.json({error:"Analyse introuvable"},{status:404});
  return NextResponse.json({status:data.status,...(data.status==='completed'?{result:data.result}:{}),...(data.status==='failed'?{error:data.error}: {})},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:"Service indisponible"},{status:503});}
}
