import {killaResourceMetadata} from '../../../lib/killa-mcp-oauth.mjs';
export const dynamic='force-dynamic';
export function GET(){
 const data=killaResourceMetadata();
 return data?Response.json(data,{headers:{'Cache-Control':'public,max-age=300'}}):
 Response.json({error:'Servidor de autenticação indisponível.'},{status:503});
}
