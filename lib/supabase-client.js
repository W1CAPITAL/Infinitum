'use client';
import {createClient} from '@supabase/supabase-js';
import {createOfficeAuthStorage} from './supabase-office-storage.mjs';
let client;
export function getClient(){
 // In the signed desktop wrapper, only the PUBLIC key is resolved from the
 // pinned Supabase Edge endpoint and exposed by an isolated preload bridge.
 // Never put service_role, sb_secret or any long-lived private key into an EXE.
 const desktop=typeof window!=='undefined'?window.killaDesktopPublicConfig:null;
 const url=desktop?.supabaseUrl||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=desktop?.publishableKey||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 return client??(client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,storage:createOfficeAuthStorage()}}));
}
