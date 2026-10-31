"use client";
import {useEffect,useRef,useState} from "react";
import type {AuditResult,Strategy} from "@/lib/pagespeed";
const names:Record<string,string>={performance:"Performance",accessibility:"Accessibilité","best-practices":"Bonnes pratiques",seo:"SEO technique"};
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export default function Analyzer(){
 const [url,setUrl]=useState("");const [strategy,setStrategy]=useState<Strategy>("mobile");const [results,setResults]=useState<Partial<Record<Strategy,AuditResult>>>({});const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [cached,setCached]=useState(false);const [progress,setProgress]=useState("");const active=useRef(true);const busy=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 async function analyze(s:Strategy){
  if(busy.current)return;busy.current=true;setLoading(true);setError("");setProgress("Envoi de la demande...");setStrategy(s);
  try{
   const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,strategy:s})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Analyse impossible");
   if(typeof j.jobId!=="string")throw new Error("Identifiant d'analyse manquant.");
   setProgress("Analyse en attente du moteur Lighthouse (quelques minutes possibles)...");
   const deadline=Date.now()+20*60*1000;
   while(active.current&&Date.now()<deadline){
    await wait(10000);if(!active.current)return;
    const statusResponse=await fetch(`/api/analyze/status?id=${encodeURIComponent(j.jobId)}`,{cache:"no-store"});const status=await statusResponse.json();if(!statusResponse.ok)throw new Error(status.error||"Suivi indisponible");
    if(status.status==="completed"){
     if(!status.result)throw new Error("Resultat manquant");
     setResults(prev=>({...prev,[s]:status.result as AuditResult}));setCached(false);setProgress("");return;
    }
    if(status.status==="failed")throw new Error(status.error||"L'analyse a echoue.");
    if(status.status==="running")setProgress("Lighthouse analyse votre site...");
   }
   if(active.current)throw new Error("L'analyse prend plus de temps que prevu. Veuillez reessayer plus tard.");
  }catch(e){if(active.current)setError(e instanceof Error?e.message:"Erreur")}finally{busy.current=false;if(active.current){setLoading(false);setProgress("")}}
 }
 async function pdf(){const r=results[strategy];if(!r)return;const {jsPDF}=await import("jspdf");const doc=new jsPDF();let y=20;doc.setFontSize(20);doc.text("Syncore Analytics",16,y);y+=12;doc.setFontSize(11);doc.text("Rapport Lighthouse - "+strategy,16,y);y+=9;doc.text(doc.splitTextToSize("URL : "+r.url,175),16,y);y+=18;for(const [key,value] of Object.entries(r.scores)){doc.text(`${names[key]} : ${value??"N/A"}/100`,16,y);y+=9}y+=8;doc.text("Indicateurs techniques",16,y);y+=9;for(const [k,v] of Object.entries(r.metrics)){doc.text(`${k} : ${v}`,16,y);y+=8}y+=7;doc.text("Pistes d'amelioration",16,y);y+=9;for(const o of r.opportunities){const lines=doc.splitTextToSize("- "+o.title,170);if(y+lines.length*6>270){doc.addPage();y=20}doc.text(lines,16,y);y+=lines.length*6+3}doc.save("syncore-lighthouse-"+strategy+".pdf")}
 const result=results[strategy];return <><div className="panel" style={{maxWidth:820,margin:"auto"}}><form onSubmit={e=>{e.preventDefault();setResults({});setCached(false);void analyze(strategy)}} className="formline"><input className="field" type="url" required placeholder="https://www.exemple.com" value={url} onChange={e=>setUrl(e.target.value)}/><button className="btn" disabled={loading}>{loading?"Analyse en cours…":"Analyser mon site"}</button></form><div className="chips"><span className="chip">✓ Analyse réelle Google</span><span className="chip">✓ Mobile et ordinateur</span><span className="chip">✓ Rapport PDF</span></div></div>{progress&&<p className="muted" style={{marginTop:20}}>{progress}</p>}{error&&<div className="error" style={{marginTop:20}}>{error}</div>}{Object.keys(results).length>0&&<div style={{marginTop:34}}><div className="tabs"><button disabled={loading} className={strategy==="mobile"?"active":""} onClick={()=>{setStrategy("mobile");if(!results.mobile)void analyze("mobile")}}>Mobile</button><button disabled={loading} className={strategy==="desktop"?"active":""} onClick={()=>{setStrategy("desktop");if(!results.desktop)void analyze("desktop")}}>Ordinateur</button></div>{result?<><div className="grid">{Object.entries(result.scores).map(([key,val])=><div className="panel score" key={key}><strong style={{color:val===null?"#777":val>=90?"#27845e":val>=50?"#b17a20":"#b84d42"}}>{val??"—"}</strong><small>{names[key]}</small></div>)}</div><h2 className="sectiontitle">Indicateurs de chargement</h2><div className="detail">{Object.entries(result.metrics).map(([k,v])=><div className="panel" key={k}><span className="muted">{k}</span><b>{v}</b></div>)}</div><h2 className="sectiontitle">Améliorations suggérées</h2><div className="panel">{result.opportunities.length?result.opportunities.map((o,i)=><div key={i} style={{marginBottom:16}}><b>{o.title}</b><p className="muted" style={{lineHeight:1.6}}>{o.description}</p></div>):<p className="muted">Aucune opportunité majeure signalée par cette analyse.</p>}<button className="btn" onClick={pdf}>Télécharger le rapport PDF</button></div><p className="muted" style={{fontSize:12}}>{cached?"Résultat en cache (6 h maximum). ":""}Analyse du {new Date(result.fetchedAt).toLocaleString("fr-FR")}. Les scores peuvent varier entre deux mesures.</p></>:<p>Analyse en cours…</p>}</div>}</>}
