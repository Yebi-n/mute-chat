// Import only the APIs used by the app. The package root also imports
// DevicePushTokenAutoRegistration.fx, which reads legacy Keychain state as a
// module side effect and can abort iOS before React finishes mounting.
export {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
} from "expo-notifications/build/NotificationsEmitter";
export { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
export {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
export { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
export { getExpoPushTokenAsync } from "expo-notifications/build/getExpoPushTokenAsync";
export { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
export type { NotificationResponse } from "expo-notifications/build/Notifications.types";
