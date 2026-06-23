import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dispatchPendingPushes } from './notifications';
function client(){if(!isSupabaseConfigured||!supabase)throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');return supabase;}
export async function listRoomPromotions(){const {data,error}=await client().from('room_promotions').select('room_id,last_promoted_at,promotion_count').order('last_promoted_at',{ascending:false}).limit(50);if(error)throw error;return data??[];}
export async function promoteRoomOnServer(roomId:string){const {data,error}=await client().rpc('promote_room',{p_room_id:roomId});if(error)throw error;dispatchPendingPushes().catch(()=>undefined);const row=Array.isArray(data)?data[0]:data;return {lastPromotedAt:row.last_promoted_at as string,nextAvailableAt:row.next_available_at as string};}
