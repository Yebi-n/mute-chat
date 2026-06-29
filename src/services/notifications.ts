import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ServerNotice = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

let foregroundRoomId: string | null = null;

export function setForegroundRoomId(roomId: string | null) {
  foregroundRoomId = roomId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const roomId = typeof data.roomId === 'string' ? data.roomId : null;
    const shouldSuppressRoomAlert =
      Boolean(foregroundRoomId && roomId && foregroundRoomId === roomId);
    return {
      shouldPlaySound: !shouldSuppressRoomAlert,
      shouldSetBadge: true,
      shouldShowBanner: !shouldSuppressRoomAlert,
      shouldShowList: !shouldSuppressRoomAlert,
    };
  },
});

export async function registerPushDevice() {
  if (!Device.isDevice || Platform.OS === 'web') return null;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: '채팅 및 가입 알림',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  if (isSupabaseConfigured && supabase) {
    const enabled=await getGlobalNotificationsEnabled();
    const { error } = await supabase.rpc('register_push_device', {
      p_platform: Platform.OS,
      p_push_token: token,
      p_enabled: enabled,
    });
    if (error) throw error;
  }
  return token;
}

export async function unregisterPushDevice() {
  if (!Device.isDevice || Platform.OS === 'web') return;
  if (!isSupabaseConfigured || !supabase) return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  if (!token) return;
  const { error } = await supabase
    .from('push_devices')
    .update({ enabled: false, last_seen_at: new Date().toISOString() })
    .eq('push_token', token);
  if (error) throw error;
}

export async function listMyRoomSummaries() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('get_my_room_summaries');
  if (error) throw error;
  const rows = (data ?? []) as {
    room_id: string;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number | string;
  }[];
  return rows.map((row) => ({
    roomId: row.room_id as string,
    lastMessage: row.last_message as string | null,
    lastMessageAt: row.last_message_at as string | null,
    unreadCount: Number(row.unread_count),
  }));
}

export async function getGlobalNotificationsEnabled() {
  if (!isSupabaseConfigured || !supabase) return true;
  const { data, error } = await supabase.rpc('get_global_notifications_enabled');
  if (error) throw error;
  return data !== false;
}

export async function setGlobalNotificationsEnabled(enabled: boolean) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('set_global_notifications_enabled', { p_enabled: enabled });
  if (error) throw error;
}

async function invokePushOutbox() {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.functions.invoke('send-push-outbox', { body: {} });
  if (error) throw error;
}

let lastPushFlushScheduledAt = 0;

export async function dispatchPendingPushes() {
  await invokePushOutbox();
  const now = Date.now();
  if (now - lastPushFlushScheduledAt < 2000) return;
  lastPushFlushScheduledAt = now;
  [800, 2200, 5000].forEach((delay) => {
    setTimeout(() => {
      invokePushOutbox().catch(() => undefined);
    }, delay);
  });
}

export async function listNotificationInbox(limit = 50): Promise<ServerNotice[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,event_type,title,body,data,read_at,created_at')
    .in('event_type', ['join_request', 'room_kicked', 'story', 'story_comment'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    eventType: row.event_type as string,
    title: row.title as string,
    body: row.body as string,
    data: (row.data ?? {}) as Record<string, unknown>,
    readAt: row.read_at as string | null,
    createdAt: row.created_at as string,
  }));
}

export async function markNotificationRead(notificationId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export async function markRoomJoinRequestNotificationsRead(roomId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('mark_room_join_request_notifications_read', {
    p_room_id: roomId,
  });
  if (error) throw error;
}
