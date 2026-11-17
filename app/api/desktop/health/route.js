export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){
 const nonce=String(process.env.KILLA_LOCAL_NONCE||'');
 if(!/^[a-f0-9]{48}$/.test(nonce))
  return Response.json({ready:false},{status:404,headers:{'Cache-Control':'no-store'}});
 return Response.json({ready:true,nonce},{
  headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 });
}
