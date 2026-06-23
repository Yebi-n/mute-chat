import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith('#')&&line.includes('=')).map((line)=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1).replace(/^['"]|['"]$/g,'')];}));
const url=env.EXPO_PUBLIC_SUPABASE_URL;
const key=env.EXPO_PUBLIC_SUPABASE_ANON_KEY??env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Missing Supabase environment.');
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const sender=make();const receiver=make();
const senderLogin=await sender.auth.signInWithPassword({email:'test-alpha@user.mute.app',password:'mute1234!'});
const receiverLogin=await receiver.auth.signInWithPassword({email:'test-bravo@user.mute.app',password:'mute1234!'});
if(senderLogin.error)throw senderLogin.error;if(receiverLogin.error)throw receiverLogin.error;
sender.realtime.setAuth(senderLogin.data.session.access_token);receiver.realtime.setAuth(receiverLogin.data.session.access_token);
const room={id:'d8646ac4-c09a-47ca-a943-0dfe95957747'};
let broadcastReceived=false;let postgresReceived=false;const statuses=[];
let ready;const subscribed=new Promise((resolve)=>{ready=resolve;});
const receiverChannel=receiver.channel(`transport-${Date.now()}`,{config:{broadcast:{self:true}}})
  .on('broadcast',{event:'probe'},()=>{broadcastReceived=true;})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(payload)=>{if(payload.new.room_id===room.id)postgresReceived=true;})
  .subscribe((status,error)=>{statuses.push({status,error:error?.message??null});if(status==='SUBSCRIBED')ready();});
await Promise.race([subscribed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Subscribe timeout')),10000))]);
await receiverChannel.send({type:'broadcast',event:'probe',payload:{at:Date.now()}});
const inserted=await sender.rpc('send_room_message',{p_room_id:room.id,p_kind:'text',p_body:`transport-${Date.now()}`,p_reply_to_message_id:null,p_secret_recipient_user_id:null,p_media_group_id:null});
if(inserted.error)throw inserted.error;
await new Promise((resolve)=>setTimeout(resolve,4000));
console.log(JSON.stringify({statuses,broadcastReceived,postgresReceived,messageId:inserted.data},null,2));
await receiver.removeChannel(receiverChannel);
process.exit(0);
