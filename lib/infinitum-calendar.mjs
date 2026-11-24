// Pure calendar ranges: local civil dates, Monday-first, inclusive boundaries.
export function civilDay(value){
 const s=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:null;
}
export function shiftCivilDay(value,amount){
 if(!civilDay(value)||!Number.isInteger(amount))return null;
 const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);
}
export function calendarBounds(anchor,view='month'){
 if(!civilDay(anchor))throw Error('Data de referência inválida.');
 if(view==='day')return {start:anchor,end:anchor,days:[anchor]};
 if(view==='week'){const d=new Date(anchor+'T12:00:00Z');const start=shiftCivilDay(anchor,-(d.getUTCDay()+6)%7);return {start,end:shiftCivilDay(start,6),days:Array.from({length:7},(_,i)=>shiftCivilDay(start,i))}}
 const [y,m]=anchor.split('-').map(Number),first=anchor.slice(0,7)+'-01',end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 const d=new Date(first+'T12:00:00Z'),start=shiftCivilDay(first,-((d.getUTCDay()+6)%7));
 return {start:first,end,days:Array.from({length:42},(_,i)=>shiftCivilDay(start,i))};
}
export function hearingView(item,filter,today){
 if(item?.kind!=='audiencia')return false;
 const realized=item.hearing_outcome==='realizada';
 const canceled=item.hearing_outcome==='cancelada'||(!realized&&item.status==='encerrado');
 const future=!!item.due_on&&item.due_on>=today&&!realized&&!canceled;
 if(filter==='realizadas')return realized;
 if(filter==='canceladas'||filter==='encerrado')return canceled;
 if(filter==='vencido')return !!item.due_on&&item.due_on<today&&!realized&&!canceled;
 if(filter==='futuras')return future;
 if(filter==='agendadas')return future&&item.hearing_class==='agendada';
 if(filter==='informadas')return future&&item.hearing_class==='informada';
 if(filter==='sessoes')return future&&item.hearing_class==='sessao';
 if(filter==='manuais')return !!item.manual_id;
 return filter==='todos'||item.status===filter;
}
export function hearingCounts(items,today){
 const filters=['agendadas','futuras','informadas','sessoes','vencido','realizadas','canceladas','manuais'];
 return Object.fromEntries(filters.map(key=>[key,items.filter(x=>hearingView(x,key,today)).length]));
}
