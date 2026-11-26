const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const digits=s=>String(s??'').replace(/\D/g,'');
export function publicationDay(value){
 const raw=String(value??''),m=/^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/.exec(raw),b=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
 const day=m?m.slice(1,4).join('-'):b?[b[3],b[2],b[1]].join('-'):'';
 if(!day)return '';const dt=new Date(day+'T12:00:00Z');return Number.isFinite(+dt)&&dt.toISOString().slice(0,10)===day?day:'';
}
export function brazilDay(now=new Date()){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(k=>p.find(x=>x.type===k)?.value).join('-');
}
export function publicationLink(value){const s=String(value||'').trim();if(!/^https:\/\/[a-z0-9.-]+(?:\/|[?#]|$)/i.test(s)||/[\u0000-\u0020\\]/.test(s))return '';try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:''}catch{return ''}}
function details(title,description){
 const t=norm(title),d=norm(description);
 if(!/\bintimacao\b/.test(t)&&!/\b(?:intimacao|intime-se|intimem-se|fica(?:m)? intimad[oa]s?)\b/.test(d))return null;
 const phase=/\breplica\b|impugnacao (?:a|da) contestacao/.test(d)?'Réplica':/\bpericia\b|\bpericial\b|\blaudo\b/.test(d)?'Perícia / laudo':/\bprovas?\b|\binstrucao probatoria\b/.test(d)?'Provas':/\b(?:documentos?|comprovantes?)\b/.test(d)?'Documentos':'Intimação';
 const action=phase==='Réplica'?'Conferir necessidade de réplica com o advogado.':phase==='Provas'?'Conferir quais provas foram solicitadas.':phase==='Perícia / laudo'?'Conferir a providência sobre perícia ou laudo.':phase==='Documentos'?'Conferir quais documentos foram solicitados.':'Ler a intimação e confirmar a providência com o advogado.';
 const excerpt=description.split(/(?<=[.!?;])\s+/).find(s=>/\b(?:intime-se|intimem-se|intimad[oa]s?|prazo|apresentar|juntar|manifestar|especificar|providenciar)\b/.test(norm(s)))||description||title;
 const term=description.match(/(?:no prazo de|prazo de|em até|dentro de)\s+\d{1,3}\s*(?:\([^)]{1,30}\)\s*)?(?:dias(?: úteis| corridos)?|horas|meses)\b/i);
 return {phase,summary:excerpt.length>320?excerpt.slice(0,319)+'…':excerpt,action,deadline:term?term[0]:'Não informado no trecho'};
}
export function monthlyNotices(cases=[],snapshots=[],month=brazilDay().slice(0,7),today=brazilDay()){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return [];
 const portfolio=new Map();for(const c of cases){const n=digits(c.protocolo||c.protocolo_ref);if(n.length===20&&!portfolio.has(n))portfolio.set(n,c)}
 const records=[],seen=new Set();
 function add(c,ev,source){
  const n=digits(c.protocolo||c.protocolo_ref),day=publicationDay(ev.date);
  if(!day||day.slice(0,7)!==month||day>today)return;
  const title=clean(ev.title),description=clean(ev.description),info=details(title,description);if(!info)return;
  const link=publicationLink(ev.link),id=String(ev.id||'');
  const keys=[link&&n+'|'+day+'|'+link,id&&!/^djen-\d+$/.test(id)&&n+'|'+day+'|'+id,n+'|'+day+'|'+norm(description||title)].filter(Boolean);
  if(keys.some(k=>seen.has(k)))return;keys.forEach(k=>seen.add(k));
  records.push({key:keys[0],client:c.cliente||'Cliente não informado',cnj:c.protocolo||c.protocolo_ref,date:day,...info,lawyer:c.advogado||'Não atribuído',link,source});
 }
 for(const s of [...snapshots].sort((a,b)=>String(b.checked_at||'').localeCompare(String(a.checked_at||'')))){
  const c=portfolio.get(digits(s.process_number));if(!c||String(s.source).toLowerCase()!=='djen'||s.payload?.ok===false)continue;
  for(const ev of (Array.isArray(s.payload?.items)?s.payload.items:[]))if(String(ev.source||'DJEN').toUpperCase()==='DJEN')add(c,ev,'Histórico DJEN');
 }
 for(const c of portfolio.values())add(c,{date:c.djen_ultima_data,description:c.djen_ultimo_resumo,link:c.djen_ultimo_link},'Última publicação cadastrada');
 return records.sort((a,b)=>b.date.localeCompare(a.date)||a.client.localeCompare(b.client,'pt-BR')||a.cnj.localeCompare(b.cnj));
}
export async function loadMonthlyDjenHistory(db,companyId,month,{pageSize=100,maxRows=12000}={}){
 if(!companyId||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Empresa ou mês inválido.');
 const rows=[];const start=month+'-01T00:00:00-03:00';
 for(let from=0;from<=maxRows;){
  const size=Math.min(pageSize,maxRows-from+1);
  const {data,error}=await db.from('crm_judicial_snapshots').select('id,empresa_id,process_number,source,checked_at,payload').eq('empresa_id',companyId).eq('source','djen').gte('checked_at',start).order('id',{ascending:true}).range(from,from+size-1);
  if(error)throw Error('Histórico DJEN indisponível: '+String(error.message||'falha').slice(0,150));
  const batch=data||[];if(batch.some(x=>x.empresa_id!==companyId))throw Error('Histórico fora da empresa autorizada.');
  rows.push(...batch);if(rows.length>maxRows)throw Error('Histórico acima do limite de segurança. Não foi possível carregar todos os registros.');
  if(batch.length<size)return rows;from+=batch.length;
 }
 return rows;
}
export const NOTICE_HEADERS=['Cliente','Processo','Disponibilização','Fase / assunto','Resumo da intimação','Providência a conferir','Prazo informado','Advogado','Publicação oficial'];
export const NOTICE_WIDTHS=[33,28,17,22,67,49,29,30,52];
export function noticeCells(row){const [y,m,d]=String(row.date||'').split('-');return [row.client,row.cnj,y&&m&&d?d+'/'+m+'/'+y:'',row.phase,row.summary,row.action,row.deadline,row.lawyer,row.link||'Link não disponível']}
