import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith('#')&&line.includes('=')).map((line)=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1).replace(/^['"]|['"]$/g,'')];}));
const url=env.EXPO_PUBLIC_SUPABASE_URL;
const key=env.EXPO_PUBLIC_SUPABASE_ANON_KEY??env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Supabase public environment variables are missing.');

const makeClient=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const owner=makeClient();
const member=makeClient();
const password='mute1234!';
const fail=(label,error)=>{throw new Error(`${label}: ${error?.message??error}`);};

const ownerLogin=await owner.auth.signInWithPassword({email:'test-alpha@user.mute.app',password});
if(ownerLogin.error)fail('owner login',ownerLogin.error);
const memberLogin=await member.auth.signInWithPassword({email:'test-bravo@user.mute.app',password});
if(memberLogin.error)fail('member login',memberLogin.error);
owner.realtime.setAuth(ownerLogin.data.session.access_token);
member.realtime.setAuth(memberLogin.data.session.access_token);

let roomId;
const existing=await owner.from('rooms').select('id').eq('name','실시간 검증방').is('deleted_at',null).limit(1).maybeSingle();
if(existing.error)fail('find room',existing.error);
roomId=existing.data?.id;
if(!roomId){
  const created=await owner.rpc('create_room',{p_name:'실시간 검증방',p_description:'자동 실시간 및 알림 검증용 비공개 방',p_category:'concept',p_max_members:3,p_region:null});
  if(created.error)fail('create room',created.error);
  roomId=created.data;
  const profile=await owner.rpc('set_room_owner_profile',{p_room_id:roomId,p_display_name:'알파',p_introduction:'자동 검증 계정',p_avatar_upload_id:null});
  if(profile.error)fail('owner profile',profile.error);
}

const activeMembership=await member.from('room_memberships').select('id').eq('room_id',roomId).eq('status','active').limit(1);
if(activeMembership.error)fail('member lookup',activeMembership.error);
if(!activeMembership.data?.length){
  const pending=await member.from('room_join_requests').select('id').eq('room_id',roomId).eq('status','pending').limit(1);
  if(pending.error)fail('pending lookup',pending.error);
  let requestId=pending.data?.[0]?.id;
  if(!requestId){
    const request=await member.rpc('request_room_join_v2',{p_room_id:roomId,p_name:'브라보',p_introduction:'실시간 수신 검증',p_avatar_upload_id:null});
    if(request.error)fail('join request',request.error);
    const row=await owner.from('room_join_requests').select('id').eq('room_id',roomId).eq('status','pending').eq('user_id',memberLogin.data.user.id).single();
    if(row.error)fail('request lookup',row.error);
    requestId=row.data.id;
  }
  const approval=await owner.rpc('decide_room_join',{p_request_id:requestId,p_approve:true});
  if(approval.error)fail('approve member',approval.error);
}

const privateRoom=await owner.rpc('configure_room_access',{p_room_id:roomId,p_visibility:'private',p_pin:'654321'});
if(privateRoom.error)fail('make room private',privateRoom.error);
await member.rpc('set_room_notifications_enabled',{p_room_id:roomId,p_enabled:true});

let realtimeReceived=false;
let realtimeMessageId=null;
const realtimeMessageIds=[];
let resolveSubscribed;
const subscribed=new Promise((resolve)=>{resolveSubscribed=resolve;});
const channel=member.channel(`verify-${Date.now()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(payload)=>{if(payload.new.room_id===roomId){realtimeReceived=true;realtimeMessageId=payload.new.id;realtimeMessageIds.push(payload.new.id);}}).subscribe((status)=>{if(status==='SUBSCRIBED')resolveSubscribed();});
await Promise.race([subscribed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Realtime subscription timed out.')),10000))]);

const marker=`realtime-${Date.now()}`;
const sent=await owner.rpc('send_room_message',{p_room_id:roomId,p_kind:'text',p_body:marker,p_reply_to_message_id:null,p_secret_recipient_user_id:null,p_media_group_id:null});
if(sent.error)fail('send message',sent.error);
for(let index=0;index<20&&!realtimeReceived;index+=1)await new Promise((resolve)=>setTimeout(resolve,250));

const received=await member.from('messages').select('id,body').eq('id',sent.data).maybeSingle();
if(received.error)fail('read message',received.error);
await new Promise((resolve)=>setTimeout(resolve,500));
const inboxOn=await member.from('user_notifications').select('id').eq('event_type','chat_message').contains('data',{messageId:sent.data});
if(inboxOn.error)fail('notification inbox',inboxOn.error);
const outboxOn=await member.from('push_outbox').select('id,sent_at,failed_at,failure_reason').contains('data',{messageId:sent.data});
if(outboxOn.error)fail('push outbox',outboxOn.error);
const dispatch=await owner.functions.invoke('send-push-outbox',{body:{}});
if(dispatch.error)fail('push dispatch',dispatch.error);
const outboxDispatched=await member.from('push_outbox').select('id,sent_at,failed_at,failure_reason').contains('data',{messageId:sent.data});
if(outboxDispatched.error)fail('push dispatch state',outboxDispatched.error);

const disable=await member.rpc('set_room_notifications_enabled',{p_room_id:roomId,p_enabled:false});
if(disable.error)fail('disable room notifications',disable.error);
await new Promise((resolve)=>setTimeout(resolve,2100));
const mutedMarker=`muted-${Date.now()}`;
const mutedSent=await owner.rpc('send_room_message',{p_room_id:roomId,p_kind:'text',p_body:mutedMarker,p_reply_to_message_id:null,p_secret_recipient_user_id:null,p_media_group_id:null});
if(mutedSent.error)fail('send muted message',mutedSent.error);
await new Promise((resolve)=>setTimeout(resolve,600));
const inboxOff=await member.from('user_notifications').select('id').contains('data',{messageId:mutedSent.data});
if(inboxOff.error)fail('muted notification inbox',inboxOff.error);
const outboxOff=await member.from('push_outbox').select('id').contains('data',{messageId:mutedSent.data});
if(outboxOff.error)fail('muted push outbox',outboxOff.error);
await member.rpc('set_room_notifications_enabled',{p_room_id:roomId,p_enabled:true});
await member.removeChannel(channel);

console.log(JSON.stringify({
  roomId,
  messagePersisted:received.data?.body===marker,
  realtimeReceived:realtimeReceived&&realtimeMessageIds.includes(sent.data),
  realtimeMessageIds,
  notificationInboxQueued:(inboxOn.data?.length??0)>0,
  pushOutboxQueued:(outboxOn.data?.length??0)>0,
  pushDispatchState:outboxDispatched.data?.[0]??outboxOn.data?.[0]??null,
  roomNotificationsOffBlockedInbox:(inboxOff.data?.length??0)===0,
  roomNotificationsOffBlockedPush:(outboxOff.data?.length??0)===0,
},null,2));
