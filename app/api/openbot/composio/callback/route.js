import {adminClient} from '../../../../../lib/openbot-connection-server.mjs';
import {listComposioToolkits} from '../../../../../lib/openbot-composio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ROOT='https://agentinfinitum.vercel.app';
const redirect=(status)=>Response.redirect(new URL('/openbot?integrations=1&composio='+encodeURIComponent(status),ROOT),303);

export async function GET(request){
 const url=new URL(request.url);
 const nonce=String(url.searchParams.get('state')||'');
 const status=String(url.searchParams.get('status')||'');
 const accountId=String(url.searchParams.get('connected_account_id')||'');
 if(!/^[A-Za-z0-9_-]{32,100}$/.test(nonce))return redirect('invalid_state');
 try{
  const admin=adminClient();
  const now=new Date().toISOString();
  const consumed=await admin.from('openbot_composio_states').update({used_at:now})
   .eq('nonce',nonce).is('used_at',null).gt('expires_at',now)
   .select('owner_id,toolkit,expected_account_id').maybeSingle();
  if(consumed.error||!consumed.data)return redirect('expired_state');
  const state=consumed.data;
  if(status!=='success'||!/^ca_[A-Za-z0-9_-]{6,180}$/.test(accountId)
   ||accountId!==state.expected_account_id)return redirect('authorization_failed');
  // A callback query parameter is not proof of ownership. Verify the returned
  // account through a fresh Composio session bound to the original CRM user.
  const apps=await listComposioToolkits(state.owner_id,admin);
  const account=apps.find(x=>x.toolkit===state.toolkit&&x.connectedAccountId===accountId&&x.connected);
  if(!account)return redirect('account_not_verified');
  return redirect('connected');
 }catch(error){
  console.error('openbot-composio-callback',String(error?.message||'callback failed').slice(0,120));
  return redirect('verification_failed');
 }
}
