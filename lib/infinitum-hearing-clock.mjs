// The official notice is the source of the announced clock, not the browser timezone.
const BSB='America/Sao_Paulo';
const UF=['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO'];
const STATES={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'};
const ZONES={AC:'America/Rio_Branco',AM:'America/Manaus',MT:'America/Cuiaba',MS:'America/Campo_Grande',RO:'America/Porto_Velho',RR:'America/Boa_Vista',PE:'America/Recife',BA:'America/Bahia',CE:'America/Fortaleza',PA:'America/Belem',AP:'America/Belem',MA:'America/Fortaleza',PB:'America/Fortaleza',RN:'America/Fortaleza',PI:'America/Fortaleza',AL:'America/Maceio',SE:'America/Maceio',TO:'America/Araguaina'};
const TRT={1:['RJ'],2:['SP'],3:['MG'],4:['RS'],5:['BA'],6:['PE'],7:['CE'],8:['PA','AP'],9:['PR'],10:['DF','TO'],11:['AM','RR'],12:['SC'],13:['PB'],14:['RO','AC'],15:['SP'],16:['MA'],17:['ES'],18:['GO'],19:['AL'],20:['SE'],21:['RN'],22:['PI'],23:['MT'],24:['MS']};
const TRF={1:['AC','AM','AP','BA','DF','GO','MA','MT','PA','PI','RO','RR','TO'],2:['RJ','ES'],3:['SP','MS'],4:['PR','SC','RS'],5:['AL','CE','PB','PE','RN','SE'],6:['MG']};
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const zoneOf=uf=>ZONES[uf]||BSB;
function validZone(v){if(!/^America\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(v))return '';try{new Intl.DateTimeFormat('en-CA',{timeZone:v}).format(0);return v}catch{return ''}}
function tribunalStates(cnj,tribunal){
 const t=norm(tribunal),n=String(cnj||'').replace(/\D/g,'');
 const tj=/^(?:TJ[\s/-]*)([A-Z]{2})\b/.exec(t);if(tj&&STATES[tj[1]])return [tj[1]];
 const section=/\b(?:SJ|JFR?|SECAO JUDICIARIA(?: DE| DO| DA)?)\s*[-/]?\s*([A-Z]{2})\b/.exec(t);
 if(section&&STATES[section[1]])return [section[1]];
 // State names only when explicitly identified as a court/section, not a party address.
 for(const [uf,name] of Object.entries(STATES).sort((a,b)=>b[1].length-a[1].length)){if(t===uf||t===norm(name)||t===('TRIBUNAL DE JUSTICA DE '+norm(name))||t===('TRIBUNAL DE JUSTICA DO '+norm(name))||t===('SECAO JUDICIARIA DE '+norm(name))||t===('SECAO JUDICIARIA DO '+norm(name)))return [uf]}
 if(n.length===20){const j=n[13],r=Number(n.slice(14,16));if(j==='8'||j==='9')return UF[r]?[UF[r]]:[];if(j==='5')return TRT[r]||[];if(j==='4')return TRF[r]||[]}
 const tr=/\b(TRT|TRF)[\s/-]*(\d{1,2})\b/.exec(t);return tr?(tr[1]==='TRT'?TRT:TRF)[Number(tr[2])]||[]:[];
}
function specialPlace(evidence){
 const t=norm(evidence);
 if(/\b(?:COMARCA|VARA|FORO|SUBSECAO JUDICIARIA|HORARIO|MUNICIPIO)\s+(?:DE |DO |DA )?(?:TABATINGA|ATALAIA DO NORTE|BENJAMIN CONSTANT|SANTO ANTONIO DO ICA|SAO PAULO DE OLIVENCA|AMATURA|TONANTINS|JUTAI|ENVIRA|EIRUNEPE|IPIXUNA|GUAJARA|ITAMARATI|BOCA DO ACRE|PAUINI)\b/.test(t))return 'America/Eirunepe';
 if(/\b(?:COMARCA|VARA|FORO|SUBSECAO JUDICIARIA|HORARIO|MUNICIPIO)\s+(?:DE |DO |DA )?MANAUS\b/.test(t))return 'America/Manaus';
 if(/\b(?:COMARCA|VARA|FORO|HORARIO|DISTRITO)\s+(?:DE |DO |DA )?FERNANDO DE NORONHA\b/.test(t))return 'America/Noronha';
 return '';
}
function announcedZone(value,evidence){
 const raw=String(value||'').trim(),iana=validZone(raw);if(iana)return iana;
 const t=norm(raw).replace(/^HORARIO\s+(?:DE|DO|DA)\s+/,'');
 if(t==='BRASILIA'||t==='BRT'||t==='DF')return BSB;
 if(t==='MANAUS')return 'America/Manaus';if(t==='FERNANDO DE NORONHA')return 'America/Noronha';
 if(t==='TABATINGA'||t==='EIRUNEPE')return 'America/Eirunepe';
 if(STATES[t]&&t!=='AM'&&t!=='PE')return zoneOf(t);
 const u=Object.entries(STATES).find(([uf,name])=>norm(name)===t&&uf!=='AM'&&uf!=='PE');if(u)return zoneOf(u[0]);
 const e=norm(evidence);
 if(/\bHORARIO\s+(?:DE|DO|DA)\s+BRASILIA\b/.test(e))return BSB;
 return '';
}
function localZone(states,explicit,evidence){
 const special=specialPlace(evidence);
 if(states.length===1){
  const uf=states[0],label=STATES[uf]+' ('+uf+')';
  if(uf==='AM'){
   const zone=['America/Manaus','America/Eirunepe'].includes(explicit)?explicit:special;
   return {label,zone:['America/Manaus','America/Eirunepe'].includes(zone)?zone:'',warning:'Amazonas tem dois fusos. Confira a comarca e a intimação.'};
  }
  if(uf==='PE'){const zone=explicit==='America/Noronha'||special==='America/Noronha'?'America/Noronha':zoneOf(uf);return {label,zone,warning:zone==='America/Noronha'?'':'Pernambuco continental; confirme se o ato é em Fernando de Noronha.'}}
  return {label,zone:zoneOf(uf),warning:''};
 }
 if(states.length&&states.every(uf=>!['AM','PE'].includes(uf)&&zoneOf(uf)===zoneOf(states[0])))return {label:states.join(' / '),zone:zoneOf(states[0]),warning:'Tribunal abrange mais de um estado.'};
 return {label:states.length?states.join(' / '):'Estado não identificado',zone:'',warning:'Confirme a comarca e o fuso da audiência.'};
}
const fmtDay=s=>s?s.split('-').reverse().join('/'):'';
function civil(date,time){
 const d=String(date||'').slice(0,10),m=/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/.exec(String(time||'').trim());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!m)return null;
 const hour=m[1].padStart(2,'0');const ts=Date.parse(d+'T'+hour+':'+m[2]+':'+(m[3]||'00')+'Z');if(!Number.isFinite(ts)||new Date(ts).toISOString().slice(0,10)!==d)return null;
 return {ts,date:d,time:hour+':'+m[2]};
}
const cache=new Map();
function parts(ms,zone){
 let fmt=cache.get(zone);if(!fmt){fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});cache.set(zone,fmt)}
 const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute,ts:Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z')};
}
function instant(c,zone){
 let ms=c.ts;
 for(let i=0;i<4;i++){const diff=c.ts-parts(ms,zone).ts;if(!diff)return ms;ms+=diff}
 return parts(ms,zone).ts===c.ts?ms:null;
}
export function hearingClock({date,time,cnj,tribunal,fuso,evidence}={}){
 const c=civil(date,time),states=tribunalStates(cnj,tribunal),explicit=announcedZone(fuso,evidence),local=localZone(states,explicit,evidence);
 const raw=String(fuso||'').trim(),rawLabel=norm(raw).replace(/^HORARIO\s+(?:DE|DO|DA)\s+/,'');
 // If a nonempty timezone label is not recognized, do not reinterpret it as local.
 const sameState=states.length===1&&(rawLabel===states[0]||rawLabel===norm(STATES[states[0]]));
 const origin=explicit||(!raw||sameState||/^(?:HORARIO LOCAL|LOCAL|HORARIO DO TRIBUNAL)$/i.test(norm(raw))?local.zone:'');
 const ms=c&&origin?instant(c,origin):null;
 return {localLabel:local.label,localZone:local.zone,sourceZone:origin,announced:c?{date:c.date,time:c.time}:null,
  local:ms!==null&&local.zone?parts(ms,local.zone):null,brasilia:ms!==null?parts(ms,BSB):null,
  warning:!c?'Horário não informado ou inválido.':!origin?'Fuso do horário publicado não confirmado. '+local.warning:local.warning,
  inferred:!explicit&&!!origin};
}
export function hearingClockLines(clock){
 if(!clock)return {local:'Horário local: não informado',brasilia:'Brasília: não informado',note:'Confira a intimação.'};
 const display=(v)=>v?v.time+(clock.announced?.date!==v.date?' · '+fmtDay(v.date):''):'a confirmar';
 return {local:clock.localLabel+': '+display(clock.local),brasilia:'Brasília: '+display(clock.brasilia),note:[clock.announced&&(!clock.local||!clock.brasilia)?'Horário registrado: '+clock.announced.time:'',clock.inferred?'Conversão pelo fuso do tribunal; confirme a fonte oficial.':'',clock.warning].filter(Boolean).join(' ')};
}
