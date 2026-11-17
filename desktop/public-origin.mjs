/** The only canonical remote address is one explicitly configured by the operator. */
export function validatedPublicOrigin(value) {
 const raw=String(value||'').trim();
 if(!raw)return null;
 let url;
 try{url=new URL(raw)}catch{return null}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||url.port||
  (url.pathname!=='/'&&url.pathname!=='')||url.search||url.hash||
  !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)||
  /(^|\.)vercel\.app$/.test(host)||
  /(^|\.)(localhost|local|internal|invalid)$/.test(host)||
  /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host))
  return null;
 return url.origin;
}
export function publicOAuthOrigin(env=process.env) {
 const origin=validatedPublicOrigin(env.NEXT_PUBLIC_SITE_URL);
 if(!origin)throw Object.assign(Error('Configure NEXT_PUBLIC_SITE_URL com a origem HTTPS oficial do INFINITUM fora da Vercel.'),{status:503});
 return origin;
}
