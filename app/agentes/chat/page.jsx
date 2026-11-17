import {redirect} from 'next/navigation';

const allowedBots=new Set(['killa','atlas','nox','scout','echo','lexis']);
export default async function Page({searchParams}){
 const params=await searchParams;
 const bot=allowedBots.has(params?.bot)?params.bot:'killa';
 const query=new URLSearchParams({view:'chat',bot});
 for(const key of ['thread','new','integrations','models']){
  const value=params?.[key];
  if(typeof value==='string'&&value.length<=180)query.set(key,value);
 }
 redirect('/agentes?'+query.toString());
}
