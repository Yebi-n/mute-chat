import { isSupabaseConfigured, supabase } from '../lib/supabase';

function client(){if(!isSupabaseConfigured||!supabase)throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');return supabase;}

export type ChatEntitlement={productId:string;type:string;value?:string|null;expiresAt:string};
export type RoomChatStyle={userId:string;bubbleColor:string;textColor:string;backgroundColor:string;bubbleProductId?:string;textProductId?:string;backgroundProductId?:string};

export async function listActiveChatEntitlements():Promise<ChatEntitlement[]>{
  const {data,error}=await client().rpc('get_my_active_chat_entitlements_v2');if(error)throw error;
  return ((data??[]) as Array<{product_id:string;entitlement_type:string;value?:string|null;expires_at:string}>).map((row)=>({productId:row.product_id,type:row.entitlement_type,value:row.value??null,expiresAt:row.expires_at}));
}

export async function listRoomChatStyles(roomId:string):Promise<RoomChatStyle[]>{
  const {data,error}=await client().rpc('get_room_chat_styles',{p_room_id:roomId});if(error)throw error;
  return ((data??[]) as Array<{user_id:string;bubble_color:string;text_color:string;background_color:string;bubble_product_id:string|null;text_product_id:string|null;background_product_id:string|null}>).map((row)=>({userId:row.user_id,bubbleColor:row.bubble_color,textColor:row.text_color,backgroundColor:row.background_color,bubbleProductId:row.bubble_product_id??undefined,textProductId:row.text_product_id??undefined,backgroundProductId:row.background_product_id??undefined}));
}

export async function saveMyRoomChatStyle(input:{roomId:string;bubbleColor:string;bubbleProductId?:string;textColor:string;textProductId?:string;backgroundColor:string;backgroundProductId?:string}){
  const {error}=await client().rpc('set_my_room_chat_style',{p_room_id:input.roomId,p_bubble_color:input.bubbleColor,p_bubble_product_id:input.bubbleProductId??null,p_text_color:input.textColor,p_text_product_id:input.textProductId??null,p_background_color:input.backgroundColor,p_background_product_id:input.backgroundProductId??null});if(error)throw error;
}

export async function purchaseCustomBackground(){const {data,error}=await client().rpc('purchase_custom_background');if(error)throw error;return Array.isArray(data)?data[0]:data;}

export async function setCustomChatEntitlementValue(productId:string,value:string){
  const {data,error}=await client().rpc('set_custom_chat_entitlement_value',{p_product_id:productId,p_value:value});
  if(error)throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function expireMyChatEntitlement(productId:string){
  const {error}=await client().rpc('expire_my_chat_entitlement',{p_product_id:productId});
  if(error)throw error;
}
