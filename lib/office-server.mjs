import {createClient} from '@supabase/supabase-js';
import {checkCrmAccess} from './crm-access.mjs';
import {jwtClaims,isOauthToken} from './killa-mcp-auth.mjs';
export async function officeAuth(request,{allowOAuth=false}={}){
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)throw Object.assign(Error('Sessão obrigatória.'),{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Object.assign(Error('Supabase não configurado.'),{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)throw Object.assign(Error('Token de sessão inválido ou expirado.'),{status:401});
 if(!await checkCrmAccess(db,user))throw Object.assign(Error('Acesso à carteira negado.'),{status:403});
 const claims=jwtClaims(token);
 if(!claims||claims.sub!==user.id)throw Object.assign(Error('Token de sessão não verificável.'),{status:401});
 // oauth_token_not_allowed: prevents a third-party LLM token from calling CRM mutation routes.
 if(isOauthToken(claims)&&!allowOAuth)throw Object.assign(Error('oauth_token_not_allowed: ferramentas externas só podem acessar /mcp.'),{status:403});
 if(allowOAuth&&!isOauthToken(claims))throw Object.assign(Error('O MCP exige OAuth vinculado a um aplicativo autorizado.'),{status:403});
 return {db,user,claims};
}
export function safeOfficeError(error){
 const message=String(error?.message||'Operação indisponível').slice(0,360);
 const status=[400,401,403,404,409,429,503].includes(error?.status)?error.status:502;
 return Response.json({ok:false,error:message},{status,headers:{'Cache-Control':'private,no-store'}});
}
export function officeJson(payload,status=200){
 return Response.json(payload,{status,headers:{'Cache-Control':'private,no-store'}});
}
