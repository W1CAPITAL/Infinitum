// After an already reported/stalled movement, do not equate DataJud's old
// snapshot with a newly checked process. Two authenticated, non-stale official
// source snapshots are required before saying "no new confirmed movement".
const when=value=>{const n=Date.parse(String(value||''));return Number.isFinite(n)?n:null};
const safeSource=(s)=>String(s||'').toLowerCase();
export function assessOpenBotPostReturnResearch({caseRow={},snapshots=[],now=new Date()}={}){
 const last=when(caseRow.ultimo_retorno),movement=when(caseRow.datajud_ultimo_movimento||caseRow.ultima_movimentacao);
 const since=now instanceof Date?now.getTime():when(now)||Date.now();
 if(last===null||movement!==null&&movement>last)return {
  ok:true,reason:'newer_movement_or_no_prior_return',checkedAt:null,researchRequired:false
 };
 const rows=Array.isArray(snapshots)?snapshots:[];
 const verified=[];
 for(const kind of ['datajud','djen']){
  const source=rows.filter(x=>safeSource(x?.source)===kind)
   .sort((a,b)=>(when(b.checked_at)||0)-(when(a.checked_at)||0))[0];
  const at=when(source?.checked_at);
  const payload=source?.payload;
  if(at===null||at<last||at>since+300000||since-at>7*86400000||!payload
   ||payload.stale===true||payload.partial===true||payload.ok===false
   ||safeSource(payload.source)!==kind)
   return {ok:false,reason:'official_'+kind+'_research_required',checkedAt:null,researchRequired:true};
  const items=Array.isArray(payload.items)?payload.items:[];
  for(const item of items.slice(0,100)){
   const atItem=when(item?.dataHora||item?.data||item?.date||item?.eventDate||item?.publishedAt);
   if(atItem===null)return {ok:false,reason:'unparsed_official_event_requires_review',
    checkedAt:null,researchRequired:false};
   if(atItem>last)return {ok:false,reason:'new_official_activity_requires_review',
    checkedAt:null,researchRequired:false};
  }
  verified.push({kind,at});
 }
 return {ok:true,reason:'both_official_sources_checked_after_last_return',
  checkedAt:new Date(Math.min(...verified.map(x=>x.at))).toISOString(),researchRequired:false};
}
