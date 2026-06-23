import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith('#')&&line.includes('=')).map((line)=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1).replace(/^['"]|['"]$/g,'')];}));
const url=env.EXPO_PUBLIC_SUPABASE_URL;
const key=env.EXPO_PUBLIC_SUPABASE_ANON_KEY??env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Supabase public environment variables are missing.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email:'test-alpha@user.mute.app',password:'mute1234!'});
if(login.error)throw login.error;
const result=await client.rpc('get_realtime_diagnostics');
if(result.error)throw result.error;
console.log(JSON.stringify(result.data,null,2));
