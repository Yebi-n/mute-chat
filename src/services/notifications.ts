import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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
    const { error } = await supabase.from('push_devices').upsert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      platform: Platform.OS,
      push_token: token,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'push_token' });
    if (error) throw error;
  }
  return token;
}
