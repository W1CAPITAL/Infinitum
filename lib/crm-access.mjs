import {ADMIN_EMAIL} from './login.mjs';

// A company role is stored separately from the human-readable cargo.
// cargo is protected by column-level grants: authenticated users may update
// only nome/avatar_url, never cargo or role. Do not use email or user metadata.
const normalizeRoleLabel=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\s_-]+/g,' ').trim();
const COMPANY_ADMIN_LABELS=new Set(['admin','administrador','superadmin','super admin']);

export function isLexisCompanyAdmin(profile={}) {
 return [profile.role,profile.cargo].some(value=>COMPANY_ADMIN_LABELS.has(normalizeRoleLabel(value)));
}

// Uma sessão Supabase válida não basta: é necessário pertencer à carteira.
export async function checkLexisCompanyAccess(db,user) {
 if(!db?.from||!user?.id)return false;
 try{
  const {data,error}=await db.from('usuarios').select('auth_user_id,empresa_id,nome')
   .eq('auth_user_id',user.id).limit(2);
  return !error&&Array.isArray(data)&&data.length===1
   &&data[0].auth_user_id===user.id&&!!data[0].empresa_id&&!!data[0].nome;
 }catch{return false}
}

export async function checkCrmAccess(db,user) {
 // Uma conta pode ser administradora no CRM antigo e ainda assim não
 // pertencer à empresa autenticada no Lexis. Nunca aplicar bypass por e-mail.
 if(process.env.NEXT_PUBLIC_LEXIS_SHARED_DB==='1')
  return checkLexisCompanyAccess(db,user);
 if(!user?.id||!user?.email)return false;
 if(user.email.toLowerCase()===ADMIN_EMAIL)return true;
 if(!db?.from)return false;
 try{
  const {data,error}=await db.from('crm_memberships')
   .select('enabled,role').eq('user_id',user.id).eq('enabled',true).maybeSingle();
  return !error&&data?.enabled===true&&['admin','operator'].includes(data.role);
 }catch{return false}
}
