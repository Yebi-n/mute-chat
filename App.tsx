import { Ionicons as RNIonicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import * as Clipboard from "expo-clipboard";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as ScreenCapture from "expo-screen-capture";
import * as SecureStore from "expo-secure-store";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import ExternalColorPicker, {
  BrightnessSlider,
  InputWidget,
  Panel3,
} from "reanimated-color-picker";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator as RNActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Linking,
  Platform,
  Pressable as RNPressable,
  RefreshControl,
  SafeAreaView as RNSafeAreaView,
  ScrollView as RNScrollView,
  Share,
  StyleSheet,
  StatusBar as RNStatusBar,
  Switch as RNSwitch,
  Text as RNText,
  TextProps,
  TextInput as RNTextInput,
  View as RNView,
  PanResponder,
  Keyboard,
  Dimensions,
} from "react-native";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";
import {
  checkPhoneSignUpStatus,
  getCurrentSession,
  normalizeKoreanPhoneNumber,
  requestPasswordRecoveryOtp,
  requestSignUpPhoneOtp,
  resendPhoneOtp,
  signInWithAdminId,
  signInWithTestId,
  signInWithPhonePassword,
  signOut,
  signUpWithPhonePassword,
  changeCurrentUserPassword,
  updateCurrentUserPassword,
  verifyPhoneOtp,
} from "./src/services/auth";
import {
  clearRoomCover,
  clearRoomProfileAvatar,
  createRoom,
  decideRoomJoin,
  getRoomById,
  listMyActiveRoomIds,
  listMyOwnedRoomIds,
  listPendingRoomJoinRequests,
  listPendingRoomJoinRequestsWithAvatars,
  listRoomMembersVisible,
  listRooms,
  requestRoomJoinWithAvatar,
  setRoomCover,
  setRoomOwnerProfile,
  updateRoom,
  ServerRoom,
  ServerRoomMember,
} from "./src/services/rooms";
import {
  getOperationsPolicyUrl,
  getVerificationStatus,
} from "./src/services/verification";
import {
  schedulePendingPushDispatch,
  getGlobalNotificationsEnabled,
  listMyRoomSummaries,
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
  markRoomJoinRequestNotificationsRead,
  registerPushDevice,
  clearForegroundRoomId,
  ServerNotice,
  setForegroundRoomId,
  setGlobalNotificationsEnabled,
} from "./src/services/notifications";
import {
  clearRoomMemberMute,
  configureRoomAccess,
  deleteRoom,
  getRoomNotificationsEnabled,
  kickOrBanRoomMember,
  leaveRoom,
  listBlockedRoomMembers,
  listDepartedRoomMembers,
  listPinnedRoomIds,
  setRoomMemberMute,
  setRoomMemberRole,
  setRoomNotificationsEnabled,
  setRoomPinned,
  transferRoomOwnership,
  unbanRoomMember,
  verifyRoomPin,
} from "./src/services/roomFeatures";
import {
  announceStoryCreated,
  getLatestRoomMessageCursor,
  getRoomMessageCreatedAt,
  getRoomReadReceipt,
  listRoomMessages,
  listRoomReadReceipts,
  markRoomRead,
  searchRoomMessages,
  sendSecretMessage,
  softDeleteMyMessage,
  sendSystemMessage,
  sendTextMessage,
  ServerRoomMessage,
} from "./src/services/chat";
import { sendUploadedImages, uploadValidatedImage } from "./src/services/media";
import {
  acceptSignupCompliance,
  blockUser,
  listReportedRoomIds,
  requestAccountDeletion,
  submitReport,
} from "./src/services/safety";
import {
  addStoryComment,
  createStoryWithBlocks,
  deleteStory,
  deleteStoryComment,
  listStories,
  recordStoryView,
  ServerStory,
  StoryBlockInput,
  toggleStoryLike,
  updateStoryContent,
} from "./src/services/stories";
import {
  claimPointReward,
  getMyWallet,
  initializeAds,
  listPointLedger,
  showRewardedAd,
} from "./src/services/monetization";
import {
  configurePurchases,
  listStoreEntitlements,
  purchaseProduct,
  purchaseStoreProduct,
  resetPurchaseConfiguration,
  restoreStorePurchases,
  STORE_PRODUCTS,
} from "./src/services/purchases";
import {
  listStoreTransactions,
  StoreTransactionItem,
} from "./src/services/payments";
import { boostTopSpace, listTopSpaces } from "./src/services/topSpace";
import {
  listRoomPromotions,
  promoteRoomOnServer,
} from "./src/services/promotions";
import {
  listActiveChatEntitlements,
  listRoomChatStyles,
  saveMyRoomChatStyle,
  setCustomChatEntitlementValue,
  expireMyChatEntitlement,
  ChatEntitlement,
  RoomChatStyle,
} from "./src/services/chatStyles";
import { colors, radius, shadows, spacing } from "./src/theme";
import { MainTab, Room } from "./src/types";
import InlineBannerAd from "./src/components/InlineBannerAd";
import {
  SCREENSHOT_DEMO_ENABLED,
  screenshotDemoMembers,
  screenshotDemoRooms,
  screenshotDemoUnreadCounts,
} from "./src/screenshotDemo";

const ANDROID_STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0;

type Screen =
  | "main"
  | "search"
  | "ranking"
  | "detail"
  | "apply"
  | "chat"
  | "settings"
  | "adultVerification"
  | "create"
  | "editRoom";
type AppStackParamList = {
  Main: undefined;
  Search: undefined;
  Ranking: undefined;
  Detail: undefined;
  Apply: undefined;
  Chat: undefined;
  EditRoom: undefined;
  Settings: undefined;
  AdultVerification: undefined;
  Create: undefined;
};
const AppStack = createNativeStackNavigator<AppStackParamList>();
const appNavigationRef = createNavigationContainerRef<AppStackParamList>();
type BottomTab = "discover" | "myRooms" | "stories" | "profile";
type IconName = keyof typeof Ionicons.glyphMap;
type ChatPanel =
  | "stories"
  | "overview"
  | "members"
  | "blocked"
  | "applications"
  | "profile"
  | "roomSettings"
  | null;
type ChatStackParamList = {
  ChatMain: undefined;
  ChatOverview: undefined;
  ChatStories: undefined;
  ChatApplications: undefined;
  ChatMembers: undefined;
  ChatBlocked: undefined;
  ChatRoomSettings: undefined;
};
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
type ComposerTool = "media" | "style" | "secret" | null;
const CHAT_COLLAPSE_CHAR_THRESHOLD = 140;
const CHAT_COLLAPSE_LINE_LIMIT = 4;
const DEMO_ROOM_ID = "green-table";
const SCREENSHOT_DEMO_ROOM_IDS = new Set(
  screenshotDemoRooms.map((room) => room.id),
);
function isScreenshotDemoRoomId(roomId: string) {
  return SCREENSHOT_DEMO_ENABLED && SCREENSHOT_DEMO_ROOM_IDS.has(roomId);
}
function isLocalDemoRoomId(roomId: string) {
  return isScreenshotDemoRoomId(roomId) || roomId === DEMO_ROOM_ID;
}
const DEMO_ROOM: Room = {
  id: DEMO_ROOM_ID,
  name: "테스트 방",
  description: "내부 확인용 방입니다.",
  tags: [],
  memberCount: 38,
  maxMembers: 50,
  region: "서울",
  category: "general",
  topSpaceCount: 34,
  isPromoted: true,
  isActive: true,
  emoji: "○",
  imageColor: "#E8ECEA",
  isSample: true,
};
const DEMO_PUBLIC_STORY_ROOM = DEMO_ROOM;
const EMPTY_ROOM: Room = {
  id: "",
  name: "",
  description: "",
  tags: [],
  memberCount: 0,
  maxMembers: 1,
  category: "general",
  topSpaceCount: 0,
  emoji: "○",
  imageColor: "#E8ECEA",
};
type RoomMember = {
  userId?: string;
  name: string;
  intro: string;
  avatarUri?: string;
  owner?: boolean;
  mine?: boolean;
  coHost?: boolean;
  blocked?: boolean;
  mutedUntil?: string | null;
};
type TopSpacePackage = { points: number; seconds: number; boosts: number };
type ColorProduct = {
  color: string;
  name: string;
  price: number;
  productId?: string;
};
type Notice = {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  time: string;
  read: boolean;
  roomId?: string;
  storyId?: string;
  destination?:
    | "chat"
    | "detail"
    | "applications"
    | "stories"
    | "promotion";
};
type StoryVisibility = "room" | "public";
type StoryBlock =
  | { id: string; type: "text"; text: string }
  | {
      id: string;
      type: "image";
      uri: string;
      uploadId?: string;
      storagePath?: string;
      mimeType?: string;
    };
type StoryComment = {
  id: string;
  author: string;
  authorAvatarUri?: string;
  body: string;
  createdAt: string;
  mine?: boolean;
};
type StoryItem = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  author: string;
  authorAvatarUri?: string;
  createdAt: string;
  visibility: StoryVisibility;
  blocks: StoryBlock[];
  comments: StoryComment[];
  views: number;
  hearts: number;
  liked?: boolean;
  mine?: boolean;
};
type ChatDelivery = "sending" | "sent" | "failed";
type ChatBase = {
  id: string;
  userId?: string | null;
  createdAt?: string;
  delivery?: ChatDelivery;
  uploadProgress?: number;
  uploadProgressLabel?: string;
  bubbleColor?: string;
  textColor?: string;
  pendingUploadAssets?: ChatImageAsset[];
};
type ChatMessage =
  | (ChatBase & {
      kind: "text";
      mine: boolean;
      name: string;
      avatarUri?: string;
      text: string;
      time: string;
      replyTo?: { id: string; name: string; text: string };
    })
  | (ChatBase & {
      kind: "image";
      mine: boolean;
      name: string;
      avatarUri?: string;
      imageUris?: string[];
      time: string;
      replyTo?: { id: string; name: string; text: string };
    })
  | (ChatBase & {
      kind: "story";
      mine: boolean;
      name: string;
      avatarUri?: string;
      storyId: string;
      title: string;
      preview: string;
      imageUri?: string;
      time: string;
    })
  | (ChatBase & {
      kind: "secret";
      mine: boolean;
      name: string;
      avatarUri?: string;
      recipient: string;
      text: string;
      time: string;
      replyTo?: { id: string; name: string; text: string };
    })
  | (ChatBase & {
      kind: "system";
      event: "join" | "heart" | "point" | "leave" | "room" | "kick";
      text: string;
    });

type ChatSearchResult = {
  id: string;
  createdAt: string;
  text: string;
};

function normalizedChatMessageId(id: string) {
  return id.startsWith("server-") ? id.slice(7) : id;
}

function chatMessageMergeKey(message: ChatMessage) {
  if (message.kind === "story" && message.storyId) {
    return `story:${message.storyId}`;
  }
  return normalizedChatMessageId(message.id);
}

function sortChatMessages(messages: ChatMessage[]) {
  return [...messages].sort((first, second) => {
    const firstTime = Date.parse(first.createdAt ?? "") || 0;
    const secondTime = Date.parse(second.createdAt ?? "") || 0;
    return firstTime === secondTime
      ? normalizedChatMessageId(first.id).localeCompare(
          normalizedChatMessageId(second.id),
        )
      : firstTime - secondTime;
  });
}

function mergeChatMessages(...groups: ChatMessage[][]) {
  const byKey = new Map<string, ChatMessage>();
  groups.flat().forEach((message) => {
    const normalized =
      message.kind === "story"
        ? message
        : { ...message, id: normalizedChatMessageId(message.id) };
    byKey.set(chatMessageMergeKey(normalized), normalized);
  });
  return sortChatMessages([...byKey.values()]);
}

function screenshotDemoChatMessages(myDisplayName: string): ChatMessage[] {
  return [
    {
      id: "demo-chat-1",
      userId: "demo-user-sora",
      kind: "text",
      mine: false,
      name: "소라",
      avatarUri: "https://i.pravatar.cc/300?img=32",
      text: "오늘 발견한 사진 한 장씩 공유해볼래?",
      time: "오후 7:24",
      createdAt: "2026-07-01T10:24:00.000Z",
    },
    {
      id: "demo-chat-2",
      userId: "demo-user-me",
      kind: "text",
      mine: true,
      name: myDisplayName || "하루",
      avatarUri: "https://i.pravatar.cc/300?img=47",
      text: "좋아! 나는 노을 사진 올려볼게.",
      time: "오후 7:25",
      createdAt: "2026-07-01T10:25:00.000Z",
    },
    {
      id: "demo-chat-3",
      userId: "demo-user-jun",
      kind: "text",
      mine: false,
      name: "준",
      avatarUri: "https://i.pravatar.cc/300?img=12",
      text: "나도 참여할게. 재미있는 앨범을 하나 찾았어.",
      time: "오후 7:26",
      createdAt: "2026-07-01T10:26:00.000Z",
    },
    {
      id: "demo-chat-heart",
      kind: "system",
      event: "heart",
      text: "소라님이 하루님에게 하트를 보냈습니다.",
      createdAt: "2026-07-01T10:26:30.000Z",
    },
    {
      id: "demo-chat-reply",
      userId: "demo-user-me",
      kind: "text",
      mine: true,
      name: myDisplayName || "하루",
      avatarUri: "https://i.pravatar.cc/300?img=47",
      text: "당연하지. 다 보고 감상도 남겨줘!",
      time: "오후 7:27",
      createdAt: "2026-07-01T10:27:00.000Z",
      replyTo: {
        id: "demo-chat-3",
        name: "준",
        text: "나도 참여할게. 재미있는 앨범을 하나 찾았어.",
      },
    },
    {
      id: "demo-chat-secret",
      userId: "demo-user-sora",
      kind: "secret",
      mine: false,
      name: "소라",
      avatarUri: "https://i.pravatar.cc/300?img=32",
      recipient: myDisplayName || "하루",
      text: "준 생일 축하 메시지는 자정에 같이 올리자.",
      time: "오후 7:28",
      createdAt: "2026-07-01T10:28:00.000Z",
    },
    {
      id: "demo-chat-images",
      userId: "demo-user-jun",
      kind: "image",
      mine: false,
      name: "준",
      avatarUri: "https://i.pravatar.cc/300?img=12",
      imageUris: [
        "https://picsum.photos/seed/mute-gallery-1/900/900",
        "https://picsum.photos/seed/mute-gallery-2/900/900",
        "https://picsum.photos/seed/mute-gallery-3/1200/700",
      ],
      time: "오후 7:29",
      createdAt: "2026-07-01T10:29:00.000Z",
    },
    {
      id: "demo-chat-final",
      userId: "demo-user-sora",
      kind: "text",
      mine: false,
      name: "소라",
      avatarUri: "https://i.pravatar.cc/300?img=32",
      bubbleColor: "#E7F3EE",
      textColor: "#3F9A70",
      text: "분위기 좋다. 여기로 정하자!",
      time: "오후 7:30",
      createdAt: "2026-07-01T10:30:00.000Z",
    },
  ];
}
const IOS_HIDE_ADULT_UI = Platform.OS === "ios";
const SCREEN_WIDTH=Dimensions.get("window").width;
const CHAT_IMAGE_GRID_WIDTH = Math.min(196, Math.floor(SCREEN_WIDTH * 0.48));
const CHAT_IMAGE_GRID_CELL = Math.floor((CHAT_IMAGE_GRID_WIDTH - 2) / 2);
const PIN_ICON_SOURCE = require("./assets/pin-gray.png");
const APP_LOCK_ENABLED_KEY = "mute:app-lock:enabled";
const APP_LOCK_PIN_KEY = "mute:app-lock:pin";
const APP_LOCK_SECURE_PIN_KEY = "mute_app_lock_pin";
const PRIVACY_POLICY_URL =
  "https://service-introduction-theta.vercel.app/privacy/";
const FIXED_POINT_COLOR = "#3F9A70";
const FIXED_POINT_SOFT = "#EFF9F5";

async function readAppLockPin() {
  if (Platform.OS === "web") return AsyncStorage.getItem(APP_LOCK_PIN_KEY);

  const secured = await SecureStore.getItemAsync(APP_LOCK_SECURE_PIN_KEY);
  if (secured !== null) return secured;

  // Migrate PINs saved by versions released before SecureStore was introduced.
  const legacy = await AsyncStorage.getItem(APP_LOCK_PIN_KEY);
  if (legacy !== null) {
    await SecureStore.setItemAsync(APP_LOCK_SECURE_PIN_KEY, legacy, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.removeItem(APP_LOCK_PIN_KEY);
  }
  return legacy;
}

async function writeAppLockPin(pin: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(APP_LOCK_PIN_KEY, pin);
    return;
  }
  await SecureStore.setItemAsync(APP_LOCK_SECURE_PIN_KEY, pin, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.removeItem(APP_LOCK_PIN_KEY);
}

async function clearAppLockCredentials() {
  await AsyncStorage.multiRemove([APP_LOCK_ENABLED_KEY, APP_LOCK_PIN_KEY]);
  if (Platform.OS !== "web") {
    try {
      await SecureStore.deleteItemAsync(APP_LOCK_SECURE_PIN_KEY);
    } catch {
      // SecureStore can reject legacy/invalid native keys during logout on
      // some upgraded installs. Local logout must not be blocked by cleanup.
    }
  }
}
const LOCAL_PENDING_MESSAGES = new Map<string, ChatMessage[]>();
const ROOM_SCROLL_STATE = new Map<
  string,
  { offsetY: number; nearBottom: boolean }
>();

const BASE_CATEGORIES: { key: MainTab; label: string }[] = [
  { key: "promotion", label: "프로모션" },
  { key: "member", label: "Member" },
  { key: "concept", label: "콘셉트" },
  { key: "region", label: "지역별" },
];

const AdFreeContext = createContext(false);
const useAdFree = () => useContext(AdFreeContext);

let globalBusyCount = 0;
const globalBusyListeners = new Set<(busy: boolean) => void>();
function updateGlobalBusy(delta: number) {
  globalBusyCount = Math.max(0, globalBusyCount + delta);
  globalBusyListeners.forEach((listener) => listener(globalBusyCount > 0));
}
function GlobalBusyOverlay() {
  const [busy, setBusy] = useState(globalBusyCount > 0);
  useEffect(() => {
    globalBusyListeners.add(setBusy);
    return () => {
      globalBusyListeners.delete(setBusy);
    };
  }, []);
  if (!busy) return null;
  return (
    <View style={s.globalBusyLayer}>
      <View style={s.globalBusyCard}>
        <ActivityIndicator color={colors.mint700} />
      </View>
    </View>
  );
}

type AppPressableProps = React.ComponentProps<typeof RNPressable> & {
  allowRapidPress?: boolean;
  preserveTheme?: boolean;
};

function Pressable(props: AppPressableProps) {
  const { allowRapidPress, preserveTheme, style, ...pressableProps } = props;
  const lastPressAt = useRef(0);
  const onPress = props.onPress;
  return (
    <RNPressable
      {...pressableProps}
      style={
        typeof style === "function"
          ? (state) =>
              preserveTheme ? style(state) : themedStyle(style(state), "view")
          : preserveTheme
            ? style
            : themedStyle(style, "view")
      }
      onPress={
        onPress
          ? (event) => {
              const now = Date.now();
              if (!allowRapidPress && now - lastPressAt.current < 700) return;
              lastPressAt.current = now;
              const result = onPress(event) as unknown;
              if (
                result &&
                typeof (result as Promise<unknown>).then === "function"
              ) {
                let shown = false;
                const timer = setTimeout(() => {
                  shown = true;
                  updateGlobalBusy(1);
                }, 180);
                void Promise.resolve(result)
                  .catch((error) => {
                    console.warn("Unhandled press action", error);
                  })
                  .finally(() => {
                    clearTimeout(timer);
                    if (shown) updateGlobalBusy(-1);
                  });
              }
            }
          : undefined
      }
    />
  );
}

function StatusBar(_props: {
  style?: "auto" | "inverted" | "light" | "dark";
  hidden?: boolean;
}) {
  const theme = useAppTheme();
  const resolvedStyle = _props.style ?? (theme.id === "dark" ? "light" : "dark");
  const androidBackgroundColor =
    resolvedStyle === "light" ? "#222222" : "#FFFFFF";
  return (
    <>
      {Platform.OS === "android" ? (
        <RNStatusBar
          barStyle={resolvedStyle === "light" ? "light-content" : "dark-content"}
          backgroundColor={androidBackgroundColor}
          hidden={_props.hidden ?? false}
          translucent
        />
      ) : null}
      {Platform.OS !== "android" ? (
        <ExpoStatusBar
          style={resolvedStyle}
          hidden={_props.hidden ?? false}
        />
      ) : null}
    </>
  );
}

const LINK_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

type AppTheme = {
  id: string;
  name: string;
  productId?: string;
  legacyProductIds?: string[];
  priceKrw?: number;
  gradient: [string, string];
  accent: string;
};
const APP_THEMES: AppTheme[] = [
  { id: "mint", name: "기본 테마", gradient: ["#82B9C1", "#5DBB8C"], accent: "#4FAE7D" },
  { id: "ocean", name: "오션", productId: STORE_PRODUCTS.themeOcean, legacyProductIds: [STORE_PRODUCTS.legacyThemeOcean], priceKrw: 4900, gradient: ["#82B4D3", "#6898C9"], accent: "#5F91C5" },
  { id: "lavender", name: "라벤더", productId: STORE_PRODUCTS.themeLavender, legacyProductIds: [STORE_PRODUCTS.legacyThemeLavender], priceKrw: 4900, gradient: ["#B3A1D1", "#9C87C4"], accent: "#927BC0" },
  { id: "sunset", name: "선셋", productId: STORE_PRODUCTS.themeSunset, legacyProductIds: [STORE_PRODUCTS.legacyThemeSunset], priceKrw: 4900, gradient: ["#E4A095", "#DB8592"], accent: "#D77E8C" },
  { id: "mono", name: "모노", productId: STORE_PRODUCTS.themeMono, legacyProductIds: [STORE_PRODUCTS.legacyThemeMono], priceKrw: 4900, gradient: ["#747A7E", "#585D61"], accent: "#62686C" },
  { id: "white", name: "화이트", productId: STORE_PRODUCTS.themeWhite, legacyProductIds: [STORE_PRODUCTS.legacyThemeWhite], priceKrw: 3900, gradient: ["#FFFFFF", "#FFFFFF"], accent: "#1C1C1C" },
  { id: "dark", name: "다크", productId: STORE_PRODUCTS.themeDark, legacyProductIds: [STORE_PRODUCTS.legacyThemeDark], priceKrw: 3900, gradient: ["#222222", "#222222"], accent: "#D2D2D2" },
];
let activeAppTheme = APP_THEMES[0];
const appThemeListeners = new Set<(theme: AppTheme) => void>();
const SPLASH_THEME_STORAGE_KEY = "mute.splash-theme";
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const themeStorageKey = (userId?: string | null) =>
  userId ? `mute.app-theme:${userId}` : "mute.app-theme:anonymous";
const themeOwnershipStorageKey = (userId: string) =>
  `mute.app-theme-entitlements:${userId}`;

async function readCachedThemeProductIds(userId: string) {
  const raw = await AsyncStorage.getItem(themeOwnershipStorageKey(userId));
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

async function cacheThemeProductIds(userId: string, productIds: string[]) {
  const themeProductIds = new Set(
    APP_THEMES.flatMap((theme) => [
      ...(theme.productId ? [theme.productId] : []),
      ...(theme.legacyProductIds ?? []),
    ]),
  );
  const owned = [...new Set(productIds.filter((id) => themeProductIds.has(id)))];
  await AsyncStorage.setItem(
    themeOwnershipStorageKey(userId),
    JSON.stringify(owned),
  );
}
function applyAppTheme(theme: AppTheme) {
  activeAppTheme = theme;
  appThemeListeners.forEach((listener) => listener(theme));
}
function selectAppTheme(theme: AppTheme, userId?: string | null) {
  applyAppTheme(theme);
  void AsyncStorage.setItem(themeStorageKey(userId), theme.id);
  void AsyncStorage.setItem(SPLASH_THEME_STORAGE_KEY, theme.id);
}
async function loadStoredAppTheme(
  userId?: string | null,
  ownedProductIds: string[] = [],
) {
  const stored =
    (await AsyncStorage.getItem(themeStorageKey(userId))) ??
    (userId ? null : await AsyncStorage.getItem("mute.app-theme"));
  const found = APP_THEMES.find((theme) => theme.id === stored);
  const allowed =
    found &&
    (!found.productId ||
      ownedProductIds.includes(found.productId) ||
      (found.legacyProductIds ?? []).some((id) => ownedProductIds.includes(id)));
  const selected = allowed ? found : APP_THEMES[0];
  applyAppTheme(selected);
  await AsyncStorage.setItem(SPLASH_THEME_STORAGE_KEY, selected.id);
}

async function loadSplashTheme() {
  const stored = await AsyncStorage.getItem(SPLASH_THEME_STORAGE_KEY);
  const found = APP_THEMES.find((theme) => theme.id === stored);
  applyAppTheme(found ?? APP_THEMES[0]);
}
function themeForeground(theme: AppTheme) {
  return theme.id === "white" ? "#222222" : "#FFF";
}
function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function useAppTheme() {
  const [theme, setTheme] = useState(activeAppTheme);
  useEffect(() => {
    appThemeListeners.add(setTheme);
    return () => {
      appThemeListeners.delete(setTheme);
    };
  }, []);
  return theme;
}

const ACCENT_COLORS = new Set([
  "#82B9C1",
  "#5DBB8C",
  "#4FAE7D",
  "#3F9A70",
  "#2E7654",
  "#9ED8BF",
]);
const SOFT_ACCENT_COLORS = new Set(["#EFF9F5", "#DDF2E7", "#F4FBF7"]);
const GREEN_SHADOW_COLORS = new Set(["#365440", "#235D39", "#1F3A2C"]);
const TRANSLUCENT_ACCENT_COLORS = new Map([
  ["RGBA(93,187,140,.12)", "1F"],
  ["RGBA(93,187,140,.18)", "2E"],
  ["RGBA(93,187,140,.45)", "73"],
  ["RGBA(93,187,140,.85)", "D9"],
]);
const GREEN_TINTED_NEUTRALS = new Map([
  ["#E8ECEA", "#E8E8E8"],
  ["#E9ECEA", "#E9E9E9"],
  ["#ECEFED", "#ECECEC"],
  ["#E7E9E8", "#E8E8E8"],
  ["#D7DDD9", "#D9D9D9"],
]);

function normalizeHex(value: unknown) {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function themedColor(value: unknown, property: string) {
  if (typeof value !== "string") return value;
  const theme = activeAppTheme;
  const normalized = normalizeHex(value);

  const neutral = GREEN_TINTED_NEUTRALS.get(normalized);
  if (neutral) return neutral;
  if (ACCENT_COLORS.has(normalized)) return theme.accent;
  if (SOFT_ACCENT_COLORS.has(normalized)) {
    return theme.id === "dark" ? "#303030" : "#F3F3F3";
  }
  const accentAlpha = TRANSLUCENT_ACCENT_COLORS.get(normalized);
  if (accentAlpha) return `${theme.accent}${accentAlpha}`;
  if (property === "shadowColor" && GREEN_SHADOW_COLORS.has(normalized)) {
    return "#6B6B6B";
  }
  if (
    theme.id === "white" &&
    property === "color" &&
    ["#FFFFFF", "#FFF"].includes(normalized)
  ) {
    return "#222222";
  }
  if (theme.id !== "dark") return value;

  if (property === "color" || property === "tintColor") {
    if (["#1C1C1C", "#222222"].includes(normalized)) return "#F5F5F5";
    if (["#555F5A", "#5F6864", "#5D5D5D"].includes(normalized))
      return "#D0D0D0";
    if (["#8E9692", "#BAC1BD", "#8E8E8E", "#BDBDBD"].includes(normalized))
      return "#A7A7A7";
  }
  if (property === "backgroundColor") {
    if (["#FFFFFF", "#FFF"].includes(normalized)) return "#222222";
    if (
      ["#F7F8F7", "#F7F7F7", "#F5F5F5", "#F3F5F4", "#F3F3F3", "#F0F2F1", "#F1F1F1", "#F0F1F1"].includes(
        normalized,
      )
    )
      return "#2B2B2B";
  }
  if (property.toLowerCase().includes("border")) {
    if (
      ["#E7EAE8", "#E7E7E7", "#D9DEDB", "#DADADA", "#BAC1BD", "#BDBDBD", "#FFFFFF", "#FFF"].includes(
        normalized,
      )
    )
      return "#3C3C3C";
  }
  return value;
}

function themedStyle(style: unknown, kind: "text" | "view") {
  if (!style) return style as never;
  const flat = StyleSheet.flatten(style as never) as
    | Record<string, unknown>
    | undefined;
  if (!flat) return style as never;
  const next: Record<string, unknown> = { ...flat };
  const properties =
    kind === "text"
      ? ["color", "backgroundColor", "borderColor", "borderBottomColor"]
      : [
          "backgroundColor",
          "borderColor",
          "borderTopColor",
          "borderBottomColor",
          "borderLeftColor",
          "borderRightColor",
          "shadowColor",
          "tintColor",
        ];
  properties.forEach((property) => {
    if (property in next) next[property] = themedColor(next[property], property);
  });
  return next;
}

function View(props: React.ComponentProps<typeof RNView>) {
  return <RNView {...props} style={themedStyle(props.style, "view")} />;
}

function SafeAreaView(props: React.ComponentProps<typeof RNSafeAreaView>) {
  const insets = useSafeAreaInsets();
  const styled = themedStyle(props.style, "view");
  const flattenedStyle = (StyleSheet.flatten(styled) ?? {}) as {
    paddingTop?: number | string;
    paddingBottom?: number | string;
  };
  const basePaddingTop =
    typeof flattenedStyle.paddingTop === "number"
      ? flattenedStyle.paddingTop
      : 0;
  const basePaddingBottom =
    typeof flattenedStyle.paddingBottom === "number"
      ? flattenedStyle.paddingBottom
      : 0;
  const androidTopInset = Math.max(insets.top, RNStatusBar.currentHeight ?? 0);
  const androidPaddingTop =
    Platform.OS === "android" ? basePaddingTop + androidTopInset : undefined;
  const androidPaddingBottom =
    Platform.OS === "android" && insets.bottom > 0
      ? basePaddingBottom + insets.bottom
      : undefined;
  return (
    <RNSafeAreaView
      {...props}
      style={[
        styled,
        androidPaddingTop ? { paddingTop: androidPaddingTop } : null,
        androidPaddingBottom ? { paddingBottom: androidPaddingBottom } : null,
      ]}
    />
  );
}

function KeyboardAvoidingView(
  props: React.ComponentProps<typeof RNKeyboardAvoidingView>,
) {
  return (
    <RNKeyboardAvoidingView
      {...props}
      style={themedStyle(props.style, "view")}
    />
  );
}

const ScrollView = forwardRef<
  React.ElementRef<typeof RNScrollView>,
  React.ComponentProps<typeof RNScrollView>
>((props, ref) => (
  <RNScrollView
    {...props}
    ref={ref}
    style={themedStyle(props.style, "view")}
    contentContainerStyle={themedStyle(props.contentContainerStyle, "view")}
  />
));

function Text(props: React.ComponentProps<typeof RNText>) {
  return <RNText {...props} style={themedStyle(props.style, "text")} />;
}

const TextInput = forwardRef<
  React.ElementRef<typeof RNTextInput>,
  React.ComponentProps<typeof RNTextInput>
>((props, ref) => (
  <RNTextInput
    {...props}
    ref={ref}
    placeholderTextColor={
      (themedColor(
        props.placeholderTextColor ?? colors.textMuted,
        "color",
      ) as React.ComponentProps<typeof RNTextInput>["placeholderTextColor"])
    }
    style={themedStyle(props.style, "text")}
  />
));

function ActivityIndicator(
  props: React.ComponentProps<typeof RNActivityIndicator>,
) {
  return (
    <RNActivityIndicator
      {...props}
      color={
        themedColor(
          props.color ?? activeAppTheme.accent,
          "color",
        ) as string
      }
    />
  );
}

function Switch(props: React.ComponentProps<typeof RNSwitch>) {
  return (
    <RNSwitch
      {...props}
      trackColor={{
        false: props.trackColor?.false ?? colors.gray200,
        true: activeAppTheme.accent,
      }}
    />
  );
}

function ThemedIonicons(props: React.ComponentProps<typeof RNIonicons>) {
  const color =
    activeAppTheme.id === "white" &&
    ["#FFFFFF", "#FFF"].includes(normalizeHex(props.color))
      ? props.color
      : themedColor(props.color, "color");
  return (
    <RNIonicons
      {...props}
      color={color as React.ComponentProps<typeof RNIonicons>["color"]}
    />
  );
}
const Ionicons = Object.assign(ThemedIonicons, {
  glyphMap: RNIonicons.glyphMap,
});

function LinearGradient(props: ComponentProps<typeof ExpoLinearGradient>) {
  const theme = useAppTheme();
  const source = props.colors;
  const isPrimary = source[0] === "#82B9C1" && source[1] === "#5DBB8C";
  const isDisabled = source[0] === "#C9D8D5" && source[1] === "#BFCAC7";
  return (
    <ExpoLinearGradient
      {...props}
      colors={isPrimary ? theme.gradient : isDisabled ? ["#D8D8D8", "#C8C8C8"] : source}
      style={[
        themedStyle(props.style, "view"),
        isPrimary && theme.id === "white" ? s.primaryWhiteGradient : null,
      ]}
    />
  );
}

function LinkedText({
  children,
  preserveColor = false,
  ...props
}: TextProps & { preserveColor?: boolean }) {
  const RootText = preserveColor ? RNText : Text;
  const InlineText = preserveColor ? RNText : Text;
  if (typeof children !== "string")
    return <RootText {...props}>{children}</RootText>;
  const parts = children.split(LINK_PATTERN);
  return (
    <RootText {...props}>
      {parts.map((part, index) => {
        if (!/^(https?:\/\/|www\.)/i.test(part)) return part;
        const trailing = part.match(/[),.!?]+$/)?.[0] ?? "";
        const visible = trailing ? part.slice(0, -trailing.length) : part;
        const url = /^https?:\/\//i.test(visible)
          ? visible
          : `https://${visible}`;
        return (
          <InlineText
            key={`${visible}-${index}`}
            accessibilityRole="link"
            onPress={(event) => {
              event.stopPropagation?.();
              Linking.openURL(url).catch(() =>
                Alert.alert("링크 열기 실패", "링크를 확인해주세요."),
              );
            }}
            style={s.hyperlink}
          >
            {visible}
            {trailing}
          </InlineText>
        );
      })}
    </RootText>
  );
}

const TOP_SPACE_PACKAGES: TopSpacePackage[] = [
  { points: 100, seconds: 45, boosts: 60 },
  { points: 500, seconds: 270, boosts: 360 },
  { points: 1000, seconds: 600, boosts: 800 },
  { points: 2000, seconds: 1260, boosts: 1680 },
  { points: 5000, seconds: 3600, boosts: 4800 },
  { points: 10000, seconds: 9000, boosts: 12000 },
  { points: 30000, seconds: 36000, boosts: 48000 },
  { points: 50000, seconds: 72000, boosts: 96000 },
];

const BUBBLE_COLOR_PRODUCTS: ColorProduct[] = [
  { color: "#F5F5F5", name: "기본 회색", price: 0 },
  { color: "#FFFCF3", name: "아이보리", price: 1200, productId: "mute_bubble_color_01" },
  { color: "#FCFFD0", name: "라임 크림", price: 1200, productId: "mute_bubble_color_02" },
  { color: "#E9DFC4", name: "오트", price: 1200, productId: "mute_bubble_color_03" },
  { color: "#D9F2FA", name: "스카이", price: 1500, productId: "mute_bubble_color_04" },
  { color: "#E2E2EF", name: "라일락", price: 1500, productId: "mute_bubble_color_05" },
  { color: "#FFE3E7", name: "블러시", price: 1500, productId: "mute_bubble_color_06" },
  { color: "#FFEFC5", name: "버터", price: 1500, productId: "mute_bubble_color_07" },
  { color: "#E2F1B9", name: "세이지", price: 1800, productId: "mute_bubble_color_08" },
  { color: "#3D485D", name: "슬레이트", price: 2200, productId: "mute_bubble_color_09" },
  { color: "#404338", name: "올리브 차콜", price: 2200, productId: "mute_bubble_color_10" },
];
const TEXT_COLOR_PRODUCTS: ColorProduct[] = [
  { color: "#1C1C1C", name: "기본 블랙", price: 0 },
  { color: "#BAB3AE", name: "웜 그레이", price: 1800, productId: "mute_text_color_01" },
  { color: "#B19DA1", name: "코코아", price: 1800, productId: "mute_text_color_02" },
  { color: "#AA6566", name: "로즈", price: 2500, productId: "mute_text_color_03" },
  { color: "#B28774", name: "테라", price: 2500, productId: "mute_text_color_04" },
  { color: "#DCA279", name: "피치", price: 2500, productId: "mute_text_color_05" },
  { color: "#7A7AB7", name: "바이올렛", price: 2800, productId: "mute_text_color_06" },
  { color: "#F1F4CB", name: "크림", price: 2800, productId: "mute_text_color_07" },
  { color: "#8ED3D3", name: "아쿠아", price: 3200, productId: "mute_text_color_08" },
  { color: "#EF769C", name: "핑크", price: 3200, productId: "mute_text_color_09" },
];

function customPaletteProduct(
  entitlements: ChatEntitlement[],
  productId: string,
  fallbackName: string,
): ColorProduct | null {
  const matched = entitlements.find(
    (item) =>
      item.productId === productId &&
      typeof item.value === "string" &&
      /^#[0-9A-Fa-f]{6}$/.test(item.value),
  );
  if (!matched?.value) return null;
  return {
    color: matched.value.toUpperCase(),
    name: fallbackName,
    price: 3200,
    productId,
  };
}

function customProductPrefix(target: "bubble" | "text" | "background") {
  if (target === "bubble") return "mute_custom_bubble_color_";
  if (target === "text") return "mute_custom_text_color_";
  return "mute_custom_background_";
}

function customDisplayName(color: string) {
  const hex = color.replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `커스텀 색상(R: ${String(red).padStart(3, "0")}, G: ${String(green).padStart(3, "0")}, B: ${String(blue).padStart(3, "0")})`;
}

function customPaletteProducts(
  entitlements: ChatEntitlement[],
  target: "bubble" | "text" | "background",
) {
  const prefix = customProductPrefix(target);
  return entitlements
    .filter(
      (item) =>
        item.productId.startsWith(prefix) &&
        typeof item.value === "string" &&
        /^#[0-9A-Fa-f]{6}$/.test(item.value),
    )
    .map((item) => ({
      color: String(item.value).toUpperCase(),
      name: customDisplayName(String(item.value).toUpperCase()),
      price: 3200,
      productId: item.productId,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

function nextCustomProductId(
  entitlements: ChatEntitlement[],
  target: "bubble" | "text" | "background",
) {
  const prefix = customProductPrefix(target);
  const used = new Set(
    entitlements
      .filter((item) => item.productId.startsWith(prefix))
      .map((item) => item.productId),
  );
  for (let index = 1; index <= 10; index += 1) {
    const productId = `${prefix}${index}`;
    if (!used.has(productId)) return productId;
  }
  return null;
}

function withCustomPaletteColor(
  values: ColorProduct[],
  customItems: ColorProduct[],
) {
  if (!customItems.length) return values;
  const filtered = values.filter(
    (item) =>
      !item.productId ||
      !customItems.some((customItem) => customItem.productId === item.productId),
  );
  const added = customItems.filter(
    (customItem) =>
      !filtered.some(
        (item) =>
          item.productId === customItem.productId ||
          item.color.toUpperCase() === customItem.color.toUpperCase(),
      ),
  );
  return [...filtered, ...added];
}

function isCustomChatProductId(productId?: string) {
  if (!productId) return false;
  return (
    productId.startsWith("mute_custom_bubble_color_") ||
    productId.startsWith("mute_custom_text_color_") ||
    productId.startsWith("mute_custom_background_")
  );
}
const ROOM_MEMBERS: RoomMember[] = [
  {
    userId: "00000000-0000-4000-8000-000000000001",
    name: "초록윤",
    intro: "작은 모임과 편안한 대화를 좋아해요.",
    owner: true,
  },
  {
    userId: "00000000-0000-4000-8000-000000000002",
    name: "한걸음",
    intro: "퇴근 후 산책과 커피를 좋아해요.",
    mine: true,
    coHost: true,
  },
  {
    userId: "00000000-0000-4000-8000-000000000003",
    name: "느린준",
    intro: "천천히 친해지는 중이에요.",
    coHost: true,
  },
  {
    userId: "00000000-0000-4000-8000-000000000004",
    name: "해질녘",
    intro: "사진과 조용한 대화를 좋아해요.",
  },
  {
    userId: "00000000-0000-4000-8000-000000000005",
    name: "솔바람",
    intro: "서울 곳곳을 탐색해요.",
    coHost: true,
  },
  {
    userId: "00000000-0000-4000-8000-000000000006",
    name: "새벽빛",
    intro: "늦은 시간의 영화 이야기를 좋아해요.",
  },
  {
    userId: "00000000-0000-4000-8000-000000000007",
    name: "구름결",
    intro: "새로운 사람의 이야기를 듣고 싶어요.",
  },
  {
    userId: "00000000-0000-4000-8000-000000000008",
    name: "여름밤",
    intro: "음악과 산책을 함께 나눠요.",
  },
  {
    userId: "00000000-0000-4000-8000-000000000009",
    name: "달그림",
    intro: "그림과 창작 이야기를 좋아해요.",
  },
  ...Array.from({ length: 29 }, (_, index) => ({
    userId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    name: `멤버 ${String(index + 10).padStart(2, "0")}`,
    intro: "이 방에서 사용하는 소개입니다.",
  })),
];

const ROOM_UPDATED_AT: Record<string, number> = {
  [DEMO_ROOM_ID]: Date.now() - 72000,
  "weekend-photo": Date.now() - 18 * 60000,
  "suwon-walk": Date.now() - 74 * 60000,
  "late-cinema": Date.now() - 3 * 60 * 60000,
  "concept-lab": Date.now() - 35 * 60000,
  "midnight-radio": Date.now() - 9 * 24 * 60 * 60000,
};

function membersForRoom(room: Room) {
  if (isScreenshotDemoRoomId(room.id))
    return screenshotDemoMembers;
  return Array.from(
    { length: room.memberCount },
    (_, index) =>
      ROOM_MEMBERS[index] ?? {
        userId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        name: `멤버 ${String(index + 1).padStart(2, "0")}`,
        intro: `${room.name}에서 사용하는 소개입니다.`,
      },
  );
}

function mapRoomMembers(
  serverMembers: ServerRoomMember[],
  currentUserId?: string,
) {
  return serverMembers.map((member) => ({
    userId: member.userId,
    name: member.name,
    intro: member.intro,
    avatarUri: member.avatarUrl,
    owner: member.role === "owner",
    mine: currentUserId ? member.userId === currentUserId : false,
    coHost: member.role === "cohost",
    mutedUntil: member.mutedUntil ?? null,
  })) satisfies RoomMember[];
}

function formatRoomActivity(updatedAt: number, now: number, joined: boolean) {
  const seconds = Math.max(1, Math.floor((now - updatedAt) / 1000));
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return joined ? `${hours}시간 전` : hours < 2 ? `${hours}시간 전` : "";
  if (!joined) return "";
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}일 전`;
  const date = new Date(updatedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function roomActivityAt(room: Room) {
  return (
    room.updatedAt ??
    (room.id === DEMO_ROOM_ID ? ROOM_UPDATED_AT[room.id] : undefined)
  );
}

function formatStoryTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    const fallback = new Date(
      value.replace(/\.\s?/g, "-").replace(/-$/, ""),
    ).getTime();
    if (!Number.isFinite(fallback)) return "방금";
    const fallbackMinutes = Math.max(
      0,
      Math.floor((Date.now() - fallback) / 60000),
    );
    if (fallbackMinutes < 1) return "방금";
    if (fallbackMinutes < 60) return `${fallbackMinutes}분 전`;
    const fallbackHours = Math.floor(fallbackMinutes / 60);
    if (fallbackHours < 24) return `${fallbackHours}시간 전`;
    const fallbackDays = Math.floor(fallbackHours / 24);
    return fallbackDays < 7
      ? `${fallbackDays}일 전`
      : new Date(fallback).toLocaleDateString("ko-KR");
  }
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}일 전`
    : new Date(timestamp).toLocaleDateString("ko-KR");
}

function formatDateLine(value?: number | string) {
  const timestamp = typeof value === "number" ? value : Date.parse(value ?? "");
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function chatDateKey(value?: number | string) {
  const timestamp = typeof value === "number" ? value : Date.parse(value ?? "");
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatCompactDate(value?: number | string) {
  const timestamp = typeof value === "number" ? value : Date.parse(value ?? "");
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}.`;
}

function pointReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    attendance: "출석체크 포인트",
    rewarded_ad: "광고 보상 포인트",
    top_space: "탑스페이스 추가",
    bubble_color: "말풍선 색상 구매",
    text_color: "텍스트 색상 구매",
    custom_color: "커스텀 색상 구매",
    point_transfer: "포인트 보내기",
    purchase: "포인트 충전",
    admin_point: "관리자 포인트",
    admin_points: "관리자 포인트",
    admin_grant: "관리자 포인트",
  };
  return labels[reason] ?? reason;
}

function formatChatClock(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "지금";
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sameChatMinute(first?: string, second?: string) {
  const firstTime = Date.parse(first ?? "");
  const secondTime = Date.parse(second ?? "");
  return (
    Number.isFinite(firstTime) &&
    Number.isFinite(secondTime) &&
    Math.floor(firstTime / 60000) === Math.floor(secondTime / 60000)
  );
}

function replyLabel(name: string, myDisplayName: string) {
  return name === myDisplayName ? "나에게 답장" : `${name}님에게 답장`;
}

function mapServerChatMessage(
  message: ServerRoomMessage,
  currentUserId?: string,
): ChatMessage {
  const mine = Boolean(currentUserId && message.userId === currentUserId);
  const deletedText =
    message.senderDeletedAt && message.kind !== "system"
      ? "삭제된 메시지입니다."
      : null;
  if (deletedText && message.kind === "image") {
    return {
      id: message.id,
      userId: message.userId,
      kind: "text",
      mine,
      name: message.senderName ?? (mine ? "나" : "멤버"),
      avatarUri: message.senderAvatarUrl,
      text: deletedText,
      time: formatChatClock(message.createdAt),
      createdAt: message.createdAt,
      bubbleColor: message.bubbleColor,
      textColor: message.textColor,
    };
  }
  const replyTo = message.replyToBody
    ? {
        id: message.replyToMessageId ?? `reply-${message.id}`,
        name: message.replyToSenderName ?? "멤버",
        text: message.replyToBody,
      }
    : undefined;
  if (message.kind === "image") {
    return {
      id: message.id,
      userId: message.userId,
      kind: "image",
      mine,
      name: message.senderName ?? (mine ? "나" : "멤버"),
      avatarUri: message.senderAvatarUrl,
      imageUris: message.imageUris ?? [],
      time: formatChatClock(message.createdAt),
      createdAt: message.createdAt,
      replyTo,
      bubbleColor: message.bubbleColor,
      textColor: message.textColor,
    };
  }
  if (message.kind === "story") {
    return {
      id: message.id,
      userId: message.userId,
      kind: "story",
      mine,
      name: message.senderName ?? (mine ? "나" : "멤버"),
      avatarUri: message.senderAvatarUrl,
      storyId: message.storyId ?? "",
      title: message.storyTitle ?? "스토리",
      preview: message.storyPreview ?? message.body,
      imageUri: message.storyImageUri,
      time: formatChatClock(message.createdAt),
      createdAt: message.createdAt,
    };
  }
  if (message.kind === "secret") {
    return {
      id: message.id,
      userId: message.userId,
      kind: "secret",
      mine,
      name: message.senderName ?? (mine ? "나" : "멤버"),
      avatarUri: message.senderAvatarUrl,
      recipient: message.recipientName ?? "멤버",
      text: deletedText ?? message.body,
      time: formatChatClock(message.createdAt),
      createdAt: message.createdAt,
      replyTo: deletedText ? undefined : replyTo,
      bubbleColor: message.bubbleColor,
      textColor: message.textColor,
    };
  }
  if (message.kind === "system") {
    const event: Extract<ChatMessage, { kind: "system" }>["event"] =
      message.body.includes("하트")
        ? "heart"
        : message.body.includes("포인트") ||
            /[0-9][0-9,]*p를 보냈습니다\./.test(message.body)
          ? "point"
          : message.body.includes("강퇴")
            ? "kick"
            : message.body.includes("퇴장")
              ? "leave"
              : message.body.includes("들어왔")
                ? "join"
                : "room";
    return {
      id: message.id,
      kind: "system",
      event,
      text: message.body,
      createdAt: message.createdAt,
    };
  }
  return {
    id: message.id,
    userId: message.userId,
    kind: "text",
    mine,
    name: message.senderName ?? (mine ? "나" : "멤버"),
    avatarUri: message.senderAvatarUrl,
    text: deletedText ?? message.body,
    time: formatChatClock(message.createdAt),
    createdAt: message.createdAt,
    replyTo: deletedText ? undefined : replyTo,
    bubbleColor: message.bubbleColor,
    textColor: message.textColor,
  };
}

function formatTopSpaceRemaining(expiresAt: number | undefined, now: number) {
  if (!expiresAt || expiresAt <= now) return "노출 없음";
  const minutes = Math.max(1, Math.ceil((expiresAt - now) / 60000));
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.ceil(hours / 24)}일 남음`;
}

function formatEntitlementRemaining(expiresAt:string){
  const seconds=Math.max(0,Math.floor((Date.parse(expiresAt)-Date.now())/1000));
  const days=Math.floor(seconds/86400);const hours=Math.floor((seconds%86400)/3600);const minutes=Math.floor((seconds%3600)/60);const rest=seconds%60;
  return `${days}일 ${hours}시간 ${minutes}분 ${rest}초`;
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
  );
}

function confirmReportSubmission(
  input: Parameters<typeof submitReport>[0],
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "신고하기",
      "정말 신고하시겠습니까?\n허위 신고 시 서비스 이용에 불이익을 받을 수 있습니다.",
      [
        { text: "취소", style: "cancel", onPress: () => resolve(false) },
        {
          text: "신고하기",
          style: "destructive",
          onPress: async () => {
            try {
              await submitReport(input);
              resolve(true);
            } catch (error) {
              Alert.alert("신고 실패", serverErrorMessage(error));
              resolve(false);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), milliseconds),
    ),
  ]);
}

const IOS_BOTTOM_SAFE_PADDING = Platform.OS === "ios" ? 16 : 0;

async function promptImageSource({
  allowDelete = false,
}: { allowDelete?: boolean } = {}) {
  return new Promise<"camera" | "gallery" | "remove" | null>((resolve) => {
    let settled = false;
    const finish = (value: "camera" | "gallery" | "remove" | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      "사진 선택",
      undefined,
      [
        { text: "사진", onPress: () => finish("gallery") },
        { text: "카메라", onPress: () => finish("camera") },
        ...(allowDelete
          ? [
              {
                text: "삭제",
                style: "destructive" as const,
                onPress: () => finish("remove"),
              },
            ]
          : []),
        { text: "취소", style: "cancel", onPress: () => finish(null) },
      ],
      { cancelable: true, onDismiss: () => finish(null) },
    );
  });
}

async function pickSingleImage({
  source,
  aspect = [1, 1],
  quality = 0.82,
}: {
  source: "camera" | "gallery";
  aspect?: [number, number];
  quality?: number;
}) {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect,
          quality,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect,
          quality,
        });
  if (result.canceled) return null;
  return result.assets[0];
}

async function resizeLocalImage(
  uri: string,
  width: number,
  compress: number,
) {
  if (!uri) throw new Error("IMAGE_URI_REQUIRED");
  return ImageManipulator.manipulateAsync(uri, [{ resize: { width } }], {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

async function pickCroppedImageBatch({
  source,
  aspect = [4, 3],
  limit = 5,
  quality = 0.86,
}: {
  source: "camera" | "gallery";
  aspect?: [number, number];
  limit?: number;
  quality?: number;
}) {
  const assets: ImagePicker.ImagePickerAsset[] = [];
  if (source === "camera") {
    const asset = await pickSingleImage({ source, aspect, quality });
    return asset ? [asset] : [];
  }
  for (let index = 0; index < limit; index += 1) {
    const asset = await pickSingleImage({ source: "gallery", aspect, quality });
    if (!asset) break;
    assets.push(asset);
    if (index < limit - 1) {
      const more = await new Promise<boolean>((resolve) =>
        Alert.alert(
          "사진 추가",
          "사진을 더 추가할까요?",
          [
            { text: "그만", style: "cancel", onPress: () => resolve(false) },
            { text: "추가", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!more) break;
    }
  }
  return assets;
}

type ChatImageAsset = ImagePicker.ImagePickerAsset & {
  cropAspect?: "original" | "free" | [number, number];
  cropOffset?: { x: number; y: number };
  cropPosition?: { x: number; y: number };
  cropScale?: number;
  cropFreeRatio?: number;
  cropRotation?: number;
};

async function pickChatImages(
  source: "camera" | "gallery",
): Promise<ChatImageAsset[]> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.9,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: 5,
          orderedSelection: true,
          quality: 0.9,
        });
  if (result.canceled) return [];
  const selected = result.assets.slice(0, 5);
  const gifs = selected.filter(
    (asset) =>
      asset.mimeType === "image/gif" || asset.uri.toLowerCase().endsWith(".gif"),
  );
  if (gifs.length && selected.length > 1) {
    Alert.alert("GIF 첨부", "GIF는 사진과 함께 보낼 수 없으며 한 장씩만 전송할 수 있습니다.");
    return [];
  }
  if (gifs[0]?.fileSize && gifs[0].fileSize > 5 * 1024 * 1024) {
    Alert.alert("GIF 용량 초과", "GIF는 5MB 이하 파일만 전송할 수 있습니다.");
    return [];
  }
  return gifs.length ? [gifs[0]] : selected;
}

async function prepareChatImage(asset: ChatImageAsset) {
  const isGif =
    asset.mimeType === "image/gif" || asset.uri.toLowerCase().endsWith(".gif");
  if (isGif) return asset;
  const sourceWidth = Math.max(1, asset.width ?? 1600);
  const sourceHeight = Math.max(1, asset.height ?? 1200);
  const rotation = (((asset.cropRotation ?? 0) % 360) + 360) % 360;
  const rotated = rotation === 90 || rotation === 270;
  const width = rotated ? sourceHeight : sourceWidth;
  const height = rotated ? sourceWidth : sourceHeight;
  const requested = asset.cropAspect ?? "original";
  const target =
    requested === "original"
      ? width / height
      : requested === "free"
        ? Math.max(0.45, Math.min(2.4, asset.cropFreeRatio ?? width / height))
      : requested[0] / requested[1];
  const ratio = width / height;
  const focusX = Math.max(-1, Math.min(1, asset.cropPosition?.x ?? 0));
  const focusY = Math.max(-1, Math.min(1, asset.cropPosition?.y ?? 0));
  const baseCrop =
    ratio > target
      ? {
          originX: Math.round(((width - height * target) * (focusX + 1)) / 2),
          originY: 0,
          width: Math.round(height * target),
          height,
        }
      : {
          originX: 0,
          originY: Math.round(((height - width / target) * (focusY + 1)) / 2),
          width,
          height: Math.round(width / target),
        };
  const zoom = Math.max(1, Math.min(4, asset.cropScale ?? 1));
  const cropWidth = Math.max(1, Math.round(baseCrop.width / zoom));
  const cropHeight = Math.max(1, Math.round(baseCrop.height / zoom));
  const crop = {
    originX: Math.max(
      0,
      Math.min(
        width - cropWidth,
        Math.round(((width - cropWidth) * (focusX + 1)) / 2),
      ),
    ),
    originY: Math.max(
      0,
      Math.min(
        height - cropHeight,
        Math.round(((height - cropHeight) * (focusY + 1)) / 2),
      ),
    ),
    width: cropWidth,
    height: cropHeight,
  };
  const actions: ImageManipulator.Action[] = [];
  if (rotation) actions.push({ rotate: rotation });
  if (!(requested === "original" && zoom <= 1)) actions.push({ crop });
  const resultWidth = requested === "original" && zoom <= 1 ? width : crop.width;
  const resultHeight = requested === "original" && zoom <= 1 ? height : crop.height;
  if (Math.max(resultWidth, resultHeight) > 1600)
    actions.push(
      resultWidth >= resultHeight
        ? { resize: { width: 1600 } }
        : { resize: { height: 1600 } },
    );
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.78,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const outputWidth =
    requested === "original" && zoom <= 1 ? width : crop.width;
  const outputHeight =
    requested === "original" && zoom <= 1 ? height : crop.height;
  const scale = Math.min(1, 1600 / Math.max(outputWidth, outputHeight));
  return {
    ...asset,
    uri: result.uri,
    mimeType: "image/jpeg",
    width: Math.round(outputWidth * scale),
    height: Math.round(outputHeight * scale),
  };
}

function EdgeBackLayer({ onBack }: { onBack?: () => void }) {
  const responder = useMemo(
    () =>
      !onBack
        ? null
        : PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gestureState) =>
              gestureState.x0 < 28 &&
              gestureState.dx > 10 &&
              Math.abs(gestureState.dy) < 18,
            onPanResponderRelease: (_event, gestureState) => {
              if (gestureState.dx > 70 && Math.abs(gestureState.dy) < 42)
                onBack();
            },
          }),
    [onBack],
  );
  if (!onBack || !responder) return null;
  return (
    <View
      {...responder.panHandlers}
      style={s.edgeBackLayer}
      pointerEvents="box-only"
    />
  );
}

function AuthHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <>
      <EdgeBackLayer onBack={onBack} />
      <View style={[s.authHeader, s.androidHeaderInset58]}>
        <Pressable disabled={!onBack} onPress={onBack} style={s.authHeaderBack}>
          {onBack ? (
            <Ionicons name="chevron-back" size={22} color={colors.textSubtle} />
          ) : null}
        </Pressable>
        <Text style={s.authHeaderTitle}>{title}</Text>
        <View style={s.authHeaderBack} />
      </View>
    </>
  );
}

export default function App() {
  const demoMode = !isSupabaseConfigured;
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const [authReady, setAuthReady] = useState(demoMode || !isSupabaseConfigured);
  useEffect(() => {
    void loadSplashTheme().catch(() => applyAppTheme(APP_THEMES[0]));
  }, []);
  useEffect(() => {
    if (demoMode || !supabase) return;
    getCurrentSession()
      .then(setSession)
      .catch((error) => Alert.alert("로그인 확인 실패", error.message))
      .finally(() => setAuthReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [demoMode]);
  let content: React.ReactNode;
  if (!authReady) {
    content = (
      <>
        <SplashScreen />
        <GlobalBusyOverlay />
      </>
    );
  } else if (
    !demoMode &&
    isSupabaseConfigured &&
    (!session || passwordRecoveryActive)
  ) {
    content = (
      <>
        <PhoneAuthScreenV2 onRecoveryStateChange={setPasswordRecoveryActive} />
        <PersistentHomeIndicator />
        <GlobalBusyOverlay />
      </>
    );
  } else {
    content = (
      <>
        <AppLockGate session={session}>
          <AuthenticatedApp
            session={session}
            onSignedOut={() => {
              setPasswordRecoveryActive(false);
              resetPurchaseConfiguration();
              try {
                selectAppTheme(APP_THEMES[0], null);
              } catch {
                // Local theme reset must not block session cleanup.
              }
              setSession(null);
            }}
          />
        </AppLockGate>
        <GlobalBusyOverlay />
      </>
    );
  }
  return (
    <GestureHandlerRootView style={s.flex}>
      <NavigationContainer ref={appNavigationRef}>{content}</NavigationContainer>
    </GestureHandlerRootView>
  );
}

function AppLockGate({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const inactiveAtRef = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)
      .then((value) => {
        if (active) {
          setEnabled(value === "1");
          setUnlocked(value !== "1");
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        inactiveAtRef.current = Date.now();
        return;
      }
      AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)
        .then((value) => {
          const nextEnabled = value === "1";
          setEnabled(nextEnabled);
          if (
            nextEnabled &&
            (!inactiveAtRef.current ||
              Date.now() - inactiveAtRef.current >= 3000)
          )
            setUnlocked(false);
          else setUnlocked(true);
          inactiveAtRef.current = null;
        })
        .catch(() => {
          if (enabled) setUnlocked(false);
        });
    });
    return () => subscription.remove();
  }, [enabled]);
  if (!ready) return <SplashScreen />;
  if (enabled && !unlocked)
    return (
      <>
        {children}
        <View style={s.appLockOverlay}>
          <AppLockScreen
            session={session}
            onUnlocked={() => setUnlocked(true)}
            onDisabled={() => {
              setEnabled(false);
              setUnlocked(true);
            }}
          />
        </View>
        <PersistentHomeIndicator />
      </>
    );
  return (
    <>
      {children}
      <PersistentHomeIndicator />
    </>
  );
}

function PersistentHomeIndicator() {
  if (Platform.OS !== "ios") return null;
  return (
    <View pointerEvents="none" style={s.persistentHomeIndicator}>
      <View style={s.persistentHomeBar} />
    </View>
  );
}

function AppLockScreen({
  session,
  onUnlocked,
  onDisabled,
}: {
  session: Session | null;
  onUnlocked: () => void;
  onDisabled: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState(session?.user.phone ?? "");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const checkPin = async (value: string) => {
    const stored = await readAppLockPin();
    if (value === stored) {
      setError("");
      onUnlocked();
      return;
    }
    setError("PIN이 일치하지 않습니다.");
  };
  const pushDigit = (digit: string) => {
    setError("");
    setPin((current) => {
      const next = (current + digit).slice(0, 4);
      if (next.length === 4) setTimeout(() => void checkPin(next), 0);
      return next;
    });
  };
  const erasePin = () => {
    setPin((value) => value.slice(0, -1));
    setError("");
  };
  const requestUnlockOtp = async () => {
    if (!normalizeKoreanPhoneNumber(recoveryPhone)) {
      setError("전화번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = await requestPasswordRecoveryOtp(recoveryPhone);
      setNormalizedPhone(normalized);
      setOtpSent(true);
    } catch (error) {
      setError(serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const verifyUnlockOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await verifyPhoneOtp(normalizedPhone, otp);
      await clearAppLockCredentials();
      onDisabled();
    } catch (error) {
      setError(serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  if (recovering)
    return (
      <SafeAreaView style={s.lockScreen}>
        <StatusBar style="dark" />
        <AuthHeader
          title="앱 잠금 해제"
          onBack={() => {
            setRecovering(false);
            setOtp("");
            setOtpSent(false);
            setError("");
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.lockRecovery}
        >
          <Text style={s.authBody}>
            전화번호 인증으로 앱 잠금을 해제합니다.
          </Text>
          <TextInput
            value={recoveryPhone}
            onChangeText={setRecoveryPhone}
            keyboardType="phone-pad"
            placeholder="010-0000-0000"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          {otpSent && (
            <TextInput
              value={otp}
              onChangeText={(value) =>
                setOtp(value.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              placeholder="인증번호 6자리"
              placeholderTextColor={colors.textMuted}
              style={s.authInput}
            />
          )}
          <Pressable
            disabled={loading || (otpSent && otp.length !== 6)}
            onPress={otpSent ? verifyUnlockOtp : requestUnlockOtp}
            style={[
              s.primary,
              (loading || (otpSent && otp.length !== 6)) && s.disabled,
            ]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading
                  ? "처리 중..."
                  : otpSent
                    ? "잠금 해제"
                    : "인증번호 받기"}
              </Text>
            </LinearGradient>
          </Pressable>
          {error !== "" && <Text style={s.lockError}>{error}</Text>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.lockScreen}>
      <StatusBar style="dark" />
      <View style={s.lockCard}>
        <View style={s.lockIcon}>
          <Ionicons name="lock-closed" size={34} color={colors.mint700} />
        </View>
        <Text style={s.lockTitle}>앱 잠금</Text>
        <View style={s.lockDots}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[s.lockDot, index < pin.length && s.lockDotFilled]}
            />
          ))}
        </View>
        {error !== "" && <Text style={s.lockError}>{error}</Text>}
        <NumberPad onDigit={pushDigit} onBackspace={erasePin} />
        <Pressable
          onPress={() => {
            setRecovering(true);
            setError("");
          }}
          style={s.authBack}
        >
          <Text style={s.authBackText}>비밀번호를 잊으셨습니까?</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function NumberPad({
  onDigit,
  onBackspace,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <View style={s.numberPad}>
      {keys.map((key, index) =>
        key === "" ? (
          <View key={`empty-${index}`} style={s.numberKey} />
        ) : (
          <RNPressable
            key={key}
            onPress={() => (key === "back" ? onBackspace() : onDigit(key))}
            style={s.numberKey}
          >
            {key === "back" ? (
              <Ionicons
                name="backspace-outline"
                size={24}
                color={colors.textSubtle}
              />
            ) : (
              <Text style={s.numberKeyText}>{key}</Text>
            )}
          </RNPressable>
        ),
      )}
    </View>
  );
}

function AuthenticatedApp({
  session,
  onSignedOut,
}: {
  session: Session | null;
  onSignedOut: () => void;
}) {
  const isSuperAdmin = Boolean(
    session?.user.app_metadata?.admin_role === "super_admin",
  );
  const canAccessAdultRoom = (room: Room) => !room.isAdult || canSeeAdultRooms;
  const [screen, setScreen] = useState<Screen>("main");
  const [bottomTab, setBottomTab] = useState<BottomTab>("myRooms");
  const [category, setCategory] = useState<MainTab>("promotion");
  const [selectedRoom, setSelectedRoom] = useState(EMPTY_ROOM);
  const [roomData, setRoomData] = useState<Room[]>([]);
  const [roomDataLoaded, setRoomDataLoaded] = useState(false);
  const [dataRefreshing, setDataRefreshing] = useState(false);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [ownedRoomIds, setOwnedRoomIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [adminReadOnly, setAdminReadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState(0);
  const [attendanceAvailableAt, setAttendanceAvailableAt] = useState(
    Date.now(),
  );
  const [rewardedAdAvailable, setRewardedAdAvailable] = useState(true);
  const [adFreeActive, setAdFreeActive] = useState(false);
  const [rewardLoading, setRewardLoading] = useState<
    "attendance" | "rewarded_ad" | null
  >(null);
  const [boosts, setBoosts] = useState<Record<string, number>>({});
  const [promotionTimestamps, setPromotionTimestamps] = useState<
    Record<string, number>
  >({});
  const promotingRoomsRef = useRef<Set<string>>(new Set());
  const topSpaceRequestIdsRef = useRef<Record<string, string>>({});
  const [topSpaceExpiresAt, setTopSpaceExpiresAt] = useState<
    Record<string, number>
  >({});
  const [topSpaceDurations, setTopSpaceDurations] = useState<
    Record<string, number>
  >({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [roomSummaries, setRoomSummaries] = useState<
    Record<string, { lastMessage?: string; updatedAt?: number }>
  >({});
  const [reportedRoomIds, setReportedRoomIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [adultVerified, setAdultVerified] = useState(false);
  const [adultContentWebOptedIn, setAdultContentWebOptedIn] = useState(false);
  const [iosAdultContentEnabled, setIosAdultContentEnabled] = useState(false);
  const showAdultTab =
    !IOS_HIDE_ADULT_UI ||
    isSuperAdmin ||
    (adultVerified && iosAdultContentEnabled);
  const canSeeAdultRooms =
    isSuperAdmin ||
    (adultVerified && (!IOS_HIDE_ADULT_UI || iosAdultContentEnabled));
  const canUseAdultFeatures = isSuperAdmin || adultVerified;
  const [chatInitialPanel, setChatInitialPanel] = useState<ChatPanel>(null);
  const [chatInitialStoryId, setChatInitialStoryId] = useState<string | null>(
    null,
  );
  const [chatInitialUnreadFocus, setChatInitialUnreadFocus] = useState(false);
  const [returnToNotifications, setReturnToNotifications] = useState(false);
  const [notificationDrawerSignal, setNotificationDrawerSignal] = useState(0);
  const handledPushResponseIdsRef = useRef<Set<string>>(new Set());
  const checkedInitialPushResponseRef = useRef(false);
  const appTheme = useAppTheme();
  const primaryForeground = themeForeground(appTheme);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getMyWallet()
      .then((wallet) => {
        setPoints(wallet.pointBalance);
        setAttendanceAvailableAt(
          new Date(wallet.attendanceAvailableAt).getTime(),
        );
        setRewardedAdAvailable(wallet.rewardedAdAvailable);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !session?.user.id) return;
    const client = supabase;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const reloadWallet = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        getMyWallet()
          .then((wallet) => {
            setPoints(wallet.pointBalance);
            setAttendanceAvailableAt(
              new Date(wallet.attendanceAvailableAt).getTime(),
            );
            setRewardedAdAvailable(wallet.rewardedAdAvailable);
          })
          .catch(() => undefined);
      }, 120);
    };
    const channel = client
      .channel(`wallet-ledger-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "point_ledger",
          filter: `user_id=eq.${session.user.id}`,
        },
        reloadWallet,
      )
      .subscribe();
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      client.removeChannel(channel);
    };
  }, [session?.user.id]);
  const walletRefreshAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured || attendanceAvailableAt <= 0) return;
    if (now < attendanceAvailableAt) return;
    setRewardedAdAvailable(true);
    if (walletRefreshAtRef.current === attendanceAvailableAt) return;
    walletRefreshAtRef.current = attendanceAvailableAt;
    getMyWallet()
      .then((wallet) => {
        setPoints(wallet.pointBalance);
        setAttendanceAvailableAt(
          new Date(wallet.attendanceAvailableAt).getTime(),
        );
        setRewardedAdAvailable(wallet.rewardedAdAvailable);
      })
      .catch(() => undefined);
  }, [attendanceAvailableAt, now]);
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;
    const client = supabase;
    const reload = () =>
      listTopSpaces()
        .then((rows) => {
          setTopSpaceExpiresAt(
            Object.fromEntries(
              rows.map((row) => [
                row.room_id,
                new Date(row.expires_at).getTime(),
              ]),
            ),
          );
          setTopSpaceDurations(
            Object.fromEntries(
              rows.map((row) => [
                row.room_id,
                row.total_duration_seconds * 1000,
              ]),
            ),
          );
          setBoosts(
            Object.fromEntries(
              rows.map((row) => [row.room_id, row.boost_count]),
            ),
          );
        })
        .catch(() => undefined);
    reload();
    const channel = client
      .channel("room-top-spaces")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_top_spaces" },
        reload,
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    const syncPushState = () => {
      registerPushDevice()
        .then(() => schedulePendingPushDispatch())
        .catch(() => undefined);
    };
    syncPushState();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncPushState();
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    initializeAds().catch(() => undefined);
  }, []);
  useEffect(()=>{
    if(!supabase||!isSupabaseConfigured)return;
    const client=supabase;const reload=()=>listRoomPromotions().then((rows)=>setPromotionTimestamps(Object.fromEntries(rows.map((row)=>[row.room_id,new Date(row.last_promoted_at).getTime()])))).catch(()=>undefined);
    const channel=client.channel("room-promotions").on("postgres_changes",{event:"*",schema:"public",table:"room_promotions"},reload).subscribe();
    return()=>{client.removeChannel(channel);};
  },[]);
  useEffect(() => {
    if (session?.user.id)
      configurePurchases(session.user.id).catch(() => undefined);
  }, [session?.user.id]);
  useEffect(() => {
    let active = true;
    let entitlementExpiryTimer: ReturnType<typeof setTimeout> | null = null;
    const userId = session?.user.id;
    if (!userId) {
      resetPurchaseConfiguration();
      setAdFreeActive(false);
      applyAppTheme(APP_THEMES[0]);
      void AsyncStorage.setItem(SPLASH_THEME_STORAGE_KEY, APP_THEMES[0].id);
      return;
    }
    // Apply the last server-confirmed ownership cache before the network round
    // trip so app resume does not flash or reset a purchased theme.
    const reloadEntitlements = () => listStoreEntitlements()
      .then((items) => {
        if (!active) return;
        const now = Date.now();
        const activeAdFree = items.find(
          (item) =>
            item.type === "ad_free" &&
            (!item.expiresAt || Date.parse(item.expiresAt) > now),
        );
        setAdFreeActive(
          Boolean(activeAdFree),
        );
        if (entitlementExpiryTimer) clearTimeout(entitlementExpiryTimer);
        const expiresAt = activeAdFree?.expiresAt
          ? Date.parse(activeAdFree.expiresAt)
          : Number.NaN;
        if (Number.isFinite(expiresAt))
          entitlementExpiryTimer = setTimeout(
            () => void reloadEntitlements(),
            Math.max(1000, expiresAt - now + 1000),
          );
        const ownedProductIds = items.map((item) => item.productId);
        void cacheThemeProductIds(userId, ownedProductIds).catch(() => undefined);
        void loadStoredAppTheme(userId, ownedProductIds);
      })
      .catch(() => undefined);
    void (async () => {
      try {
        const cached = await readCachedThemeProductIds(userId);
        if (!active) return;
        await loadStoredAppTheme(userId, cached);
      } finally {
        if (active) void reloadEntitlements();
      }
    })().catch(() => undefined);
    const entitlementChannel =
      supabase && isSupabaseConfigured
        ? supabase
            .channel(`store-entitlements-${userId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "user_entitlements",
                filter: `user_id=eq.${userId}`,
              },
              () => void reloadEntitlements(),
            )
            .subscribe()
        : null;
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reloadEntitlements();
    });
    return () => {
      active = false;
      if (entitlementExpiryTimer) clearTimeout(entitlementExpiryTimer);
      appStateSubscription.remove();
      if (entitlementChannel && supabase)
        supabase.removeChannel(entitlementChannel);
    };
  }, [session?.user.id]);
  const reloadAppData = async (showSpinner = false, silent = false) => {
    if (SCREENSHOT_DEMO_ENABLED) {
      const joined = screenshotDemoRooms.map((room) => room.id);
      setRoomData(screenshotDemoRooms);
      setJoinedIds(joined);
      setOwnedRoomIds([DEMO_ROOM_ID]);
      setUnreadCounts(screenshotDemoUnreadCounts);
      setRoomSummaries(
        Object.fromEntries(
          screenshotDemoRooms.map((room) => [
            room.id,
            { lastMessage: room.lastMessage, updatedAt: room.updatedAt },
          ]),
        ),
      );
      setRoomDataLoaded(true);
      setDataRefreshing(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setRoomData([]);
      setJoinedIds([]);
      setReportedRoomIds([]);
      setRoomDataLoaded(true);
      return;
    }
    if (showSpinner) setDataRefreshing(true);
    try {
      const [roomsResult, activeIdsResult, ownedIdsResult, verificationResult, promotionsResult, reportedRoomsResult] =
        await Promise.allSettled([
          listRooms(),
          listMyActiveRoomIds(),
          listMyOwnedRoomIds(),
          getVerificationStatus(),
          listRoomPromotions(),
          listReportedRoomIds(),
        ]);
      if (
        roomsResult.status === "fulfilled" &&
        reportedRoomsResult.status === "fulfilled"
      ) {
        const activeRoomIds = new Set(
          activeIdsResult.status === "fulfilled" ? activeIdsResult.value : [],
        );
        const hiddenRoomIds = new Set(reportedRoomsResult.value);
        const mapped = roomsResult.value
          .map(mapServerRoom)
          .filter(
            (room) =>
              room.id !== DEMO_ROOM_ID &&
              (!hiddenRoomIds.has(room.id) || activeRoomIds.has(room.id)),
          );
        setRoomData(mapped);
        setSelectedRoom((current) =>
          current.id === DEMO_ROOM_ID && mapped.length ? mapped[0] : current,
        );
        setRoomDataLoaded(true);
      }
      if (activeIdsResult.status === "fulfilled")
        setJoinedIds([...new Set(activeIdsResult.value)]);
      if (ownedIdsResult.status === "fulfilled")
        setOwnedRoomIds([...new Set(ownedIdsResult.value)]);
      if (reportedRoomsResult.status === "fulfilled")
        setReportedRoomIds(reportedRoomsResult.value);
      if (verificationResult.status === "fulfilled") {
        setAdultVerified(verificationResult.value.adultVerified);
        setAdultContentWebOptedIn(
          verificationResult.value.adultContentWebOptedIn,
        );
        setIosAdultContentEnabled(
          verificationResult.value.iosAdultContentEnabled,
        );
      }
      if (promotionsResult.status === "fulfilled")
        setPromotionTimestamps(
          Object.fromEntries(
            promotionsResult.value.map((row) => [
              row.room_id,
              new Date(row.last_promoted_at).getTime(),
            ]),
          ),
        );
      if (roomsResult.status === "rejected") throw roomsResult.reason;
      if (activeIdsResult.status === "rejected") throw activeIdsResult.reason;
      if (ownedIdsResult.status === "rejected") throw ownedIdsResult.reason;
      // A failed report filter must never expose rooms the user already hid.
      if (reportedRoomsResult.status === "rejected")
        throw reportedRoomsResult.reason;
    } catch (error) {
      setRoomDataLoaded(true);
      if (!silent)
        Alert.alert("방 목록 불러오기 실패", serverErrorMessage(error));
    } finally {
      setDataRefreshing(false);
    }
  };
  useEffect(() => {
    reloadAppData(false);
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void reloadAppData(false, true);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (SCREENSHOT_DEMO_ENABLED) return;
    if (!supabase || !isSupabaseConfigured || !session?.user.id) return;
    const client = supabase;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reloadMemberships = () =>
      Promise.all([listMyActiveRoomIds(), listMyOwnedRoomIds()])
        .then(([ids, ownerIds]) => {
          if (!active) return;
          setJoinedIds([...new Set(ids)]);
          setOwnedRoomIds([...new Set(ownerIds)]);
        })
        .catch(() => undefined);
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reloadMemberships(), 150);
    };
    const channel = client
      .channel(`my-room-memberships-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_memberships",
          filter: `user_id=eq.${session.user.id}`,
        },
        scheduleReload,
      )
      .subscribe();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [session?.user.id]);
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reloadAppData(false, true), 250);
    };
    const channel = client
      .channel("room-directory-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        scheduleReload,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    if (SCREENSHOT_DEMO_ENABLED) return;
    if (!supabase || !isSupabaseConfigured || !session?.user.id) return;
    const client = supabase;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let reloadInFlight = false;
    let reloadPending = false;
    const reload = async () => {
      if (reloadInFlight) {
        reloadPending = true;
        return;
      }
      reloadInFlight = true;
      try {
        do {
          reloadPending = false;
          const rows = await listMyRoomSummaries();
          if (!active) break;
          setUnreadCounts(
            Object.fromEntries(rows.map((row) => [row.roomId, row.unreadCount])),
          );
          setRoomSummaries(
            Object.fromEntries(
              rows.map((row) => [
                row.roomId,
                {
                  lastMessage: row.lastMessage ?? undefined,
                  updatedAt: row.lastMessageAt
                    ? new Date(row.lastMessageAt).getTime()
                    : undefined,
                },
              ]),
            ),
          );
        } while (reloadPending);
      } catch {
        // Keep the last successful summary and wait for the next event.
      } finally {
        reloadInFlight = false;
      }
    };
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reload(), 300);
    };
    void reload();
    const messageChannel = client
      .channel(`my-room-summaries-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_read_receipts",
          filter: `user_id=eq.${session.user.id}`,
        },
        scheduleReload,
      )
      .subscribe();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      client.removeChannel(messageChannel);
    };
  }, [session?.user.id]);

  const adminReport = async (
    targetType: "room" | "user",
    targetId: string,
    label: string,
  ) => {
    if (!isUuid(targetId)) {
      Alert.alert("신고 불가", "서버에 생성된 대상만 신고할 수 있습니다.");
      return;
    }
    try {
      const submitted = await confirmReportSubmission({
        targetType,
        targetId,
        reason: "other",
        detail: `관리자 신고: ${label}`,
      });
      if (!submitted) return;
      Alert.alert("신고 접수 완료", "대상 ID가 운영 신고 큐에 저장되었습니다.");
    } catch (error) {
      Alert.alert("신고 실패", serverErrorMessage(error));
    }
  };
  const openOperationsPolicyPortal = async () => {
    try {
      await Linking.openURL(getOperationsPolicyUrl());
    } catch (error) {
      Alert.alert("열기 실패", serverErrorMessage(error));
    }
  };
  const openRoom = async (room: Room) => {
    if (!canAccessAdultRoom(room)) {
      Alert.alert("접근 불가", "이 콘텐츠는 현재 iOS에서 이용할 수 없습니다.");
      return;
    }
    setChatInitialPanel(null);
    setChatInitialStoryId(null);
    setChatInitialUnreadFocus(false);
    setReturnToNotifications(false);
    setSelectedRoom(room);
    setUnreadCounts((counts) => ({ ...counts, [room.id]: 0 }));
    setAdminReadOnly(false);
    if (room.isSample) {
      setScreen("chat");
      return;
    }
    if (joinedIds.includes(room.id)) {
      setScreen("chat");
      return;
    }
    if (isSuperAdmin) {
      setAdminReadOnly(true);
      setScreen("detail");
      return;
    }
    setScreen("detail");
  };
  const openRoomDetail = (room: Room) => {
    if (!canAccessAdultRoom(room)) {
      Alert.alert("접근 불가", "이 콘텐츠는 현재 iOS에서 이용할 수 없습니다.");
      return;
    }
    setSelectedRoom(room);
    setAdminReadOnly(Boolean(isSuperAdmin && !joinedIds.includes(room.id)));
    setScreen("detail");
  };
  const openNotification = async (notice: Notice) => {
    if (notice.destination === "promotion") {
      setBottomTab("discover");
      setCategory("promotion");
      setScreen("main");
      return;
    }
    let room = roomData.find((item) => item.id === notice.roomId);
    if (!room && notice.roomId && isUuid(notice.roomId) && isSupabaseConfigured) {
      try {
        const serverRoom = await getRoomById(notice.roomId);
        if (serverRoom) {
          room = mapServerRoom(serverRoom);
          setRoomData((items) =>
            items.some((item) => item.id === room!.id) ? items : [room!, ...items],
          );
        }
      } catch {
        room = undefined;
      }
    }
    if (!room) {
      Alert.alert("알림 이동 실패", "삭제되었거나 접근할 수 없는 방입니다.");
      return;
    }
    if (!canAccessAdultRoom(room)) {
      Alert.alert("접근 불가", "이 콘텐츠는 현재 iOS에서 이용할 수 없습니다.");
      return;
    }
    setSelectedRoom(room);
    setAdminReadOnly(Boolean(isSuperAdmin && !joinedIds.includes(room.id)));
    setReturnToNotifications(notice.destination === "applications");
    setChatInitialPanel(
      notice.destination === "applications"
        ? "applications"
        : notice.destination === "stories"
          ? "stories"
          : null,
    );
    setChatInitialStoryId(
      notice.destination === "stories" ? notice.storyId ?? null : null,
    );
    setChatInitialUnreadFocus(notice.destination === "chat");
    const openChat =
      notice.destination === "chat" ||
      notice.destination === "applications" ||
      notice.destination === "stories" ||
      joinedIds.includes(room.id);
    if (appNavigationRef.isReady()) {
      appNavigationRef.navigate(openChat ? "Chat" : "Detail");
    } else {
      setScreen(openChat ? "chat" : "detail");
    }
  };
  useEffect(() => {
    const toNotice = (
      data: Record<string, unknown> | undefined,
    ): Notice | null => {
      const roomId = typeof data?.roomId === "string" ? data.roomId : undefined;
      if (!roomId) return null;
      const type = String(data?.type ?? "chat");
      const storyId =
        typeof data?.storyId === "string" ? data.storyId : undefined;
      return {
        id: `push-${Date.now()}`,
        icon: type === "join_request" ? "person-add-outline" : "chatbubble-outline",
        title: String(data?.roomName ?? ""),
        body: "",
        time: "지금",
        read: true,
        roomId,
        storyId,
        destination:
          type === "join_request"
            ? "applications"
            : type === "story" || type === "story_comment"
              ? "stories"
            : type === "join_rejected"
              ? "detail"
              : "chat",
      };
    };
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const request = response.notification.request;
      const responseKey =
        request.identifier ||
        `${response.notification.date ?? ""}-${JSON.stringify(
          request.content.data ?? {},
        )}`;
      if (handledPushResponseIdsRef.current.has(responseKey)) return;
      handledPushResponseIdsRef.current.add(responseKey);
      Keyboard.dismiss();
      const notice = toNotice(
        request.content.data as Record<string, unknown> | undefined,
      );
      if (notice) void openNotification(notice);
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    if (!checkedInitialPushResponseRef.current) {
      checkedInitialPushResponseRef.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then(handleResponse)
        .catch(() => undefined);
    }
    return () => subscription.remove();
  }, [joinedIds, roomData, canSeeAdultRooms, isSuperAdmin]);
  const topSpaceCount = (room: Room) =>
    room.topSpaceCount + (boosts[room.id] ?? 0);
  const promoteRoom = async (room: Room) => {
    if (promotingRoomsRef.current.has(room.id)) {
      return { ok: false as const, remainingMs: -1 };
    }
    if (room.isAdult) {
      return { ok: false as const, remainingMs: -1 };
    }
    const current = Date.now();
    const lastPromotedAt = promotionTimestamps[room.id] ?? 0;
    const nextAvailableAt = lastPromotedAt + 15 * 60 * 1000;
    if (current < nextAvailableAt) {
      return { ok: false as const, remainingMs: nextAvailableAt - current };
    }
    let promotedAt = current;
    if (isSupabaseConfigured && isUuid(room.id)) {
      promotingRoomsRef.current.add(room.id);
      try {
        promotedAt = new Date(
          (await promoteRoomOnServer(room.id)).lastPromotedAt,
        ).getTime();
      } catch (error) {
        const text = serverErrorMessage(error);
        const match = text.match(/PROMOTION_COOLDOWN:(\d+)/);
        return {
          ok: false as const,
          remainingMs: match
            ? Number(match[1]) * 1000
            : nextAvailableAt - current,
        };
      } finally {
        promotingRoomsRef.current.delete(room.id);
      }
    }
    setPromotionTimestamps((value) => {
      const next = { ...value, [room.id]: promotedAt };
      const entries = Object.entries(next)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
      return Object.fromEntries(entries);
    });
    setRoomData((items) =>
      items.map((item) =>
        item.id === room.id
          ? { ...item, isPromoted: true, updatedAt: current }
          : item,
      ),
    );
    return { ok: true as const, remainingMs: 15 * 60 * 1000 };
  };
  const boostRoom = async (room: Room, option: TopSpacePackage) => {
    if (points < option.points) return false;
    const purchasedAt = Date.now();
    if (isSupabaseConfigured && isUuid(room.id)) {
      try {
        const requestKey = `${room.id}:${option.points}`;
        const requestId =
          topSpaceRequestIdsRef.current[requestKey] ??
          `topspace-${room.id}-${option.points}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
        topSpaceRequestIdsRef.current[requestKey] = requestId;
        const result = await boostTopSpace(room.id, option.points, requestId);
        delete topSpaceRequestIdsRef.current[requestKey];
        setPoints(result.pointBalance);
        setTopSpaceExpiresAt((value) => ({
          ...value,
          [room.id]: new Date(result.expiresAt).getTime(),
        }));
        setTopSpaceDurations((value) => ({
          ...value,
          [room.id]: result.totalDurationSeconds * 1000,
        }));
        setBoosts((value) => ({
          ...value,
          [room.id]: result.boostCount,
        }));
        return true;
      } catch (error) {
        if (serverErrorMessage(error).includes("INSUFFICIENT_POINTS"))
          return false;
        throw error;
      }
    }
    const currentRemaining = Math.max(
      0,
      (topSpaceExpiresAt[room.id] ?? 0) - purchasedAt,
    );
    const addedDuration = option.seconds * 1000;
    setPoints((value) => value - option.points);
    setBoosts((value) => ({ ...value, [room.id]: (value[room.id] ?? 0) + 1 }));
    setTopSpaceExpiresAt((value) => ({
      ...value,
      [room.id]: purchasedAt + currentRemaining + addedDuration,
    }));
    setTopSpaceDurations((value) => ({
      ...value,
      [room.id]: currentRemaining + addedDuration,
    }));
    setNow(purchasedAt);
    return true;
  };
  const claimReward = async (type: "attendance" | "rewarded_ad") => {
    if (rewardLoading) return;
    setRewardLoading(type);
    try {
      const ad = await showRewardedAd(type);
      if (!ad.completed) return;
      if (isSupabaseConfigured) {
        const result = await claimPointReward(type, ad.rewardKey);
        setPoints(result.pointBalance);
        if (type === "attendance") {
          setAttendanceAvailableAt(new Date(result.nextAvailableAt).getTime());
          setRewardedAdAvailable(true);
        } else {
          setRewardedAdAvailable(false);
        }
        Alert.alert(
          "포인트 지급",
          `${result.awardedPoints}포인트를 받았습니다.`,
        );
      } else {
        const reward = type === "attendance" ? 20 : 10;
        setPoints((value) => value + reward);
        if (type === "attendance") {
          setAttendanceAvailableAt(Date.now() + 60 * 60 * 1000);
          setRewardedAdAvailable(true);
        } else {
          setRewardedAdAvailable(false);
        }
        Alert.alert("포인트 지급", `${reward}포인트를 받았습니다.`);
      }
    } catch (error) {
      const message = serverErrorMessage(error);
      Alert.alert(
        "보상 지급 실패",
        message.includes("REWARD_COOLDOWN")
          ? "아직 출석 체크 시간이 아닙니다."
          : message.includes("REWARDED_AD_ATTENDANCE_REQUIRED")
            ? "출석 체크 후에 광고 보상을 받을 수 있습니다."
            : message.includes("REWARDED_AD_ALREADY_CLAIMED")
              ? "이번 출석 주기에서 광고 보상은 이미 받았습니다."
          : message.includes("DAILY_REWARD_LIMIT")
            ? "오늘 받을 수 있는 광고 보상을 모두 받았습니다."
            : message,
      );
    } finally {
      setRewardLoading(null);
    }
  };
  const effectiveAdminReadOnly = Boolean(
    adminReadOnly || (isSuperAdmin && !joinedIds.includes(selectedRoom.id)),
  );
  const joinedIdSet = new Set(joinedIds);
  const hiddenRoomIds = new Set(reportedRoomIds);
  const enrichedRoomData = roomData
    .filter((room) => !hiddenRoomIds.has(room.id) || joinedIdSet.has(room.id))
    .map((room) => {
    const summary = roomSummaries[room.id];
    return {
      ...room,
      lastMessage: summary?.lastMessage,
      updatedAt: summary?.updatedAt ?? room.updatedAt,
    };
  });
  const activeTopSpaces = enrichedRoomData
    .filter((room) => (topSpaceExpiresAt[room.id] ?? 0) > now)
    .sort(
      (a, b) => (topSpaceExpiresAt[b.id] ?? 0) - (topSpaceExpiresAt[a.id] ?? 0),
    );
  const topSpaceProgress = (room: Room) =>
    Math.max(
      0,
      Math.min(
        1,
        ((topSpaceExpiresAt[room.id] ?? 0) - now) /
          (topSpaceDurations[room.id] || 1),
      ),
    );
  return (
    <AdFreeContext.Provider value={adFreeActive}>
    <AppStack.Navigator
      initialRouteName="Main"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right",
      }}
    >
      <AppStack.Screen name="Main">
        {({ navigation }) => {
          const navigateRoom = async (room: Room) => {
            if (!canAccessAdultRoom(room)) {
              Alert.alert("접근 불가", "이 콘텐츠는 현재 iOS에서 이용할 수 없습니다.");
              return;
            }
            setChatInitialPanel(null);
            setChatInitialStoryId(null);
            setChatInitialUnreadFocus(false);
            setReturnToNotifications(false);
            setSelectedRoom(room);
            setUnreadCounts((counts) => ({ ...counts, [room.id]: 0 }));
            setAdminReadOnly(false);
            if (room.isSample || joinedIds.includes(room.id)) {
              navigation.navigate("Chat");
              return;
            }
            if (isSuperAdmin) setAdminReadOnly(true);
            navigation.navigate("Detail");
          };
          const navigateRoomDetail = (room: Room) => {
            if (!canAccessAdultRoom(room)) {
              Alert.alert("접근 불가", "이 콘텐츠는 현재 iOS에서 이용할 수 없습니다.");
              return;
            }
            setSelectedRoom(room);
            setAdminReadOnly(Boolean(isSuperAdmin && !joinedIds.includes(room.id)));
            navigation.navigate("Detail");
          };
          const navigateNotification = async (notice: Notice) => {
            if (notice.destination === "promotion") {
              setBottomTab("discover");
              setCategory("promotion");
              return;
            }
            let room = roomData.find((item) => item.id === notice.roomId);
            if (
              !room &&
              notice.roomId &&
              isUuid(notice.roomId) &&
              isSupabaseConfigured
            ) {
              try {
                const serverRoom = await getRoomById(notice.roomId);
                if (serverRoom) {
                  room = mapServerRoom(serverRoom);
                  setRoomData((items) =>
                    items.some((item) => item.id === room!.id)
                      ? items
                      : [room!, ...items],
                  );
                }
              } catch {
                room = undefined;
              }
            }
            if (!room) {
              Alert.alert("알림 이동 실패", "삭제되었거나 접근할 수 없는 방입니다.");
              return;
            }
            if (!canAccessAdultRoom(room)) {
              Alert.alert("접근 불가", "이 콘텐츠는 현재 iOS에서 이용할 수 없습니다.");
              return;
            }
            setSelectedRoom(room);
            setAdminReadOnly(Boolean(isSuperAdmin && !joinedIds.includes(room.id)));
            setReturnToNotifications(notice.destination === "applications");
            setChatInitialPanel(
              notice.destination === "applications"
                ? "applications"
                : notice.destination === "stories"
                  ? "stories"
                  : null,
            );
            setChatInitialStoryId(
              notice.destination === "stories"
                ? notice.storyId ?? null
                : null,
            );
            setChatInitialUnreadFocus(notice.destination === "chat");
            navigation.navigate(
              notice.destination === "chat" ||
                notice.destination === "applications" ||
                notice.destination === "stories" ||
                joinedIds.includes(room.id)
                ? "Chat"
                : "Detail",
            );
          };
          return (
            <MainScreen
              {...{
                bottomTab,
                setBottomTab,
                category,
                setCategory,
                joinedIds,
                activeTopSpaces,
                now,
                roomData: enrichedRoomData,
                hiddenRoomIds: reportedRoomIds,
                adultVerified,
                showAdultTab,
                canSeeAdultRooms,
                isSuperAdmin,
                points,
                attendanceAvailableAt,
                rewardedAdAvailable,
                rewardLoading,
                promotionTimestamps,
                unreadCounts,
                dataRefreshing,
                dataLoaded: roomDataLoaded,
                currentUserId: session?.user.id,
              }}
              openRoom={navigateRoom}
              onRefresh={() => reloadAppData(true)}
              onAttendance={() => claimReward("attendance")}
              onRewardedAd={() => claimReward("rewarded_ad")}
              openRoomDetail={navigateRoomDetail}
              onAdminReportRoom={(room: Room) =>
                adminReport("room", room.id, room.name)
              }
              topSpaceProgress={topSpaceProgress}
              onNotification={(notice) => void navigateNotification(notice)}
              notificationDrawerSignal={notificationDrawerSignal}
              onRanking={() => navigation.navigate("Ranking")}
              onPointBalanceChange={setPoints}
              onSearch={() => navigation.navigate("Search")}
              onSettings={() => navigation.navigate("Settings")}
              onCreate={() => navigation.navigate("Create")}
            />
          );
        }}
      </AppStack.Screen>
      <AppStack.Screen name="Search">
        {({ navigation }) => (
          <SearchScreen
            roomData={roomData}
            query={query}
            setQuery={setQuery}
            joinedIds={joinedIds}
            canSeeAdultRooms={canSeeAdultRooms}
            isSuperAdmin={isSuperAdmin}
            onBack={() => navigation.goBack()}
            openRoom={(room) => {
              setSelectedRoom(room);
              setAdminReadOnly(Boolean(isSuperAdmin && !joinedIds.includes(room.id)));
              navigation.navigate(joinedIds.includes(room.id) ? "Chat" : "Detail");
            }}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Ranking">
        {({ navigation }) => (
          <RankingScreen
            roomData={roomData}
            onBack={() => navigation.goBack()}
            openRoom={(room) => {
              setSelectedRoom(room);
              navigation.navigate(joinedIds.includes(room.id) ? "Chat" : "Detail");
            }}
            countFor={topSpaceCount}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Detail">
        {({ navigation }) => (
          <RoomDetail
            room={selectedRoom}
            joined={joinedIds.includes(selectedRoom.id)}
            currentUserId={session?.user.id}
            adminReadOnly={effectiveAdminReadOnly}
            isSuperAdmin={isSuperAdmin}
            onAdminReportUser={(id, label) => adminReport("user", id, label)}
            pending={pendingIds.includes(selectedRoom.id)}
            onBack={() => navigation.goBack()}
            onApply={() => navigation.navigate("Apply")}
            onEnterChat={() => navigation.navigate("Chat")}
            onEdit={() => navigation.navigate("EditRoom")}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Apply">
        {({ navigation }) => (
          <JoinApplication
            room={selectedRoom}
            onBack={() => navigation.goBack()}
            onCompleted={() => navigation.goBack()}
            onSubmit={async (name, intro, avatarUploadId) => {
              if (isSupabaseConfigured) {
                await requestRoomJoinWithAvatar(
                  selectedRoom.id,
                  name,
                  intro,
                  avatarUploadId,
                );
              }
              setPendingIds((ids) => [...new Set([...ids, selectedRoom.id])]);
              return `${selectedRoom.name}에 가입 신청을 보냈습니다.`;
            }}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Chat" options={{ gestureEnabled: false }}>
        {({ navigation }) => (
          <ChatRoom
            room={selectedRoom}
            currentUserId={session?.user.id}
            readOnly={effectiveAdminReadOnly}
            isKnownOwner={ownedRoomIds.includes(selectedRoom.id)}
            isSuperAdmin={isSuperAdmin}
            onAdminReportUser={(id, label) => adminReport("user", id, label)}
            onEditRoom={() => navigation.navigate("EditRoom")}
            initialPanel={chatInitialPanel}
            initialStoryId={chatInitialStoryId}
            initialFocusUnread={chatInitialUnreadFocus}
            onApplicationsBack={
              returnToNotifications
                ? () => {
                    setReturnToNotifications(false);
                    setChatInitialPanel(null);
                    setChatInitialStoryId(null);
                    setChatInitialUnreadFocus(false);
                    navigation.popToTop();
                    setNotificationDrawerSignal((value) => value + 1);
                  }
                : undefined
            }
            points={points}
            onPointBalanceChange={setPoints}
            promotionAvailableAt={
              (promotionTimestamps[selectedRoom.id] ?? 0) + 15 * 60 * 1000
            }
            topSpaceExpiresAt={topSpaceExpiresAt[selectedRoom.id]}
            topSpaceRemaining={formatTopSpaceRemaining(
              topSpaceExpiresAt[selectedRoom.id],
              now,
            )}
            onBoost={(option) => boostRoom(selectedRoom, option)}
            onPromote={() => promoteRoom(selectedRoom)}
            onDeleted={(roomId) => {
              setRoomData((items) => items.filter((item) => item.id !== roomId));
              setJoinedIds((ids) => ids.filter((id) => id !== roomId));
              setOwnedRoomIds((ids) => ids.filter((id) => id !== roomId));
              setUnreadCounts((counts) => {
                const next = { ...counts };
                delete next[roomId];
                return next;
              });
              navigation.popToTop();
            }}
            onRead={(roomId) => {
              setUnreadCounts((counts) => ({ ...counts, [roomId]: 0 }));
            }}
            onBack={() => {
              setReturnToNotifications(false);
              setChatInitialPanel(null);
              setChatInitialStoryId(null);
              setChatInitialUnreadFocus(false);
              navigation.goBack();
            }}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="EditRoom">
        {({ navigation }) => (
          <EditRoom
            room={selectedRoom}
            onBack={() => navigation.goBack()}
            onUpdated={(updated) => {
              setSelectedRoom(updated);
              setRoomData((items) =>
                items.map((item) => (item.id === updated.id ? updated : item)),
              );
              navigation.goBack();
            }}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="Settings">
        {({ navigation }) => (
          <Settings
            adultVerified={adultVerified}
            isSuperAdmin={isSuperAdmin}
            onAdultVerification={() => navigation.navigate("AdultVerification")}
            onBack={() => navigation.goBack()}
            onSignedOut={onSignedOut}
          />
        )}
      </AppStack.Screen>
      <AppStack.Screen name="AdultVerification">
        {({ navigation }) =>
          IOS_HIDE_ADULT_UI ? (
            <Settings
              adultVerified={adultVerified}
              isSuperAdmin={isSuperAdmin}
              onAdultVerification={() => navigation.navigate("AdultVerification")}
              onBack={() => navigation.goBack()}
              onSignedOut={onSignedOut}
            />
          ) : (
            <AdultVerificationScreen
              verified={adultVerified}
              onBack={() => navigation.goBack()}
              onRefresh={async () => {
                const status = await getVerificationStatus();
                setAdultVerified(status.adultVerified);
                return status.adultVerified;
              }}
            />
          )
        }
      </AppStack.Screen>
      <AppStack.Screen name="Create">
        {({ navigation }) => (
          <CreateRoom
            adultVerified={canUseAdultFeatures}
            showAdultTab={showAdultTab || isSuperAdmin}
            onBack={() => navigation.goBack()}
            onCreated={(room) => {
              setRoomData((items) => [room, ...items]);
              setJoinedIds((ids) => [...new Set([...ids, room.id])]);
              setOwnedRoomIds((ids) => [...new Set([...ids, room.id])]);
              setSelectedRoom(room);
              setBottomTab("myRooms");
              navigation.popToTop();
            }}
          />
        )}
      </AppStack.Screen>
    </AppStack.Navigator>
    </AdFreeContext.Provider>
  );
}

function mapServerRoom(room: ServerRoom): Room {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    tags: [
      ...new Set(
        [
          room.region ??
            (room.category === "concept"
              ? "콘셉트"
              : room.category === "adult"
                ? "성인"
                : "Member"),
        ].filter(Boolean),
      ),
    ],
    memberCount: room.member_count ?? 1,
    maxMembers: room.max_members,
    region: room.region ?? undefined,
    category:
      room.category === "concept"
        ? "concept"
        : room.category === "member"
          ? "member"
          : "general",
    topSpaceCount: 0,
    isAdult: room.category === "adult",
    isPrivate: room.visibility === "private",
    isActive: true,
    emoji: "○",
    imageColor: "#E8ECEA",
    coverUri: room.cover_url,
    createdAt: new Date(room.created_at).getTime(),
    updatedAt: new Date(room.updated_at).getTime(),
  };
}

function extractHashTags(_text: string) {
  return [] as string[];
}

function serverErrorMessage(error: unknown) {
  let message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!message && error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    message = String(
      record.message ??
        record.error_description ??
        record.error ??
        record.code ??
        "",
    );
    if (!message || message === "[object Object]") {
      try {
        message = JSON.stringify(error);
      } catch {
        message = "알 수 없는 오류가 발생했습니다.";
      }
    }
  }
  if (!message || message === "[object Object]")
    message = "알 수 없는 오류가 발생했습니다.";
  if (message.includes("MESSAGE_RATE_LIMIT"))
    return "메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.";
  if (message.includes("RATE_LIMITED")) return "잠시 후 다시 시도해주세요.";
  if (message.includes("PHONE_ALREADY_REGISTERED"))
    return "이미 가입된 전화번호입니다.";
  if (
    message.includes("already registered") ||
    message.includes("User already registered") ||
    message.includes("already been registered")
  )
    return "이미 가입된 번호입니다.";
  if (
    message.includes("PHONE_NOT_REGISTERED") ||
    message.includes("User not found") ||
    message.includes("not found")
  )
    return "가입된 전화번호가 아닙니다.";
  if (message.includes("PHONE_SIGNUP_COOLDOWN"))
    return "탈퇴 후 3일 동안 같은 전화번호로 가입할 수 없습니다.";
  if (message.includes("ALREADY_MEMBER")) return "이미 참여 중인 방입니다.";
  if (message.includes("ROOM_FULL")) return "방의 최대 인원에 도달했습니다.";
  if (message.includes("ROOM_CREATE_COOLDOWN"))
    return "방은 1분에 한 번만 만들 수 있습니다.";
  if (
    message.includes("room_join_requests_one_pending") ||
    message.includes("duplicate key value violates unique constraint") ||
    message.includes("duplicate key")
  )
    return "이미 가입 신청을 보냈습니다.";
  if (message.includes("ROOM_BANNED"))
    return "이 방에서 재가입이 제한된 계정입니다.";
  if (message.includes("MEMBER_NOT_FOUND"))
    return "대상 멤버를 찾을 수 없습니다.";
  if (message.includes("CANNOT_MUTE_OWNER"))
    return "방장은 채팅 금지할 수 없습니다.";
  if (message.includes("INVALID_MUTE_DURATION"))
    return "허용된 채팅 금지 시간만 설정할 수 있습니다.";
  if (message.includes("ROOM_CREATE_INVALID_RESPONSE"))
    return "방은 생성됐지만 결과를 확인하지 못했습니다. 목록을 새로고침해 주세요.";
  if (message.includes("ROOM_PROMOTION_INVALID_RESPONSE"))
    return "프로모션 결과를 확인하지 못했습니다. 잠시 후 목록을 새로고침해 주세요.";
  if (message.includes("TOP_SPACE_INVALID_RESPONSE"))
    return "탑스페이스 결제 결과를 확인하지 못했습니다. 포인트 내역을 확인해 주세요.";
  if (message.includes("POINT_TRANSFER_INVALID_RESPONSE"))
    return "포인트 전송 결과를 확인하지 못했습니다. 포인트 내역을 확인해 주세요.";
  if (message.includes("MESSAGE_SEND_INVALID_RESPONSE"))
    return "메시지 전송 결과를 확인하지 못했습니다. 잠시 후 채팅을 새로고침해 주세요.";
  if (message.includes("ROOM_MUTE_INVALID_RESPONSE"))
    return "채팅 금지 결과를 확인하지 못했습니다. 멤버 정보를 새로고침해 주세요.";
  if (message.includes("ACCOUNT_REJOIN_COOLDOWN"))
    return "탈퇴 후 3일 동안 같은 전화번호로 가입할 수 없습니다.";
  if (message.includes("ADMIN_ACCOUNT_DELETION_FORBIDDEN"))
    return "슈퍼관리자 계정은 탈퇴할 수 없습니다.";
  if (message.includes("INVALID_PIN"))
    return "PIN은 숫자 6자리로 입력해주세요.";
  if (message.includes("INSUFFICIENT_POINTS")) return "포인트가 부족합니다.";
  if (message.includes("POINT_TRANSFER_AMOUNT_INVALID"))
    return "보낼 포인트를 1p 이상의 숫자로 입력해주세요.";
  if (message.includes("POINT_TRANSFER_RECIPIENT_INVALID"))
    return "현재 방에 참여 중인 멤버에게만 포인트를 보낼 수 있습니다.";
  if (message.includes("POINT_TRANSFER_MEMBER_REQUIRED"))
    return "방에 참여 중인 멤버만 포인트를 보낼 수 있습니다.";
  if (message.includes("POINT_TRANSFER_IDEMPOTENCY_CONFLICT"))
    return "전송 정보가 변경되었습니다. 금액을 다시 확인해주세요.";
  if (message.includes("POINT_TRANSFER_REQUEST_INVALID"))
    return "포인트 전송 요청을 다시 시도해주세요.";
  if (message.includes("POINT_TRANSFER_INCOMPLETE"))
    return "이전 전송을 확인 중입니다. 포인트 내역을 확인해주세요.";
  if (message.includes("POINT_TRANSFER_INVALID_RESPONSE"))
    return "포인트 전송 결과를 확인하지 못했습니다. 포인트 내역을 확인해주세요.";
  if (message.includes("STORE_PURCHASE_PLATFORM_NOT_AVAILABLE"))
    return "현재 기기에서는 인앱결제를 사용할 수 없습니다.";
  if (message.includes("PURCHASE_TIMEOUT"))
    return "구매 응답 시간이 초과되었습니다. 결제 상태를 확인한 뒤 다시 시도해주세요.";
  if (message.includes("STORE_PRODUCT_NOT_FOUND")) {
    const id = message.match(/STORE_PRODUCT_NOT_FOUND:(\S+)/)?.[1];
    return `App Store Connect에서 상품을 찾지 못했습니다.${id ? ` (${id})` : ""} 상품 ID와 심사 상태를 확인해주세요.`;
  }
  if (message.includes("UNSUPPORTED_PRODUCT"))
    return "서버 검증 대상에 등록되지 않은 상품입니다. 앱 버전과 서버 설정을 같이 확인해주세요.";
  if (
    message.includes("TRANSACTION_OWNED_BY_ANOTHER_ACCOUNT") ||
    message.includes("APP_ACCOUNT_TOKEN_MISMATCH")
  )
    return "이 Apple ID의 구매 내역이 다른 앱 계정에 이미 연결되어 있습니다. 해당 구매를 사용하려면 처음 구매한 앱 계정으로 로그인하거나, 다른 앱 계정 테스트에는 다른 Apple ID를 사용해주세요.";
  if (message.includes("APP_ACCOUNT_TOKEN_MISSING"))
    return "구매 계정 식별 정보가 없어 현재 앱 계정으로 검증할 수 없습니다. 앱을 완전히 종료한 뒤 다시 시도하고, 계속 실패하면 다른 Apple ID로 테스트해주세요.";
  if (message.includes("REWARDED_AD_ATTENDANCE_REQUIRED"))
    return "출석 체크 후 대기 시간 동안 한 번만 광고 보상을 받을 수 있습니다.";
  if (message.includes("REWARDED_AD_ALREADY_CLAIMED"))
    return "이번 출석 대기 시간에는 이미 광고 보상을 받았습니다.";
  if (message.includes("REWARD_COOLDOWN"))
    return "아직 출석 체크 시간이 아닙니다.";
  if (message.includes("cancel") || message.includes("Cancelled"))
    return "구매가 취소되었습니다.";
  if (message.includes("APP_STORE_API_NOT_CONFIGURED"))
    return "결제 검증 서버 설정이 아직 완료되지 않았습니다.";
  if (message.includes("APPLE_TRANSACTION_NOT_FOUND"))
    return "App Store에서 구매 거래를 찾지 못했습니다. 잠시 후 다시 시도해주세요.";
  if (message.includes("PRODUCT_ID_MISMATCH"))
    return "구매 상품 정보가 일치하지 않습니다.";
  if (message.includes("BUNDLE_ID_MISMATCH"))
    return "앱 결제 정보가 일치하지 않습니다.";
  if (message.includes("TRANSACTION_REVOKED"))
    return "취소되었거나 환불된 구매입니다.";
  if (message.includes("SUBSCRIPTION_NOT_ACTIVE"))
    return "활성화된 구독을 확인하지 못했습니다.";
  if (message.includes("ROOM_MUTED")) return "채팅 금지 상태입니다.";
  if (message.includes("POINT_PRODUCT_NOT_SUPPORTED"))
    return "아직 준비되지 않은 상품입니다. 상품 ID와 서버 상품 설정을 확인해주세요.";
  if (message.includes("MEDIA_VALIDATION_FAILED"))
    return "이미지 검증 서버가 응답하지 않았습니다. 잠시 후 다시 시도해주세요.";
  if (message.includes("MEDIA_VALIDATION_REJECTED"))
    return "지원하지 않는 이미지이거나 파일이 손상되었습니다.";
  if (message.includes("ADULT_VERIFICATION_REQUIRED"))
    return "성인 인증이 필요한 기능입니다.";
  if (message.includes("OPERATIONS_POLICY_URL_NOT_CONFIGURED"))
    return "운영정책 웹 페이지 주소가 아직 설정되지 않았습니다.";
  if (message.includes("AUTH_REQUIRED") || message.includes("JWT"))
    return "로그인이 만료되었습니다. 다시 로그인해주세요.";
  if (message.includes("invalid input syntax for type uuid"))
    return "이 항목은 아직 데모 데이터입니다. 서버에 생성된 방에서 다시 시도해주세요.";
  return message;
}

function SplashScreen() {
  const theme = useAppTheme();
  return (
    <LinearGradient colors={theme.gradient} style={s.authSplash}>
      <StatusBar style="light" hidden />
      <View style={s.splashLogoWrap}>
        <MuteLogo variant="white" compact />
      </View>
    </LinearGradient>
  );
}

function PhoneAuthScreen({
  onRecoveryStateChange,
}: {
  onRecoveryStateChange: (active: boolean) => void;
}) {
  type AuthMode = "login" | "signup" | "recovery";
  type AuthStep = "form" | "otp" | "newPassword";
  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("form");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);
  const validPhone = phone.replace(/\D/g, "").length >= 10;
  const validPassword = password.length >= 8;
  const resetFlow = (nextMode: AuthMode) => {
    onRecoveryStateChange(false);
    setMode(nextMode);
    setStep("form");
    setCode("");
    setPassword("");
    setPasswordConfirm("");
  };
  const submitCredentials = async () => {
    if (!validPhone || !validPassword) return;
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithPhonePassword(phone, password);
        return;
      }
      const result = await signUpWithPhonePassword(phone, password);
      setNormalizedPhone(result.phone);
      if (!result.session) {
        setStep("otp");
        setCooldown(60);
      }
    } catch (error) {
      Alert.alert(
        mode === "login" ? "로그인 실패" : "가입 실패",
        mode === "login"
          ? "전화번호 또는 비밀번호를 확인해주세요."
          : serverErrorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  };
  const requestRecovery = async () => {
    if (!validPhone || cooldown > 0) return;
    setLoading(true);
    try {
      setNormalizedPhone(await requestPasswordRecoveryOtp(phone));
      onRecoveryStateChange(true);
      setStep("otp");
      setCooldown(60);
    } catch {
      Alert.alert(
        "인증번호 전송 실패",
        "입력한 정보를 확인하거나 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setLoading(false);
    }
  };
  const resendCode = async () => {
    if (cooldown > 0 || loading) return;
    setCode("");
    setLoading(true);
    try {
      if (mode === "signup") await resendPhoneOtp(normalizedPhone);
      else await requestPasswordRecoveryOtp(phone);
      setCooldown(60);
    } catch {
      Alert.alert("재전송 실패", "잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };
  const verifyCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyPhoneOtp(normalizedPhone, code);
      if (mode === "recovery") setStep("newPassword");
    } catch {
      Alert.alert("본인인증 실패", "인증번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };
  const changePassword = async () => {
    if (!validPassword || password !== passwordConfirm) return;
    setLoading(true);
    try {
      await updateCurrentUserPassword(password);
      await signOut();
      onRecoveryStateChange(false);
      Alert.alert("변경 완료", "새 비밀번호로 로그인해주세요.");
    } catch (error) {
      Alert.alert("비밀번호 변경 실패", serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const title =
    mode === "login"
      ? "로그인"
      : mode === "signup"
        ? "전화번호로 가입"
        : "비밀번호 찾기";
  const body =
    mode === "login"
      ? "전화번호와 비밀번호를 입력해주세요."
      : mode === "signup"
        ? "가입할 때 한 번만 전화번호를 인증합니다."
        : "문자 인증 후 새 비밀번호를 설정합니다.";
  if (step === "otp")
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark" />
        <View style={s.authCard}>
          <MuteLogo />
          <Text style={s.authTitle}>인증번호 입력</Text>
          <Text style={s.authBody}>문자로 받은 6자리 번호를 입력해주세요.</Text>
          <TextInput
            autoFocus
            value={code}
            onChangeText={(value) =>
              setCode(value.replace(/\D/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          <Pressable
            disabled={loading || code.length !== 6}
            onPress={verifyCode}
            style={[s.primary, (loading || code.length !== 6) && s.disabled]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading ? "확인 중..." : "인증 완료"}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            disabled={cooldown > 0 || loading}
            onPress={resendCode}
            style={s.authBack}
          >
            <Text style={s.authBackText}>
              {cooldown > 0 ? `${cooldown}초 후 재전송` : "인증번호 다시 받기"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setStep("form")} style={s.authBack}>
            <Text style={s.authBackText}>전화번호 다시 입력</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  if (step === "newPassword")
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark" />
        <View style={s.authCard}>
          <MuteLogo />
          <Text style={s.authTitle}>새 비밀번호 설정</Text>
          <Text style={s.authBody}>8자 이상의 새 비밀번호를 입력해주세요.</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="새 비밀번호"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          <TextInput
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="새 비밀번호 확인"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          <Pressable
            disabled={loading || !validPassword || password !== passwordConfirm}
            onPress={changePassword}
            style={[
              s.primary,
              (loading || !validPassword || password !== passwordConfirm) &&
                s.disabled,
            ]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading ? "변경 중..." : "비밀번호 변경"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.authScreen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.authCard}
      >
        <MuteLogo />
        <Text style={s.authTitle}>{title}</Text>
        <Text style={s.authBody}>{body}</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="010-0000-0000"
          placeholderTextColor={colors.textMuted}
          style={s.authInput}
        />
        {mode !== "recovery" && (
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호 8자 이상"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
        )}
        <Pressable
          disabled={
            loading || !validPhone || (mode !== "recovery" && !validPassword)
          }
          onPress={mode === "recovery" ? requestRecovery : submitCredentials}
          style={[
            s.primary,
            (loading ||
              !validPhone ||
              (mode !== "recovery" && !validPassword)) &&
              s.disabled,
          ]}
        >
          <LinearGradient
            colors={["#82B9C1", "#5DBB8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.primaryGradient}
          >
            <Text style={s.primaryText}>
              {loading
                ? "처리 중..."
                : mode === "login"
                  ? "로그인"
                  : mode === "signup"
                    ? "가입 및 인증"
                    : "인증번호 받기"}
            </Text>
          </LinearGradient>
        </Pressable>
        {mode === "login" ? (
          <View>
            <Pressable onPress={() => resetFlow("recovery")} style={s.authBack}>
              <Text style={s.authBackText}>비밀번호를 잊으셨나요?</Text>
            </Pressable>
            <Pressable onPress={() => resetFlow("signup")} style={s.authBack}>
              <Text style={s.authBackText}>처음이신가요? 가입하기</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => resetFlow("login")} style={s.authBack}>
            <Text style={s.authBackText}>로그인으로 돌아가기</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PhoneAuthScreenV2({
  onRecoveryStateChange,
}: {
  onRecoveryStateChange: (active: boolean) => void;
}) {
  type AuthMode = "login" | "signup" | "recovery";
  type AuthStep = "form" | "otp" | "newPassword";
  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("form");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [signupOtpRequested, setSignupOtpRequested] = useState(false);
  const [signupPhoneVerified, setSignupPhoneVerified] = useState(false);
  const [signupTemporaryPassword, setSignupTemporaryPassword] = useState("");
  const [signupPhoneNotice, setSignupPhoneNotice] = useState("");
  const [signupOtpStatus, setSignupOtpStatus] = useState<
    "idle" | "verifying" | "error" | "verified"
  >("idle");
  const [signupOtpError, setSignupOtpError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loginTermsAccepted, setLoginTermsAccepted] = useState(false);
  const signupReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cooldown <= 0 && otpSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
      setOtpSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown, otpSeconds]);

  const phoneDigits = phone.replace(/\D/g, "").slice(0, 11);
  const validPhone = /^010\d{8}$/.test(phoneDigits);
  const validAdminId = /^[a-z][a-z0-9-]{2,31}$/.test(
    phone.trim().toLowerCase(),
  );
  const validLoginIdentifier = validPhone || validAdminId;
  const showPhoneFormatError = phoneDigits.length > 0 && !validPhone;
  const validPassword = password.length >= 8;
  const passwordsMatch =
    password === passwordConfirm && passwordConfirm.length > 0;
  const otpExpired =
    signupOtpRequested && otpSeconds === 0 && !signupPhoneVerified;
  const timerText = `${String(Math.floor(otpSeconds / 60)).padStart(2, "0")}:${String(otpSeconds % 60).padStart(2, "0")}`;
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };
  const changePhone = (value: string) => {
    setPhone(formatPhone(value));
    setSignupPhoneNotice("");
  };

  const resetFlow = (nextMode: AuthMode) => {
    onRecoveryStateChange(false);
    setMode(nextMode);
    setStep("form");
    setPhone("");
    setNormalizedPhone("");
    setCode("");
    setPassword("");
    setPasswordConfirm("");
    setCooldown(0);
    setOtpSeconds(0);
    setSignupOtpRequested(false);
    setSignupPhoneVerified(false);
    setSignupTemporaryPassword("");
    setSignupPhoneNotice("");
    setSignupOtpStatus("idle");
    setSignupOtpError("");
    setPrivacyAccepted(false);
    setAgeConfirmed(false);
    setLoginTermsAccepted(false);
    signupReveal.setValue(0);
  };

  const exitSignup = () => {
    Keyboard.dismiss();
    if (signupOtpRequested || signupPhoneVerified || normalizedPhone) {
      void signOut().catch(() => undefined);
    }
    resetFlow("login");
  };

  const login = async () => {
    if (!validLoginIdentifier || !validPassword) return;
    if (!loginTermsAccepted) {
      Alert.alert("동의 필요", "이용약관 및 커뮤니티 운영정책에 동의해주세요.");
      return;
    }
    setLoading(true);
    try {
      if (validAdminId) {
        try {
          await signInWithAdminId(phone, password);
        } catch {
          await signInWithTestId(phone, password);
        }
      } else await signInWithPhonePassword(phone, password);
    } catch {
      Alert.alert("로그인 실패", "전화번호 또는 비밀번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const requestSignupOtp = async () => {
    if (!validPhone || loading) return;
    const normalized = normalizeKoreanPhoneNumber(phone);
    setLoading(true);
    try {
      const status = await checkPhoneSignUpStatus(normalized);
      if (!status.canSignUp) {
        setSignupOtpRequested(false);
        setSignupPhoneVerified(false);
        setSignupOtpStatus("idle");
        setSignupOtpError("");
        setOtpSeconds(0);
        setCooldown(0);
        signupReveal.setValue(0);
        onRecoveryStateChange(false);
        setSignupPhoneNotice(
          status.reason === "exists"
            ? "이미 가입된 번호입니다."
            : "현재 가입할 수 없는 전화번호입니다.",
        );
        return;
      }
      const result = await requestSignUpPhoneOtp(phone);
      if (result.session) {
        await signOut();
        throw new Error("전화번호 확인 설정을 점검해주세요.");
      }
      setNormalizedPhone(result.phone);
      setSignupTemporaryPassword(result.temporaryPassword);
      setCode("");
      setSignupPhoneVerified(false);
      setSignupPhoneNotice("");
      setSignupOtpStatus("idle");
      setSignupOtpError("");
      setOtpSeconds(300);
      setCooldown(60);
      setSignupOtpRequested(true);
      onRecoveryStateChange(true);
      Animated.timing(signupReveal, {
        toValue: 1,
        duration: 240,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      const message = serverErrorMessage(error);
      if (/already|registered|exists|duplicate|가입된|존재/i.test(message)) {
        setSignupPhoneNotice("이미 가입된 전화번호입니다.");
        setSignupOtpRequested(false);
        setOtpSeconds(0);
        setCooldown(0);
        onRecoveryStateChange(false);
        signupReveal.setValue(0);
      } else {
        setSignupPhoneNotice(
          message === "알 수 없는 오류가 발생했습니다."
            ? "인증번호 전송에 실패했습니다. 잠시 후 다시 시도해주세요."
            : message,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const requestRecovery = async () => {
    if (!validPhone || cooldown > 0) return;
    setLoading(true);
    try {
      setNormalizedPhone(await requestPasswordRecoveryOtp(phone));
      onRecoveryStateChange(true);
      setStep("otp");
      setOtpSeconds(300);
      setCooldown(60);
    } catch (error) {
      Alert.alert("인증번호 전송 실패", serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0 || loading) return;
    setCode("");
    setSignupOtpStatus("idle");
    setSignupOtpError("");
    setSignupPhoneVerified(false);
    setSignupPhoneNotice("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const targetPhone =
          normalizedPhone || normalizeKoreanPhoneNumber(phone);
        const result = await requestSignUpPhoneOtp(
          targetPhone,
          signupTemporaryPassword,
        );
        setNormalizedPhone(result.phone);
        setSignupTemporaryPassword(result.temporaryPassword);
      } else await requestPasswordRecoveryOtp(phone);
      setOtpSeconds(300);
      setCooldown(60);
    } catch {
      Alert.alert("재전송 실패", "잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const verifySignupCode = async () => {
    if (code.length !== 6 || otpExpired || signupOtpStatus === "verifying")
      return;
    setSignupOtpStatus("verifying");
    setSignupOtpError("");
    try {
      const verifiedSession = await verifyPhoneOtp(normalizedPhone, code);
      if (!verifiedSession) throw new Error("인증 세션을 생성하지 못했습니다.");
      setSignupPhoneVerified(true);
      setSignupOtpStatus("verified");
      setOtpSeconds(0);
    } catch (error) {
      const message = serverErrorMessage(error);
      console.warn("Signup OTP verification failed", {
        message,
        secondsRemaining: otpSeconds,
      });
      setSignupOtpStatus("error");
      setSignupOtpError(
        otpSeconds <= 0
          ? "인증번호가 만료되었습니다. 다시 요청해주세요."
          : "인증번호가 일치하지 않습니다. 가장 최근에 받은 번호를 확인해주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyRecoveryCode = async () => {
    if (code.length !== 6 || otpSeconds === 0) return;
    setLoading(true);
    try {
      await verifyPhoneOtp(normalizedPhone, code);
      setStep("newPassword");
    } catch {
      Alert.alert("본인인증 실패", "인증번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const completeSignup = async () => {
    if (
      !signupPhoneVerified ||
      !validPassword ||
      !passwordsMatch ||
      !privacyAccepted ||
      !ageConfirmed
    )
      return;
    setLoading(true);
    try {
      await acceptSignupCompliance();
      await updateCurrentUserPassword(password);
      await signOut();
      resetFlow("login");
      Alert.alert(
        "회원가입 완료",
        "설정한 전화번호와 비밀번호로 로그인해주세요.",
      );
    } catch (error) {
      Alert.alert("가입 실패", serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!validPassword || !passwordsMatch) return;
    setLoading(true);
    try {
      await updateCurrentUserPassword(password);
      await signOut();
      onRecoveryStateChange(false);
      Alert.alert("변경 완료", "새 비밀번호로 로그인해주세요.");
    } catch (error) {
      Alert.alert("비밀번호 변경 실패", serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (mode === "recovery" && step === "otp") {
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark" />
        <AuthHeader title="비밀번호 찾기" onBack={() => resetFlow("login")} />
        <View style={s.authCard}>
          <Text style={s.authTitle}>인증번호 입력</Text>
          <Text style={s.authBody}>
            문자로 받은 6자리 번호를 5분 안에 입력해주세요.
          </Text>
          <View style={s.authPinLine}>
            <TextInput
              autoFocus
              value={code}
              onChangeText={(value) =>
                setCode(value.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              style={[s.authInput, s.authPinInput]}
            />
            <Text style={s.authTimer}>{timerText}</Text>
          </View>
          <Pressable
            disabled={loading || code.length !== 6 || otpSeconds === 0}
            onPress={verifyRecoveryCode}
            style={[
              s.primary,
              (loading || code.length !== 6 || otpSeconds === 0) && s.disabled,
            ]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading ? "확인 중..." : "인증 완료"}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            disabled={cooldown > 0 || loading}
            onPress={resendCode}
            style={s.authBack}
          >
            <Text style={s.authBackText}>
              {cooldown > 0 ? `${cooldown}초 후 재전송` : "인증번호 다시 받기"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setStep("form")} style={s.authBack}>
            <Text style={s.authBackText}>전화번호 다시 입력</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === "recovery" && step === "newPassword") {
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark" />
        <AuthHeader title="비밀번호 찾기" onBack={() => setStep("otp")} />
        <View style={s.authCard}>
          <Text style={s.authTitle}>새 비밀번호 설정</Text>
          <Text style={s.authBody}>8자 이상의 새 비밀번호를 입력해주세요.</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="새 비밀번호"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          <TextInput
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="새 비밀번호 확인"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          <Pressable
            disabled={loading || !validPassword || !passwordsMatch}
            onPress={changePassword}
            style={[
              s.primary,
              (loading || !validPassword || !passwordsMatch) && s.disabled,
            ]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading ? "변경 중..." : "비밀번호 변경"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === "signup") {
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark" />
        <AuthHeader title="회원가입" onBack={exitSignup} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.authScroll}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.authCard}
          >
            <Text style={s.authTitle}>전화번호로 가입</Text>
            <Text style={s.authBody}>
              전화번호를 인증한 뒤 비밀번호를 설정해주세요.
            </Text>
            {!signupPhoneVerified && (
              <View style={s.signupConsentGroup}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: privacyAccepted }}
                  onPress={() => setPrivacyAccepted((value) => !value)}
                  style={s.signupConsentRow}
                >
                  <View
                    style={[
                      s.signupConsentBox,
                      privacyAccepted && s.signupConsentBoxChecked,
                    ]}
                  >
                    {privacyAccepted && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={s.signupConsentText}>
                    [필수] 이용약관, 개인정보 수집·이용 및 커뮤니티 운영정책에 동의합니다.
                  </Text>
                </Pressable>
                <Text style={s.signupConsentNote}>
                  유해 콘텐츠와 악성 이용자는 허용하지 않으며, 신고 접수 시 운영자가 24시간 이내 검토합니다.
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                  style={s.signupPolicyLink}
                >
                  <Text style={s.signupPolicyLinkText}>
                    개인정보 처리방침 및 커뮤니티 운영 기준 보기
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ageConfirmed }}
                  onPress={() => setAgeConfirmed((value) => !value)}
                  style={s.signupConsentRow}
                >
                  <View
                    style={[
                      s.signupConsentBox,
                      ageConfirmed && s.signupConsentBoxChecked,
                    ]}
                  >
                    {ageConfirmed && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={s.signupConsentText}>
                    [필수] 만 14세 이상입니다.
                  </Text>
                </Pressable>
              </View>
            )}
            <View style={s.authPhoneRow}>
              <TextInput
                editable={!signupOtpRequested && !signupPhoneVerified}
                value={phone}
                onChangeText={changePhone}
                keyboardType="phone-pad"
                placeholder="010-0000-0000"
                placeholderTextColor={colors.textMuted}
                style={[
                  s.authInput,
                  s.authPhoneInput,
                  (signupOtpRequested || signupPhoneVerified) &&
                    s.authInputVerified,
                ]}
              />
              <Pressable
                disabled={
                  loading ||
                  !validPhone ||
                  !privacyAccepted ||
                  !ageConfirmed ||
                  signupPhoneVerified ||
                  (signupOtpRequested && cooldown > 0)
                }
                onPress={signupOtpRequested ? resendCode : requestSignupOtp}
                style={[
                  s.authVerifyButton,
                  (loading ||
                    !validPhone ||
                    !privacyAccepted ||
                    !ageConfirmed ||
                    signupPhoneVerified ||
                    (signupOtpRequested && cooldown > 0)) &&
                    s.authVerifyButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    s.authVerifyText,
                    (loading ||
                      !validPhone ||
                      !privacyAccepted ||
                      !ageConfirmed ||
                      signupPhoneVerified ||
                      (signupOtpRequested && cooldown > 0)) &&
                      s.authVerifyTextDisabled,
                  ]}
                >
                  {signupPhoneVerified
                    ? "인증완료"
                    : signupOtpRequested
                      ? cooldown > 0
                        ? `${cooldown}초`
                        : "재전송"
                      : "인증하기"}
                </Text>
              </Pressable>
            </View>
            {showPhoneFormatError && (
              <Text style={s.authInlineNotice}>
                전화번호 형식이 일치하지 않습니다.
              </Text>
            )}
            {signupPhoneNotice !== "" && (
              <Text style={s.authInlineNotice}>{signupPhoneNotice}</Text>
            )}
            {signupOtpRequested && (
              <Animated.View
                style={[
                  s.authSignupReveal,
                  {
                    opacity: signupReveal,
                    maxHeight: signupReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 340],
                    }),
                  },
                ]}
              >
                <View style={[s.authPinHeader, s.androidHeaderInset58]}>
                  <Text style={s.authPinLabel}>
                    {signupPhoneVerified
                      ? "전화번호 인증이 완료됐어요."
                      : "문자로 받은 6자리 인증번호"}
                  </Text>
                  {!signupPhoneVerified && (
                    <Text
                      style={[s.authTimer, otpExpired && s.authTimerExpired]}
                    >
                      {otpExpired ? "시간 만료" : timerText}
                    </Text>
                  )}
                </View>
                <View style={s.authPinLine}>
                  <TextInput
                    autoFocus={!signupPhoneVerified}
                    value={code}
                    onChangeText={(value) => {
                      setCode(value.replace(/\D/g, "").slice(0, 6));
                      setSignupOtpStatus("idle");
                      setSignupOtpError("");
                    }}
                    editable={
                      !signupPhoneVerified &&
                      !otpExpired &&
                      signupOtpStatus !== "verifying"
                    }
                    keyboardType="number-pad"
                    placeholder="000000"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      s.authInput,
                      s.authPinInput,
                      signupPhoneVerified && s.authInputVerified,
                    ]}
                  />
                  <Pressable
                    disabled={
                      code.length !== 6 ||
                      otpExpired ||
                      signupPhoneVerified ||
                      signupOtpStatus === "verifying"
                    }
                    onPress={verifySignupCode}
                    style={[
                      s.authPinButton,
                      (code.length !== 6 ||
                        otpExpired ||
                        signupPhoneVerified ||
                        signupOtpStatus === "verifying") &&
                        s.authVerifyButtonDisabled,
                    ]}
                  >
                    {signupOtpStatus === "verifying" ? (
                      <View style={s.authVerifying}>
                        <ActivityIndicator
                          size="small"
                          color={colors.mint700}
                        />
                        <Text style={s.authVerifyText}>확인 중</Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          s.authVerifyText,
                          (code.length !== 6 ||
                            otpExpired ||
                            signupPhoneVerified) &&
                            s.authVerifyTextDisabled,
                        ]}
                      >
                        {signupPhoneVerified ? "인증완료" : "확인"}
                      </Text>
                    )}
                  </Pressable>
                </View>
                {signupOtpError !== "" && (
                  <Text style={s.authOtpError}>{signupOtpError}</Text>
                )}
                {signupPhoneVerified && (
                  <>
                    <TextInput
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                      placeholder="비밀번호 8자 이상"
                      placeholderTextColor={colors.textMuted}
                      style={s.authInput}
                    />
                    <TextInput
                      secureTextEntry
                      value={passwordConfirm}
                      onChangeText={setPasswordConfirm}
                      placeholder="비밀번호 다시 입력"
                      placeholderTextColor={colors.textMuted}
                      style={s.authInput}
                    />
                    <Text
                      style={[
                        s.authPasswordHint,
                        passwordConfirm.length > 0 &&
                          !passwordsMatch &&
                          s.authPasswordMismatch,
                      ]}
                    >
                      {passwordConfirm.length === 0
                        ? "영문, 숫자 등을 조합해 8자 이상 입력해주세요."
                        : passwordsMatch
                          ? "비밀번호가 일치합니다."
                          : "비밀번호가 일치하지 않습니다."}
                    </Text>
                    <View style={s.signupConsentGroup}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: privacyAccepted }}
                        onPress={() => setPrivacyAccepted((value) => !value)}
                        style={s.signupConsentRow}
                      >
                        <View
                          style={[
                            s.signupConsentBox,
                            privacyAccepted && s.signupConsentBoxChecked,
                          ]}
                        >
                          {privacyAccepted && (
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          )}
                        </View>
                        <Text style={s.signupConsentText}>
                          [필수] 이용약관, 개인정보 수집·이용 및 커뮤니티 운영정책에 동의합니다.
                        </Text>
                      </Pressable>
                      <Text style={s.signupConsentNote}>
                        유해 콘텐츠와 악성 이용자는 허용하지 않으며, 신고 접수 시 운영자가 24시간 이내 검토합니다.
                      </Text>
                      <Pressable
                        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                        style={s.signupPolicyLink}
                      >
                        <Text style={s.signupPolicyLinkText}>
                          개인정보 처리방침 및 커뮤니티 운영 기준 보기
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: ageConfirmed }}
                        onPress={() => setAgeConfirmed((value) => !value)}
                        style={s.signupConsentRow}
                      >
                        <View
                          style={[
                            s.signupConsentBox,
                            ageConfirmed && s.signupConsentBoxChecked,
                          ]}
                        >
                          {ageConfirmed && (
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          )}
                        </View>
                        <Text style={s.signupConsentText}>
                          [필수] 만 14세 이상입니다.
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable
                      disabled={
                        loading ||
                        !validPassword ||
                        !passwordsMatch ||
                        !privacyAccepted ||
                        !ageConfirmed
                      }
                      onPress={completeSignup}
                      style={[
                        s.primary,
                        (loading ||
                          !validPassword ||
                          !passwordsMatch ||
                          !privacyAccepted ||
                          !ageConfirmed) &&
                        s.disabled,
                      ]}
                    >
                      <LinearGradient
                        colors={["#82B9C1", "#5DBB8C"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.primaryGradient}
                      >
                        <Text style={s.primaryText}>
                          {loading ? "가입 처리 중..." : "회원가입 완료하기"}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </>
                )}
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (false && mode === "signup") {
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.authScroll}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.authCard}
          >
            <MuteLogo />
            <Text style={s.authTitle}>전화번호로 가입</Text>
            <Text style={s.authBody}>
              전화번호 인증 후 비밀번호를 설정해주세요.
            </Text>
            <View style={s.authPhoneRow}>
              <TextInput
                editable={!signupPhoneVerified}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="010-0000-0000"
                placeholderTextColor={colors.textMuted}
                style={[
                  s.authInput,
                  s.authPhoneInput,
                  signupPhoneVerified && s.authInputVerified,
                ]}
              />
              <Pressable
                disabled={
                  loading ||
                  !validPhone ||
                  signupPhoneVerified ||
                  (signupOtpRequested && cooldown > 0)
                }
                onPress={signupOtpRequested ? resendCode : requestSignupOtp}
                style={[
                  s.authVerifyButton,
                  (loading ||
                    !validPhone ||
                    signupPhoneVerified ||
                    (signupOtpRequested && cooldown > 0)) &&
                    s.authVerifyButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    s.authVerifyText,
                    (loading ||
                      !validPhone ||
                      signupPhoneVerified ||
                      (signupOtpRequested && cooldown > 0)) &&
                      s.authVerifyTextDisabled,
                  ]}
                >
                  {signupPhoneVerified
                    ? "인증완료"
                    : signupOtpRequested
                      ? cooldown > 0
                        ? `${cooldown}초`
                        : "재전송"
                      : "인증하기"}
                </Text>
              </Pressable>
            </View>
            {signupOtpRequested && (
              <Animated.View
                style={[
                  s.authSignupReveal,
                  {
                    opacity: signupReveal,
                    maxHeight: signupReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 310],
                    }),
                  },
                ]}
              >
                <View style={[s.authPinHeader, s.androidHeaderInset58]}>
                  <Text style={s.authPinLabel}>
                    {signupPhoneVerified
                      ? "전화번호 인증이 완료됐어요."
                      : "문자로 받은 6자리 PIN"}
                  </Text>
                  {!signupPhoneVerified && (
                    <Text
                      style={[s.authTimer, otpExpired && s.authTimerExpired]}
                    >
                      {otpExpired ? "시간 만료" : timerText}
                    </Text>
                  )}
                </View>
                {!signupPhoneVerified && (
                  <View style={s.authPinLine}>
                    <TextInput
                      autoFocus
                      value={code}
                      onChangeText={(value) =>
                        setCode(value.replace(/\D/g, "").slice(0, 6))
                      }
                      editable={!otpExpired}
                      keyboardType="number-pad"
                      placeholder="000000"
                      placeholderTextColor={colors.textMuted}
                      style={[s.authInput, s.authPinInput]}
                    />
                    <Pressable
                      disabled={loading || code.length !== 6 || otpExpired}
                      onPress={verifySignupCode}
                      style={[
                        s.authPinButton,
                        (loading || code.length !== 6 || otpExpired) &&
                          s.authVerifyButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          s.authVerifyText,
                          (loading || code.length !== 6 || otpExpired) &&
                            s.authVerifyTextDisabled,
                        ]}
                      >
                        확인
                      </Text>
                    </Pressable>
                  </View>
                )}
                {signupPhoneVerified && (
                  <>
                    <TextInput
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                      placeholder="비밀번호 8자 이상"
                      placeholderTextColor={colors.textMuted}
                      style={s.authInput}
                    />
                    <TextInput
                      secureTextEntry
                      value={passwordConfirm}
                      onChangeText={setPasswordConfirm}
                      placeholder="비밀번호 다시 입력"
                      placeholderTextColor={colors.textMuted}
                      style={s.authInput}
                    />
                    <Text
                      style={[
                        s.authPasswordHint,
                        passwordConfirm.length > 0 &&
                          !passwordsMatch &&
                          s.authPasswordMismatch,
                      ]}
                    >
                      {passwordConfirm.length === 0
                        ? "영문, 숫자 등을 조합해 8자 이상 입력해주세요."
                        : passwordsMatch
                          ? "비밀번호가 일치합니다."
                          : "비밀번호가 일치하지 않습니다."}
                    </Text>
                    <Pressable
                      disabled={loading || !validPassword || !passwordsMatch}
                      onPress={completeSignup}
                      style={[
                        s.primary,
                        (loading || !validPassword || !passwordsMatch) &&
                          s.disabled,
                      ]}
                    >
                      <LinearGradient
                        colors={["#82B9C1", "#5DBB8C"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.primaryGradient}
                      >
                        <Text style={s.primaryText}>
                          {loading ? "가입 중..." : "가입하기"}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </>
                )}
              </Animated.View>
            )}
            <Pressable onPress={() => resetFlow("login")} style={s.authBack}>
              <Text style={s.authBackText}>로그인으로 돌아가기</Text>
            </Pressable>
          </KeyboardAvoidingView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.authScreen}>
      <StatusBar style="dark" />
      <AuthHeader
        title={mode === "login" ? "로그인" : "비밀번호 찾기"}
        onBack={mode === "login" ? undefined : () => resetFlow("login")}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[s.authCard, mode === "login" && s.authLoginCard]}
      >
        {mode === "login" ? (
          <MuteLogo compact />
        ) : (
          <Text style={s.authTitle}>비밀번호 찾기</Text>
        )}
        {mode !== "login" && (
          <Text style={s.authBody}>문자 인증 후 새 비밀번호를 설정합니다.</Text>
        )}
        <TextInput
          autoCapitalize="none"
          value={phone}
          onChangeText={setPhone}
          keyboardType={mode === "login" ? "default" : "phone-pad"}
          placeholder="010-0000-0000"
          placeholderTextColor={colors.textMuted}
          style={s.authInput}
        />
        {mode === "login" && (
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호 8자 이상"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
        )}
        {mode === "login" && (
          <View style={s.signupConsentGroup}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: loginTermsAccepted }}
              onPress={() => setLoginTermsAccepted((value) => !value)}
              style={s.signupConsentRow}
            >
              <View
                style={[
                  s.signupConsentBox,
                  loginTermsAccepted && s.signupConsentBoxChecked,
                ]}
              >
                {loginTermsAccepted && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={s.signupConsentText}>
                [필수] 이용약관 및 커뮤니티 운영정책에 동의합니다.
              </Text>
            </Pressable>
            <Text style={s.signupConsentNote}>
              유해 콘텐츠와 악성 이용자는 허용하지 않으며, 신고 접수 시 운영자가 24시간 이내 검토합니다.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              style={s.signupPolicyLink}
            >
              <Text style={s.signupPolicyLinkText}>
                개인정보 처리방침 및 커뮤니티 운영 기준 보기
              </Text>
            </Pressable>
          </View>
        )}
        <Pressable
          disabled={
            loading ||
            (mode === "login" ? !validLoginIdentifier : !validPhone) ||
            (mode === "login" && !validPassword) ||
            (mode === "login" && !loginTermsAccepted)
          }
          onPress={mode === "login" ? login : requestRecovery}
          style={[
            s.primary,
            (loading ||
              (mode === "login" ? !validLoginIdentifier : !validPhone) ||
              (mode === "login" && !validPassword) ||
              (mode === "login" && !loginTermsAccepted)) &&
              s.disabled,
          ]}
        >
          <LinearGradient
            colors={["#82B9C1", "#5DBB8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.primaryGradient}
          >
            <Text style={s.primaryText}>
              {loading
                ? "처리 중..."
                : mode === "login"
                  ? "로그인"
                  : "인증번호 받기"}
            </Text>
          </LinearGradient>
        </Pressable>
        {mode === "login" ? (
          <View>
            <Pressable onPress={() => resetFlow("signup")} style={s.authBack}>
              <Text style={s.authBackText}>처음이신가요? 가입하기</Text>
            </Pressable>
            <Pressable onPress={() => resetFlow("recovery")} style={s.authBack}>
              <Text style={s.authBackText}>비밀번호를 잊으셨나요?</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => resetFlow("login")} style={s.authBack}>
            <Text style={s.authBackText}>로그인으로 돌아가기</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MainScreen({
  bottomTab,
  setBottomTab,
  category,
  setCategory,
  joinedIds,
  activeTopSpaces,
  now: parentNow,
  roomData,
  hiddenRoomIds,
  adultVerified,
  showAdultTab,
  canSeeAdultRooms,
  isSuperAdmin,
  points,
  attendanceAvailableAt,
  rewardedAdAvailable,
  rewardLoading,
  promotionTimestamps,
  unreadCounts,
  dataRefreshing = false,
  dataLoaded = true,
  currentUserId,
  onRefresh,
  onAttendance,
  onRewardedAd,
  topSpaceProgress,
  openRoom,
  openRoomDetail,
  onAdminReportRoom,
  onNotification,
  notificationDrawerSignal = 0,
  onRanking,
  onSearch,
  onSettings,
  onCreate,
  onPointBalanceChange,
}: {
  bottomTab: BottomTab;
  setBottomTab: (v: BottomTab) => void;
  category: MainTab;
  setCategory: (v: MainTab) => void;
  joinedIds: string[];
  activeTopSpaces: Room[];
  now: number;
  roomData: Room[];
  hiddenRoomIds: string[];
  adultVerified: boolean;
  showAdultTab: boolean;
  canSeeAdultRooms: boolean;
  promotionTimestamps: Record<string, number>;
  unreadCounts: Record<string, number>;
  dataRefreshing?: boolean;
  dataLoaded?: boolean;
  currentUserId?: string;
  onRefresh?: () => void;
  isSuperAdmin: boolean;
  onAdminReportRoom: (room: Room) => void;
  topSpaceProgress: (room: Room) => number;
  openRoom: (room: Room) => void;
  openRoomDetail: (room: Room) => void;
  onRanking: () => void;
  onSearch: () => void;
  onNotification: (notice: Notice) => void;
  notificationDrawerSignal?: number;
  onSettings: () => void;
  onCreate: () => void;
  onPointBalanceChange: (value: number) => void;
  points: number;
  attendanceAvailableAt: number;
  rewardedAdAvailable: boolean;
  rewardLoading: "attendance" | "rewarded_ad" | null;
  onAttendance: () => void;
  onRewardedAd: () => void;
}) {
  const adsDisabled = useAdFree();
  const [now, setNow] = useState(parentNow);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [toast, setToast] = useState("");
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);
  const [storyDetailOpen, setStoryDetailOpen] = useState(false);
  const [profileSubpageOpen, setProfileSubpageOpen] = useState(false);
  const [storySearchOpen, setStorySearchOpen] = useState(false);
  const [storyQuery, setStoryQuery] = useState("");
  const appTheme = useAppTheme();
  const primaryForeground = themeForeground(appTheme);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (notificationDrawerSignal > 0) setDrawerOpen(true);
  }, [notificationDrawerSignal]);
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;
    const client = supabase;
    let active = true;
    const reload = () =>
      listNotificationInbox()
        .then((items) => {
          if (active)
            setHasUnreadNotifications(items.some((item) => !item.readAt));
        })
        .catch(() => undefined);
    reload();
    const channel = client
      .channel("main-notification-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications" },
        reload,
      )
      .subscribe();
    return () => {
      active = false;
      client.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    listPinnedRoomIds()
      .then((ids) => {
        if (active) setPinnedRoomIds(ids);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const toggleRoomPin = async (room: Room) => {
    const pinned = !pinnedRoomIds.includes(room.id);
    try {
      if (isSupabaseConfigured && isUuid(room.id))
        await setRoomPinned(room.id, pinned);
      setPinnedRoomIds((ids) =>
        pinned ? [...ids, room.id] : ids.filter((id) => id !== room.id),
      );
    } catch (error) {
      Alert.alert("고정 설정 실패", serverErrorMessage(error));
    }
  };
  const leaveJoinedRoom = (room: Room, report = false) =>
    report
      ? Alert.alert(
          "신고 불가",
          "참여 중인 방은 신고할 수 없습니다. 방에서 나간 뒤 신고해 주세요.",
        )
      : Alert.alert(
      report ? "신고하고 나가기" : "방 나가기",
      report
        ? "정말 신고하시겠습니까?\n허위 신고 시 서비스 이용에 불이익을 받을 수 있습니다."
        : "이 방에서 나가시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: report ? "신고하고 나가기" : "나가기",
          style: "destructive",
          onPress: async () => {
            try {
              if (report)
                await submitReport({
                  targetType: "room",
                  targetId: room.id,
                  reason: "other",
                  detail: `신고 후 나가기: ${room.name}`,
                });
              await leaveRoom(room.id);
              setPinnedRoomIds((ids) => ids.filter((id) => id !== room.id));
              onRefresh?.();
            } catch (error) {
              Alert.alert(
                "방 나가기 실패",
                serverErrorMessage(error).includes(
                  "TRANSFER_OWNERSHIP_REQUIRED",
                )
                  ? "방장은 방장을 양도한 후 나갈 수 있습니다."
                  : serverErrorMessage(error),
              );
            }
          },
        },
      ],
    );
  const reportVisibleRoom = async (room: Room) => {
    const submitted = await confirmReportSubmission({
      targetType: "room",
      targetId: room.id,
      reason: "other",
      detail: room.name,
    });
    if (!submitted) return;
    Alert.alert("신고 접수 완료", "방 신고가 접수되었습니다.");
  };
  const filtered = useMemo(
    () =>
      roomData
        .filter((room) => {
          if (room.isAdult && !canSeeAdultRooms && !isSuperAdmin) return false;
          const tabMatch =
            bottomTab === "myRooms"
              ? joinedIds.includes(room.id) || room.isSample
              : category === "promotion"
                ? !room.isAdult &&
                  (Boolean(promotionTimestamps[room.id]) || room.isPromoted)
                : category === "member"
                  ? room.category === "member"
                  : category === "concept"
                    ? room.category === "concept"
                    : category === "region"
                      ? !!room.region
                      : !!room.isAdult;
          return tabMatch;
        })
        .sort((a, b) => {
          if (bottomTab === "myRooms") {
            const aPinned = pinnedRoomIds.includes(a.id);
            const bPinned = pinnedRoomIds.includes(b.id);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            return (roomActivityAt(b) ?? 0) - (roomActivityAt(a) ?? 0);
          }
          if (bottomTab === "discover" && category === "promotion") {
            const aPromotion = promotionTimestamps[a.id] ?? 0;
            const bPromotion = promotionTimestamps[b.id] ?? 0;
            if (aPromotion !== bPromotion) return bPromotion - aPromotion;
          }
          if (bottomTab === "discover")
            return (roomActivityAt(b) ?? 0) - (roomActivityAt(a) ?? 0);
          return 0;
        }),
    [
      adultVerified,
      bottomTab,
      category,
      isSuperAdmin,
      joinedIds,
      pinnedRoomIds,
      promotionTimestamps,
      roomData,
      showAdultTab,
    ],
  );
  const listMode = bottomTab === "discover" || bottomTab === "myRooms";
  const topRoom =
    bottomTab === "discover"
      ? activeTopSpaces.find((room) =>
          filtered.some((item) => item.id === room.id),
        )
      : undefined;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      {!storyDetailOpen && storySearchOpen && bottomTab === "stories" ? (
        <View style={[s.searchHeader, s.androidHeaderInset58]}>
          <IconButton
            name="chevron-back"
            color={colors.textSubtle}
            onPress={() => {
              setStorySearchOpen(false);
              setStoryQuery("");
            }}
          />
          <View style={s.searchPageBox}>
            <TextInput
              autoFocus
              value={storyQuery}
              onChangeText={setStoryQuery}
              placeholder="스토리 제목 검색"
              placeholderTextColor={colors.textMuted}
              style={s.searchInput}
            />
            {storyQuery.length > 0 && (
              <Pressable onPress={() => setStoryQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.gray300}
                />
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        !storyDetailOpen && !profileSubpageOpen && (
          <LinearGradient
            colors={["#82B9C1", "#5DBB8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.mainHeader, s.androidHeaderInset56]}
          >
            <View style={s.mainHeaderLogoWrap}>
              <MuteLogo symbolOnly variant="white" compact />
            </View>
            {bottomTab !== "profile" && (
              <View style={s.headerActions}>
                <IconButton
                  name="search-outline"
                  color={primaryForeground}
                  size={22}
                  onPress={
                    bottomTab === "stories"
                      ? () => setStorySearchOpen(true)
                      : onSearch
                  }
                />
                <Pressable
                  onPress={() => setDrawerOpen(true)}
                  style={s.headerIconButton}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color={primaryForeground}
                  />
                  {hasUnreadNotifications && <NotificationBadge dot />}
                </Pressable>
              </View>
            )}
          </LinearGradient>
        )
      )}
      {bottomTab === "discover" && (
        <View style={s.tabs}>
          {[
            ...BASE_CATEGORIES,
            ...(showAdultTab ? [{ key: "adult" as const, label: "성인" }] : []),
          ].map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.key === "adult" && !showAdultTab && !isSuperAdmin) {
                  setToast("iOS에서 지원되지 않는 기능입니다.");
                  setTimeout(() => setToast(""), 2200);
                  return;
                }
                if (item.key === "adult" && !adultVerified && !isSuperAdmin) {
                  setToast("성인 인증 후 이용할 수 있는 탭입니다.");
                  setTimeout(() => setToast(""), 2200);
                  return;
                }
                setCategory(item.key);
              }}
              style={s.tab}
            >
              <Text
                style={[s.tabText, category === item.key && s.tabTextActive]}
              >
                {item.label}
              </Text>
              {category === item.key && <View style={s.tabIndicator} />}
            </Pressable>
          ))}
        </View>
      )}
      {listMode && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={dataRefreshing}
              onRefresh={onRefresh}
              tintColor={activeAppTheme.accent}
            />
          }
          ListHeaderComponent={
            bottomTab === "myRooms" ? (
              <View style={s.listHeader}>
                <Text style={s.listTitle}>내 채팅</Text>
              </View>
            ) : category === "promotion" ? null : (
              <View>
                <>
                  <SectionLabel
                    title="Top"
                    action="랭킹"
                    onAction={onRanking}
                    compact
                  />
                  {topRoom ? (
                    <RoomRow
                      room={topRoom}
                      joined={joinedIds.includes(topRoom.id)}
                      blurAdult={category === "adult"}
                      onPress={() => openRoom(topRoom)}
                      onDescriptionPress={() => openRoomDetail(topRoom)}
                      topSpaceProgress={topSpaceProgress(topRoom)}
                      activityLabel={
                        roomActivityAt(topRoom)
                          ? formatRoomActivity(
                              roomActivityAt(topRoom)!,
                              now,
                              false,
                            )
                          : ""
                      }
                      topHighlight
                    />
                  ) : null}
                </>
                <SectionLabel title="Hot" compact />
              </View>
            )
          }
          renderItem={({ item }) =>
            bottomTab === "discover" && item.id === topRoom?.id ? null : (
              <RoomRow
                room={item}
                joined={joinedIds.includes(item.id) || Boolean(item.isSample)}
                blurAdult={
                  bottomTab === "discover" &&
                  (category === "adult" ||
                    (category === "promotion" && Boolean(item.isAdult)))
                }
                pinned={bottomTab === "myRooms" && pinnedRoomIds.includes(item.id)}
                onLongPress={() =>
                  Alert.alert(item.name, undefined, [
                    ...(bottomTab === "myRooms"
                      ? [
                          {
                            text: pinnedRoomIds.includes(item.id)
                              ? "상단 고정 해제"
                              : "상단에 고정",
                            onPress: () => toggleRoomPin(item),
                          },
                          {
                            text: "나가기",
                            style: "destructive" as const,
                            onPress: () => leaveJoinedRoom(item),
                          },
                        ]
                      : []),
                    ...(isSuperAdmin && bottomTab !== "myRooms"
                      ? [
                          {
                            text: "서버로 신고",
                            style: "destructive" as const,
                            onPress: () => onAdminReportRoom(item),
                          },
                        ]
                      : []),
                    ...(bottomTab !== "myRooms"
                      ? [
                          {
                            text: "신고하기",
                            style: "destructive" as const,
                            onPress: () => reportVisibleRoom(item),
                          },
                        ]
                      : []),
                    { text: "취소", style: "cancel" },
                  ])
                }
                onPress={() => openRoom(item)}
                onDescriptionPress={
                  bottomTab === "discover"
                    ? () => openRoomDetail(item)
                    : undefined
                }
                unreadCount={
                  bottomTab === "myRooms" ? (unreadCounts[item.id] ?? 0) : 0
                }
                showLastMessage={bottomTab === "myRooms"}
                activityLabel={
                  bottomTab === "discover" && category === "promotion"
                    ? ""
                    : roomActivityAt(item)
                      ? formatRoomActivity(
                          roomActivityAt(item)!,
                          now,
                          bottomTab === "myRooms",
                        )
                      : ""
                }
              />
            )
          }
          ListEmptyComponent={
            !dataLoaded ? (
              <View style={s.centerState}>
                <ActivityIndicator color={colors.mint700} />
              </View>
            ) : dataRefreshing ? (
              <View style={s.centerState}>
                <ActivityIndicator color={colors.mint700} />
              </View>
            ) : (
              <Empty
                title="표시할 방이 없어요"
                body="검색어나 카테고리를 변경해 보세요."
              />
            )
          }
        />
      )}
      {bottomTab === "profile" && (
        <Profile
          points={points}
          currentUserId={currentUserId}
          now={now}
          attendanceAvailableAt={attendanceAvailableAt}
          rewardedAdAvailable={rewardedAdAvailable}
          rewardLoading={rewardLoading}
          onAttendance={onAttendance}
          onRewardedAd={onRewardedAd}
          onRanking={onRanking}
          onSettings={onSettings}
          onPointBalanceChange={onPointBalanceChange}
          onSubpageChange={setProfileSubpageOpen}
        />
      )}
      {bottomTab === "stories" && (
        <PublicStoryFeed
          roomData={roomData}
          joinedIds={joinedIds}
          hiddenRoomIds={hiddenRoomIds}
          openRoom={openRoom}
          query={storyQuery}
          loading={!dataLoaded}
          onDetailChange={setStoryDetailOpen}
        />
      )}
      {(bottomTab === "discover" || bottomTab === "myRooms") && (
        <Pressable onPress={onCreate} style={[s.fab, adsDisabled && s.fabNoAd]}>
          <LinearGradient
            colors={["#82B9C1", "#5DBB8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.fabGradient}
          >
            <Ionicons name="add" size={27} color={primaryForeground} />
          </LinearGradient>
        </Pressable>
      )}
      {!storyDetailOpen && !profileSubpageOpen && (
        <View style={[s.mainBottomDock, adsDisabled && s.mainBottomDockNoAd]}>
          {!adsDisabled && (
            <View
              pointerEvents="box-none"
              style={[
                s.mainBannerDock,
                appTheme.id === "dark" && s.mainBannerDockDark,
              ]}
            >
              <InlineBannerAd
                placement="main"
                dark={appTheme.id === "dark"}
                reserveSpace
              />
            </View>
          )}
          <BottomNav selected={bottomTab} onSelect={setBottomTab} docked />
        </View>
      )}
      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUnreadChange={setHasUnreadNotifications}
        onNavigate={onNotification}
      />
      {toast ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SearchScreen({
  roomData,
  query,
  setQuery,
  joinedIds,
  canSeeAdultRooms,
  isSuperAdmin,
  onBack,
  openRoom,
}: {
  roomData: Room[];
  query: string;
  setQuery: (value: string) => void;
  joinedIds: string[];
  canSeeAdultRooms: boolean;
  isSuperAdmin: boolean;
  onBack: () => void;
  openRoom: (room: Room) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      normalized
        ? roomData.filter(
            (room) =>
              (!room.isAdult || canSeeAdultRooms || isSuperAdmin) &&
              [room.name, room.description, ...room.tags, room.region ?? ""]
                .join(" ")
                .toLowerCase()
                .includes(normalized),
          )
        : [],
    [isSuperAdmin, normalized, roomData],
  );
  return (
    <SafeAreaView style={s.safe}>
      <EdgeBackLayer onBack={onBack} />
      <StatusBar style="dark" />
      <View style={[s.searchHeader, s.androidHeaderInset58]}>
        <IconButton
          name="chevron-back"
          color={colors.textSubtle}
          onPress={onBack}
        />
        <View style={s.searchPageBox}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="방 이름, 설명, 해시태그 검색"
            placeholderTextColor={colors.textMuted}
            style={[
              s.searchInput,
              Platform.OS === "web" && ({ outlineStyle: "none" } as object),
            ]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={19} color={colors.gray300} />
            </Pressable>
          )}
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.searchResults}
        ListHeaderComponent={
          normalized ? (
            <View style={s.searchResultHead}>
              <Text
                style={s.searchResultTitle}
              >{`‘${query.trim()}’ 관련 방`}</Text>
              <Text style={s.searchResultCount}>{results.length}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RoomRow
            room={item}
            joined={joinedIds.includes(item.id)}
            onPress={() => openRoom(item)}
          />
        )}
        ListEmptyComponent={
          normalized ? (
            <Empty
              title="관련 방을 찾지 못했어요"
              body="다른 이름이나 해시태그로 검색해 보세요."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function RankingScreen({
  roomData,
  onBack,
  openRoom,
  countFor,
}: {
  roomData: Room[];
  onBack: () => void;
  openRoom: (room: Room) => void;
  countFor: (room: Room) => number;
}) {
  const appTheme = useAppTheme();
  const dark = appTheme.id === "dark";
  const ranked = [...roomData].sort((a, b) => countFor(b) - countFor(a));
  return (
    <SafeAreaView style={[s.safe, s.whitePage, dark && s.rankingPageDark]}>
      <StatusBar style="light" />
      <TopBar title="탑스페이스 랭킹" onBack={onBack} />
      <FlatList
        style={[s.whitePage, dark && s.rankingPageDark]}
        data={ranked}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.rankingList}
        ListHeaderComponent={
          <View style={[s.rankingIntro, s.whitePage, dark && s.rankingPageDark]}>
            <Text style={s.rankingIntroTitle}>전체 방 랭킹</Text>
            <Text style={s.rankingIntroText}>
              멤버들이 탑스페이스를 올린 누적 횟수 기준이에요.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable onPress={() => openRoom(item)} style={s.rankingRow}>
            <Text style={[s.rankNumber, index < 3 && s.rankNumberTop]}>
              {index + 1}
            </Text>
            <RoomImage room={item} size={54} />
            <View style={s.rankingBody}>
              <Text style={s.rankingName}>{item.name}</Text>
              <Text numberOfLines={1} style={s.rankingDesc}>
                {item.description}
              </Text>
            </View>
            <View style={s.rankingCount}>
              <Ionicons name="rocket" size={14} color={colors.mint700} />
              <Text style={s.rankingCountText}>{countFor(item)}회</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function RoomRow({
  room,
  joined,
  blurAdult = false,
  pinned = false,
  onLongPress,
  onPress,
  onDescriptionPress,
  unreadCount = 0,
  topSpaceProgress,
  activityLabel = "",
  topHighlight = false,
  showLastMessage = false,
}: {
  room: Room;
  joined: boolean;
  blurAdult?: boolean;
  pinned?: boolean;
  onLongPress?: () => void;
  onPress: () => void;
  onDescriptionPress?: () => void;
  unreadCount?: number;
  topSpaceProgress?: number;
  activityLabel?: string;
  topHighlight?: boolean;
  showLastMessage?: boolean;
}) {
  const isPrivateRoom = Boolean(room.isPrivate || room.tags.includes("비밀방"));
  const primaryTag = room.region ?? room.tags.find(Boolean);
  return (
    <Pressable
      accessibilityLabel={onLongPress ? `${room.name} 채팅방 메뉴` : undefined}
      onLongPress={onLongPress}
      delayLongPress={450}
      onPress={onPress}
      style={({ pressed }) => [
        s.roomRow,
        topHighlight && s.roomRowTop,
        pressed && s.pressed,
      ]}
    >
      <RoomImage room={room} size={68} blurAdult={blurAdult} />
      <View style={s.roomInfo}>
        <View style={s.nameLine}>
          {isPrivateRoom && (
            <Ionicons
              name="lock-closed"
              size={13}
              color={colors.mint700}
              style={s.privateRoomLock}
            />
          )}
          <Text numberOfLines={1} style={s.roomName}>
            {room.name}
          </Text>
          {pinned && (
            <Image
              source={PIN_ICON_SOURCE}
              style={s.pinnedIconImage}
              tintColor={colors.textMuted}
            />
          )}
        </View>
        <Text
          numberOfLines={1}
          onPress={
            onDescriptionPress
              ? (event) => {
                  event.stopPropagation();
                  onDescriptionPress();
                }
              : undefined
          }
          suppressHighlighting
          style={s.roomDesc}
        >
          {showLastMessage && room.lastMessage
            ? room.lastMessage
            : room.description}
        </Text>
        <View style={s.metaLine}>
          <View style={s.metaGroup}>
            <Ionicons name="people" size={12} color={colors.textMuted} />
            <Text style={s.meta}>
              {room.memberCount}/{room.maxMembers}
            </Text>
            {primaryTag ? <Text style={s.meta}>{primaryTag}</Text> : null}
          </View>
          {topSpaceProgress === undefined ? (
            activityLabel ? (
              <Text style={s.meta}>{activityLabel}</Text>
            ) : null
          ) : (
            <View style={s.topSpaceGaugeTrack}>
              <LinearGradient
                colors={["#82B9C1", "#5DBB8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  s.topSpaceGaugeFill,
                  { width: `${topSpaceProgress * 100}%` },
                ]}
              />
            </View>
          )}
        </View>
      </View>
      {joined && unreadCount > 0 ? (
        <NotificationBadge inline count={unreadCount} />
      ) : null}
    </Pressable>
  );
}

function RoomDetail({
  room,
  joined,
  currentUserId: providedCurrentUserId,
  adminReadOnly,
  isSuperAdmin,
  onAdminReportUser,
  pending,
  onBack,
  onApply,
  onEnterChat,
  onEdit,
  enterLabel = "채팅방 바로가기",
}: {
  room: Room;
  joined: boolean;
  currentUserId?: string;
  adminReadOnly: boolean;
  isSuperAdmin: boolean;
  onAdminReportUser: (id: string, label: string) => void;
  pending: boolean;
  onBack: () => void;
  onApply: () => void;
  onEnterChat: () => void;
  onEdit?: () => void;
  enterLabel?: string;
}) {
  const [tab, setTab] = useState<"profile" | "story">("profile");
  const [profile, setProfile] = useState<RoomMember | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinChecking, setPinChecking] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>(() =>
    isLocalDemoRoomId(room.id) ? membersForRoom(room) : [],
  );
  const [storyOverlayId, setStoryOverlayId] = useState<string | null>(null);
  const [storyWriteOpen, setStoryWriteOpen] = useState(false);
  const [storyPanelKey, setStoryPanelKey] = useState(0);
  const appTheme = useAppTheme();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    providedCurrentUserId,
  );
  const isPrivateRoom = Boolean(room.isPrivate || room.tags.includes("비밀방"));

  useEffect(() => {
    if (providedCurrentUserId) {
      setCurrentUserId(providedCurrentUserId);
      return;
    }
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id))
      .catch(() => undefined);
  }, [providedCurrentUserId]);
  useEffect(() => {
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      setMembers(isLocalDemoRoomId(room.id) ? membersForRoom(room) : []);
      return;
    }
    listRoomMembersVisible(room.id)
      .then((serverMembers) =>
        setMembers(mapRoomMembers(serverMembers, currentUserId)),
      )
      .catch(() => undefined);
  }, [currentUserId, room]);
  const viewerRole = useMemo<"owner" | "cohost" | "member" | null>(() => {
    const me = members.find((member) => member.mine);
    if (!me) return null;
    if (me.owner) return "owner";
    if (me.coHost) return "cohost";
    return "member";
  }, [members]);

  if (profile)
    return (
      <MemberProfile
        member={profile}
        room={room}
        viewerRole={adminReadOnly || isSuperAdmin ? null : viewerRole}
        onReport={
          !joined
            ? async () => {
                if (!profile.userId || !isUuid(profile.userId)) {
                  Alert.alert(
                    "신고 불가",
                    "서버에 등록된 멤버만 신고할 수 있습니다.",
                  );
                  return;
                }
                const submitted = await confirmReportSubmission({
                  targetType: "user",
                  targetId: profile.userId,
                  reason: "other",
                  detail: `멤버 신고: ${profile.name}`,
                });
                if (submitted)
                  Alert.alert("신고 접수 완료", "멤버 신고가 접수되었습니다.");
              }
            : undefined
        }
        onBack={() => setProfile(null)}
      />
    );
  if (storyOverlayId)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <StoryPanel
          key={`overlay-${storyOverlayId}`}
          room={room}
          joined={joined}
          isSuperAdmin={isSuperAdmin}
          isStaff={members.some(
            (member) => member.mine && (member.owner || member.coHost),
          )}
          showChatButton={false}
          showInternalHeader
          title="스토리"
          initialSelectedId={storyOverlayId}
          onClose={() => {
            setStoryOverlayId(null);
            setStoryPanelKey((value) => value + 1);
          }}
          onEnterChat={() => {
            setStoryOverlayId(null);
            setStoryPanelKey((value) => value + 1);
          }}
        />
      </SafeAreaView>
    );
  if (storyWriteOpen)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <StoryPanel
          key="room-story-write"
          room={room}
          joined={joined}
          isSuperAdmin={isSuperAdmin}
          isStaff={members.some(
            (member) => member.mine && (member.owner || member.coHost),
          )}
          showChatButton={false}
          showInternalHeader
          title="스토리 작성"
          initialWrite
          onClose={() => {
            setStoryWriteOpen(false);
            setTab("story");
          }}
          onEnterChat={() => {
            setStoryWriteOpen(false);
            setTab("story");
          }}
          onStorySaved={() => {
            setStoryWriteOpen(false);
            setTab("story");
            setStoryPanelKey((value) => value + 1);
          }}
        />
      </SafeAreaView>
    );

  const onShare = async () => {
    setMenuOpen(false);
    try {
      await Share.share({
        title: room.name,
        message: `[뮤트] ${room.name}\n초대 링크는 앱 출시 후 연결됩니다.`,
      });
    } catch (error) {
      if (String(error).includes("User did not share")) return;
      Alert.alert("공유 실패", serverErrorMessage(error));
    }
  };
  const onReport = async () => {
    setMenuOpen(false);
    if (joined) {
      Alert.alert(
        "신고 불가",
        "참여 중인 방은 신고할 수 없습니다. 방에서 나간 뒤 신고해 주세요.",
      );
      return;
    }
    if (!isUuid(room.id)) {
      Alert.alert("신고 불가", "서버에 생성된 방만 신고할 수 있습니다.");
      return;
    }
    try {
      const submitted = await confirmReportSubmission({
        targetType: "room",
        targetId: room.id,
        reason: "other",
        detail: `방 신고: ${room.name}`,
      });
      if (!submitted) return;
      Alert.alert("신고 접수 완료", "방 신고가 접수되었습니다.");
    } catch (error) {
      Alert.alert("신고 실패", serverErrorMessage(error));
    }
  };
  const openApply = () => {
    if (isPrivateRoom && !joined && !adminReadOnly && !isSuperAdmin) {
      setPinOpen(true);
      return;
    }
    onApply();
  };
  const verifyJoinPin = async () => {
    if (pin.length !== 6 || pinChecking) return;
    setPinChecking(true);
    setPinError("");
    try {
      if (isSupabaseConfigured && isUuid(room.id)) {
        const verified = await verifyRoomPin(room.id, pin);
        if (!verified) {
          setPinError("비밀방 PIN이 일치하지 않습니다.");
          setPinChecking(false);
          return;
        }
      }
      setPin("");
      setPinOpen(false);
      setPinChecking(false);
      onApply();
    } catch (error) {
      setPinError(serverErrorMessage(error));
      setPinChecking(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <EdgeBackLayer onBack={onBack} />
      <StatusBar style="light" />
      <TopBar
        title={room.name}
        inlineCount={room.memberCount}
        onBack={onBack}
        trailing="ellipsis-horizontal"
        onTrailingPress={() => setMenuOpen((value) => !value)}
      />
      {menuOpen && (
        <View style={s.sheetLayer}>
          <Pressable
            accessibilityLabel="방 소개 메뉴 닫기"
            onPress={() => setMenuOpen(false)}
            style={s.sheetDim}
          />
          <View style={s.roomDetailMenu}>
            <View style={s.profileActionList}>
              {(viewerRole === "owner" || viewerRole === "cohost") && onEdit ? (
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  style={s.profileActionRow}
                >
                  <Text style={s.profileActionText}>방 편집하기</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onShare} style={s.profileActionRow}>
                <Text style={s.profileActionText}>링크 공유하기</Text>
              </Pressable>
              <Pressable onPress={onReport} style={s.profileActionRow}>
                <Text style={s.profileActionText}>신고하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {pinOpen && (
        <View style={s.sheetLayer}>
          <Pressable
            accessibilityLabel="비밀방 PIN 닫기"
            onPress={() => {
              setPinOpen(false);
              setPin("");
              setPinError("");
            }}
            style={s.sheetDim}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <View style={s.privatePinSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.privatePinTitle}>비밀방 PIN 입력</Text>
              <Text style={s.privatePinBody}>
                가입 신청 전에 비밀방 PIN 6자리를 먼저 확인해주세요.
              </Text>
              <TextInput
                autoFocus
                value={pin}
                onChangeText={(value) => {
                  setPin(value.replace(/\D/g, "").slice(0, 6));
                  setPinError("");
                }}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="숫자 6자리"
                placeholderTextColor={colors.textMuted}
                style={[s.input, s.privatePinInput]}
              />
              {pinError !== "" && <Text style={s.pinError}>{pinError}</Text>}
              <Pressable
                disabled={pin.length !== 6 || pinChecking}
                onPress={verifyJoinPin}
                style={[
                  s.primary,
                  s.privatePinButton,
                  (pin.length !== 6 || pinChecking) && s.disabled,
                ]}
              >
                <LinearGradient
                  colors={["#82B9C1", "#5DBB8C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryGradient}
                >
                  <Text style={s.primaryText}>
                    {pinChecking ? "확인 중..." : "확인"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
      <View style={s.profileTabs}>
        <Pressable onPress={() => setTab("profile")} style={s.profileTab}>
          <Text
            style={[s.profileTabText, tab === "profile" && s.profileTabActive]}
          >
            프로필
          </Text>
          {tab === "profile" && <View style={s.profileTabLine} />}
        </Pressable>
        <Pressable onPress={() => setTab("story")} style={s.profileTab}>
          <Text
            style={[s.profileTabText, tab === "story" && s.profileTabActive]}
          >
            스토리
          </Text>
          {tab === "story" && <View style={s.profileTabLine} />}
        </Pressable>
      </View>
      {tab === "profile" ? (
        <ScrollView contentContainerStyle={s.spaceProfile}>
          <DefaultRoomCover room={room} />
          <View style={s.coverMeta}>
            <RNText style={s.coverMetaText}>
              {formatCompactDate(room.createdAt)}
            </RNText>
            <RNText style={s.coverMetaText}>
              {room.memberCount}/{room.maxMembers}명
            </RNText>
          </View>
          <View style={s.spaceIntro}>
            <Text style={s.spaceTitle}>{room.name}</Text>
            {room.region && (
              <View style={s.detailMetaRow}>
                <View style={s.detailMetaItem}>
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={colors.mint700}
                  />
                  <Text style={s.detailMetaText}>{room.region}</Text>
                </View>
              </View>
            )}
            <LinkedText style={s.spaceBody}>{room.description}</LinkedText>
          </View>
          <View style={s.memberSectionHead}>
            <Text style={s.memberSectionTitle}>멤버</Text>
          </View>
          <View style={s.detailMemberGrid}>
            {members.map((member) => (
              <Pressable
                key={member.userId ?? member.name}
                onPress={() => setProfile(member)}
                onLongPress={
                  isSuperAdmin && member.userId
                    ? () => onAdminReportUser(member.userId!, member.name)
                    : undefined
                }
                style={s.detailMemberItem}
              >
                <View style={s.detailMemberAvatar}>
                  <Avatar uri={member.avatarUri} size={64} />
                  {member.owner && (
                    <RNView style={s.crown}>
                      <RNIonicons name="trophy" size={13} color="#FFF" />
                    </RNView>
                  )}
                </View>
                <View style={s.detailMemberNameLine}>
                  <Text style={s.gridName}>{member.name}</Text>
                </View>
                {member.owner ? (
                  <Badge text="방장" pink />
                ) : member.coHost ? (
                  <Badge text="부방장" />
                ) : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <StoryPanel
          key={`room-story-${storyPanelKey}`}
          room={room}
          joined={joined}
          isSuperAdmin={isSuperAdmin}
          isStaff={members.some(
            (member) => member.mine && (member.owner || member.coHost),
          )}
          showChatButton={false}
          showInternalHeader={false}
          onEnterChat={onEnterChat}
          onOpenDetail={(story) => setStoryOverlayId(story.id)}
          onWriteRequest={() => setStoryWriteOpen(true)}
        />
      )}
      {tab === "profile" && (
        <View style={[s.detailSticky, appTheme.id === "dark" && s.detailStickyDark]}>
          {joined || adminReadOnly || isSuperAdmin || room.isSample ? (
            <Pressable onPress={onEnterChat} style={s.detailJoinButton}>
              <LinearGradient
                colors={["#82B9C1", "#5DBB8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.detailJoinGradient}
              >
                <Text style={s.primaryText}>{enterLabel}</Text>
              </LinearGradient>
            </Pressable>
          ) : pending ? (
            <View style={s.pendingButton}>
              <Ionicons
                name="time-outline"
                size={17}
                color={colors.textMuted}
              />
              <Text style={s.pendingText}>가입 승인 대기 중</Text>
            </View>
          ) : (
            <Pressable onPress={openApply} style={s.detailJoinButton}>
              <LinearGradient
                colors={["#82B9C1", "#5DBB8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.detailJoinGradient}
              >
                <Text style={s.primaryText}>가입 신청하기</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      )}
      {toast !== "" && (
        <View pointerEvents="none" style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function JoinApplication({
  room,
  onBack,
  onCompleted,
  onSubmit,
}: {
  room: Room;
  onBack: () => void;
  onCompleted: () => void;
  onSubmit: (
    name: string,
    intro: string,
    avatarUploadId?: string,
  ) => Promise<string>;
}) {
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const enabled = name.trim().length > 0 && intro.trim().length > 0;
  const pick = async () => {
    const source = await promptImageSource();
    if (!source || source === "remove") return;
    const asset = await pickSingleImage({
      source,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (asset) setAvatar(asset);
  };
  const submit = async () => {
    if (!enabled || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    setSubmitStatus(
      avatar ? "프로필 사진을 처리하고 있어요." : "가입 신청을 보내고 있어요.",
    );
    try {
      let uploadId: string | undefined;
      if (avatar && isSupabaseConfigured) {
        const resized = await withTimeout(
          ImageManipulator.manipulateAsync(
            avatar.uri,
            [{ resize: { width: 512, height: 512 } }],
            { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
          ),
          10000,
          "프로필 사진 처리 시간이 초과되었습니다.",
        );
        const bytes = await withTimeout(
          fetch(resized.uri).then((response) => response.arrayBuffer()),
          10000,
          "프로필 사진을 읽지 못했습니다.",
        );
        const upload = await withTimeout(
          uploadValidatedImage({
            uri: resized.uri,
            mimeType: "image/jpeg",
            fileSize: bytes.byteLength,
            width: 512,
            height: 512,
            purpose: "profile-avatar",
          }),
          20000,
          "프로필 사진 업로드 시간이 초과되었습니다.",
        );
        uploadId = upload.uploadId;
      }
      setSubmitStatus("가입 신청을 보내고 있어요.");
      const message = await withTimeout(
        onSubmit(name.trim(), intro.trim(), uploadId),
        15000,
        "가입 신청 응답 시간이 초과되었습니다.",
      );
      setSubmitting(false);
      setSubmitStatus("");
      setToast(message);
      setTimeout(onCompleted, 1800);
    } catch (error) {
      const message = serverErrorMessage(error);
      setSubmitting(false);
      setSubmitStatus("");
      setSubmitError(message);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <EdgeBackLayer onBack={onBack} />
      <StatusBar style="light" />
      <TopBar title={`${room.name} 가입 신청`} onBack={onBack} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={s.joinForm}
        >
          <View style={s.joinProfile}>
            <Pressable accessibilityLabel="프로필 사진 선택" onPress={pick}>
              {avatar ? (
                <Image source={{ uri: avatar.uri }} style={s.joinAvatar} />
              ) : (
                <DefaultAvatar size={82} />
              )}
              <View style={s.editDot}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            </Pressable>
          </View>
          <Field
            label="이름"
            value={name}
            onChange={(v) => setName(v.slice(0, 13))}
            placeholder="가입할 이름을 입력해주세요."
          />
          <Text style={s.counter}>{name.length}/13</Text>
          <Field
            label="자기 소개"
            value={intro}
            onChange={(v) => setIntro(v.slice(0, 60))}
            placeholder="자기 소개를 입력해주세요."
            multiline
          />
          <Text style={s.counter}>{intro.length}/60</Text>
          {submitStatus !== "" && (
            <View style={s.joinSubmitStatus}>
              <ActivityIndicator size="small" color={colors.mint700} />
              <Text style={s.joinSubmitStatusText}>{submitStatus}</Text>
            </View>
          )}
          {submitError !== "" && (
            <Text style={s.joinSubmitError}>{submitError}</Text>
          )}
        </ScrollView>
        <View style={s.sticky}>
          <Pressable
            disabled={!enabled || submitting || toast !== ""}
            onPress={submit}
            style={[
              s.primary,
              (!enabled || submitting || toast !== "") && s.disabled,
            ]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {submitting ? "신청 중..." : "가입하고 싶어요"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {toast !== "" && (
        <View pointerEvents="none" style={s.joinSuccessToast}>
          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function ChatRoom({
  room,
  currentUserId,
  readOnly,
  isKnownOwner,
  isSuperAdmin,
  onAdminReportUser,
  onEditRoom,
  initialPanel = null,
  initialStoryId = null,
  initialFocusUnread = false,
  points,
  onPointBalanceChange,
  promotionAvailableAt,
  topSpaceExpiresAt,
  topSpaceRemaining,
  onBoost,
  onPromote,
  onDeleted,
  onRead,
  onApplicationsBack,
  onBack,
}: {
  room: Room;
  currentUserId?: string;
  readOnly: boolean;
  isKnownOwner: boolean;
  isSuperAdmin: boolean;
  onAdminReportUser: (id: string, label: string) => void;
  onEditRoom: () => void;
  initialPanel?: ChatPanel;
  initialStoryId?: string | null;
  initialFocusUnread?: boolean;
  points: number;
  onPointBalanceChange: (balance: number) => void;
  promotionAvailableAt: number;
  topSpaceExpiresAt?: number;
  topSpaceRemaining: string;
  onBoost: (option: TopSpacePackage) => Promise<boolean>;
  onPromote: () => Promise<
    { ok: true; remainingMs: number } | { ok: false; remainingMs: number }
  >;
  onDeleted?: (roomId: string) => void;
  onRead?: (roomId: string) => void;
  onApplicationsBack?: () => void;
  onBack: () => void;
}) {
  const initialMessageLimit = 24;
  const olderMessagePageSize = 30;
  const appTheme = useAppTheme();
  const adsDisabled = useAdFree();
  const safeAreaInsets = useSafeAreaInsets();
  const [chatKeyboardVisible, setChatKeyboardVisible] = useState(false);
  const androidChatBottomInset =
    Platform.OS === "android" && !chatKeyboardVisible ? safeAreaInsets.bottom : 0;
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>(() =>
    isLocalDemoRoomId(room.id) ? membersForRoom(room) : [],
  );
  useEffect(() => {
    if (isUuid(room.id)) setForegroundRoomId(room.id);
    return () => {
      if (isUuid(room.id)) clearForegroundRoomId(room.id);
    };
  }, [room.id]);
  const myProfile =
    roomMembers.find((member) => member.mine) ??
    (isLocalDemoRoomId(room.id)
      ? ROOM_MEMBERS.find((member) => member.mine)
      : undefined);
  const myDisplayName = myProfile?.name ?? "나";
  const [myRole, setMyRole] = useState<"owner" | "cohost" | "member">(
    isKnownOwner ? "owner" : "member",
  );
  const isOwner = myRole === "owner";
  const isStaff = myRole === "owner" || myRole === "cohost";
  const [panel, setPanel] = useState<ChatPanel>(initialPanel);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tool, setTool] = useState<ComposerTool>(null);
  const [bubbleColor, setBubbleColor] = useState<string>("#F5F5F5");
  const [textColor, setTextColor] = useState<string>(colors.text);
  const [chatBackground, setChatBackground] = useState("#FFFFFF");
  const effectiveChatBackground =
    appTheme.id === "dark" && chatBackground === "#FFFFFF"
      ? "#222222"
      : chatBackground;
  const [bubbleProductId, setBubbleProductId] = useState<string | undefined>();
  const [textProductId, setTextProductId] = useState<string | undefined>();
  const [backgroundProductId, setBackgroundProductId] = useState<
    string | undefined
  >();
  const [chatEntitlements, setChatEntitlements] = useState<ChatEntitlement[]>(
    [],
  );
  const [chatStyleLoaded, setChatStyleLoaded] = useState(false);
  const [customColorTarget, setCustomColorTarget] = useState<{
    target: "bubble" | "text" | "background";
    productId: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [secretDraft, setSecretDraft] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [pointTarget, setPointTarget] = useState<string | null>(null);
  const [pointTargetMember, setPointTargetMember] = useState<RoomMember | null>(
    null,
  );
  const [pointDraft, setPointDraft] = useState("");
  const [pointSending, setPointSending] = useState(false);
  const pointSendingRef = useRef(false);
  const pointTransferRequestRef = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);
  const [profileMember, setProfileMember] = useState<RoomMember | null>(null);
  const [profileEditOnOpen, setProfileEditOnOpen] = useState(false);
  const [topSpaceOpen, setTopSpaceOpen] = useState(false);
  const [boostResult, setBoostResult] = useState<"success" | "shortage" | null>(
    null,
  );
  const [topSpaceSubmitting, setTopSpaceSubmitting] = useState(false);
  const roomExitSubmittingRef = useRef(false);
  const [roomDeleteSubmitting, setRoomDeleteSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    name: string;
    text: string;
  } | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([]);
  const [chatSearchLoading, setChatSearchLoading] = useState(false);
  const [chatSearchNavigating, setChatSearchNavigating] = useState(false);
  const [chatSearchCursor, setChatSearchCursor] = useState(0);
  const chatScrollRef = useRef<React.ElementRef<typeof RNScrollView> | null>(null);
  const composerInputRef = useRef<React.ElementRef<typeof RNTextInput> | null>(null);
  const chatSearchNavigationSeqRef = useRef(0);
  const chatSearchNavigationTimerRefs = useRef<ReturnType<typeof setTimeout>[]>(
    [],
  );
  const mountedRef = useRef(true);
  const roomSessionRef = useRef(0);
  const scrollMetrics = useRef({
    layoutHeight: 0,
    contentHeight: 0,
    offsetY: 0,
  });
  const initialScrollDone = useRef(false);
  const nearBottomRef = useRef(true);
  const lastObservedLatestMessageIdRef = useRef<string | null>(null);
  const lastSyncedServerMessageIdRef = useRef<string | null>(null);
  const latestReadableMessageIdRef = useRef<string | null>(null);
  const unreadFocusDoneRef = useRef(false);
  const onReadRef = useRef(onRead);
  const keyboardOpenedAtBottomRef = useRef(false);
  const composerFocusPreparedRef = useRef(false);
  const scrollToLatestRef = useRef<(animated?: boolean) => void>(() => undefined);
  const prependHeightRef = useRef<number | null>(null);
  const prependOffsetRef = useRef<number | null>(null);
  const prependAnchorRef = useRef<{
    id: string;
    initialY: number;
    viewportOffset: number;
  } | null>(null);
  const messagePositions = useRef<Record<string, number>>({});
  const restoreScrollAfterPanelRef = useRef(false);
  const [chatReady, setChatReady] = useState(false);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  const [chatLoadError, setChatLoadError] = useState("");
  const [chatReloadNonce, setChatReloadNonce] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [newMessagePreview, setNewMessagePreview] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);
  useEffect(() => {
    const willShow = Keyboard.addListener("keyboardWillShow", () => {
      if (!composerFocusPreparedRef.current)
        keyboardOpenedAtBottomRef.current = nearBottomRef.current;
      setChatKeyboardVisible(true);
      if (keyboardOpenedAtBottomRef.current)
        requestAnimationFrame(() => scrollToLatestRef.current(false));
    });
    const didShow = Keyboard.addListener("keyboardDidShow", () => {
      setChatKeyboardVisible(true);
      if (keyboardOpenedAtBottomRef.current) {
        requestAnimationFrame(() => scrollToLatestRef.current(false));
        setTimeout(() => scrollToLatestRef.current(false), 20);
        setTimeout(() => scrollToLatestRef.current(false), 40);
        setTimeout(() => scrollToLatestRef.current(false), 120);
        setTimeout(() => scrollToLatestRef.current(false), 260);
      }
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpenedAtBottomRef.current = false;
      composerFocusPreparedRef.current = false;
      setChatKeyboardVisible(false);
    });
    return () => {
      willShow.remove();
      didShow.remove();
      hide.remove();
    };
  }, []);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<
    { id: string; name: string; createdAt: string }[]
  >([]);
  const [storyPanelInitialId, setStoryPanelInitialId] = useState<string | null>(
    initialStoryId,
  );
  const [storyPanelInitialWrite, setStoryPanelInitialWrite] = useState(false);
  useEffect(() => {
    if (initialPanel === "stories") {
      setPanel("stories");
      setStoryPanelInitialId(initialStoryId ?? null);
      setStoryPanelInitialWrite(false);
      return;
    }
    if (initialPanel === "applications") {
      setPanel("applications");
      setStoryPanelInitialId(null);
      setStoryPanelInitialWrite(false);
    }
  }, [initialPanel, initialStoryId, room.id]);
  const [photoViewer, setPhotoViewer] = useState<{
    uris:string[];
    index:number;
    menuOpen: boolean;
  } | null>(null);
  const openActiveMemberProfile = useCallback(
    (item: Pick<ChatBase, "userId"> & { name: string }) => {
      Keyboard.dismiss();
      const activeMember = item.userId
        ? roomMembers.find((member) => member.userId === item.userId)
        : undefined;
      if (!activeMember) return;
      setSelectedMember(activeMember.name);
    },
    [roomMembers],
  );
  const photoViewerSwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.x0 < 32 &&
          gesture.dx > 12 &&
          Math.abs(gesture.dy) < 28,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > 64 && Math.abs(gesture.dy) < 48) {
            setPhotoViewer(null);
          }
        },
      }),
    [],
  );
  const [imageEditorAssets, setImageEditorAssets] = useState<
    ChatImageAsset[] | null
  >(null);
  const [toast, setToast] = useState("");
  const [readBoundaryId, setReadBoundaryId] = useState<string | null>(null);
  const [readBoundaryLoaded, setReadBoundaryLoaded] = useState(false);
  const [entryUnreadMarkerId, setEntryUnreadMarkerId] = useState<string | null>(null);
  const entryUnreadResolvedRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    isLocalDemoRoomId(room.id)
      ? isScreenshotDemoRoomId(room.id)
        ? screenshotDemoChatMessages(myDisplayName)
        : [
          {
            id: "1",
            kind: "text",
            mine: false,
            name: "초록윤",
            text: "오늘 저녁 산책할 사람 있나요?",
            time: "오후 9:21",
            createdAt: "2026-06-11T12:21:00.000Z",
          },
          {
            id: "2",
            kind: "text",
            mine: false,
            name: "초록윤",
            text: "날씨가 좋아서 천천히 걸으면 좋겠어요. 산책 코스는 지난번에 갔던 공원 입구에서 시작해서 강변을 따라 천천히 걷고, 중간에 편의점 앞 벤치에서 잠깐 쉬었다가 돌아오는 방향이면 좋을 것 같아요. 늦게 합류하는 분도 찾기 쉽도록 출발 전에 위치를 한 번 더 공유할게요. 혹시 비가 오면 실내로 바로 바꿀 수 있도록 대체 장소도 같이 정해두면 좋겠습니다. 처음 보는 분들도 부담 없게 이동 속도는 느리게 잡고, 중간에 사진 찍고 쉬는 시간도 넣을게요.",
            time: "오후 9:22",
            createdAt: "2026-06-11T12:22:00.000Z",
          },
          {
            id: "3",
            kind: "system",
            event: "join",
            text: "한걸음님이 들어왔습니다.",
            createdAt: "2026-06-11T12:22:30.000Z",
          },
          {
            id: "4",
            kind: "text",
            mine: true,
            name: myDisplayName,
            text: "저 좋아요. 8시쯤 어때요?",
            time: "오후 9:23",
            createdAt: "2026-06-11T12:23:00.000Z",
          },
          {
            id: "5",
            kind: "image",
            mine: false,
            name: "느린준",
            imageUris: [],
            time: "오후 9:24",
            createdAt: "2026-06-11T12:24:00.000Z",
          },
          {
            id: "6",
            kind: "system",
            event: "heart",
            text: "한걸음님이 느린준님에게 하트를 보냈습니다.",
            createdAt: "2026-06-11T12:24:20.000Z",
          },
          {
            id: "7",
            kind: "secret",
            mine: false,
            name: "느린준",
            recipient: "한걸음",
            text: "산책 장소는 지난번 카페 앞으로 할까요?",
            time: "오후 9:25",
            createdAt: "2026-06-11T12:25:00.000Z",
          },
          {
            id: "8",
            kind: "system",
            event: "leave",
            text: "솔바람님이 초록 테이블에서 퇴장했습니다.",
            createdAt: "2026-06-12T09:15:00.000Z",
          },
          {
            id: "8-kick",
            kind: "system",
            event: "kick",
            text: "느린준님이 강퇴되었습니다: 한걸음",
            createdAt: "2026-06-12T09:16:00.000Z",
          },
          {
            id: "9",
            kind: "system",
            event: "room",
            text: "방 설명이 변경되었습니다: 한걸음",
            createdAt: "2026-06-12T09:18:00.000Z",
          },
          {
            id: "10",
            kind: "story",
            mine: false,
            name: "해질녘",
            storyId: "s1",
            title: "이번 주 산책 후보",
            preview:
              "토요일 오후에 걷기 좋은 코스를 몇 군데 정리해봤어요. 같이 보고 의견 남겨주세요.",
            time: "오후 9:28",
            createdAt: "2026-06-12T09:28:00.000Z",
          },
        ]
      : [],
  );
  const rememberScrollPosition = () => {
    ROOM_SCROLL_STATE.set(room.id, {
      offsetY: scrollMetrics.current.offsetY,
      nearBottom: nearBottomRef.current,
    });
  };
  const openPanel = (nextPanel: ChatPanel) => {
    rememberScrollPosition();
    restoreScrollAfterPanelRef.current = true;
    setPanel(nextPanel);
  };
  useEffect(() => {
    mountedRef.current = true;
    roomSessionRef.current += 1;
    return () => {
      mountedRef.current = false;
      roomSessionRef.current += 1;
    };
  }, [room.id]);
  useEffect(() => {
    const pending = messages.filter(
      (item) => item.delivery === "sending" || item.delivery === "failed",
    );
    if (pending.length) LOCAL_PENDING_MESSAGES.set(room.id, pending);
    else LOCAL_PENDING_MESSAGES.delete(room.id);
  }, [messages, room.id]);
  useEffect(() => {
    if (!isSupabaseConfigured || !isUuid(room.id) || !currentUserId) {
      setChatStyleLoaded(true);
      return;
    }
    let active = true;
    Promise.all([listActiveChatEntitlements(), listRoomChatStyles(room.id)])
      .then(([entitlements, styles]) => {
        if (!active) return;
        setChatEntitlements(entitlements);
        const own = styles.find((style) => style.userId === currentUserId);
        if (own) {
          setBubbleColor(own.bubbleColor);
          setTextColor(own.textColor);
          setChatBackground(own.backgroundColor);
          setBubbleProductId(own.bubbleProductId);
          setTextProductId(own.textProductId);
          setBackgroundProductId(own.backgroundProductId);
        } else if (appTheme.id === "dark") {
          setBubbleColor("#303030");
          setTextColor("#F2F2F2");
          setChatBackground("#222222");
          setBubbleProductId(undefined);
          setTextProductId(undefined);
          setBackgroundProductId(undefined);
        }
        setChatStyleLoaded(true);
      })
      .catch(() => setChatStyleLoaded(true));
    return () => {
      active = false;
    };
  }, [currentUserId, room.id]);
  useEffect(() => {
    if (!currentUserId || !isUuid(room.id) || !chatEntitlements.length) return;
    const nextExpiry = Math.min(
      ...chatEntitlements
        .map((item) => Date.parse(item.expiresAt))
        .filter((value) => Number.isFinite(value) && value > Date.now()),
    );
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => {
      Promise.all([listActiveChatEntitlements(), listRoomChatStyles(room.id)])
        .then(([entitlements, styles]) => {
          setChatEntitlements(entitlements);
          const own = styles.find((style) => style.userId === currentUserId);
          if (!own) return;
          setBubbleColor(own.bubbleColor);
          setTextColor(own.textColor);
          setChatBackground(own.backgroundColor);
          setBubbleProductId(own.bubbleProductId);
          setTextProductId(own.textProductId);
          setBackgroundProductId(own.backgroundProductId);
        })
        .catch(() => undefined);
    }, Math.max(1000, nextExpiry - Date.now() + 500));
    return () => clearTimeout(timer);
  }, [chatEntitlements, currentUserId, room.id]);
  useEffect(() => {
    if (initialMessagesLoaded && !chatReady && messages.length === 0)
      setChatReady(true);
  }, [chatReady, initialMessagesLoaded, messages.length]);
  useEffect(() => {
    if (
      !chatStyleLoaded ||
      !isSupabaseConfigured ||
      !isUuid(room.id) ||
      readOnly ||
      !currentUserId ||
      !roomMembers.some((member) => member.mine)
    )
      return;
    const timer = setTimeout(
      () =>
        saveMyRoomChatStyle({
          roomId: room.id,
          bubbleColor,
          bubbleProductId,
          textColor,
          textProductId,
          backgroundColor: chatBackground,
          backgroundProductId,
        }).catch((error) =>
          Alert.alert("색상 저장 실패", serverErrorMessage(error)),
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [
    backgroundProductId,
    bubbleColor,
    bubbleProductId,
    chatBackground,
    chatStyleLoaded,
    currentUserId,
    readOnly,
    roomMembers,
    room.id,
    textColor,
    textProductId,
  ]);
  useEffect(() => {
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      setRoomMembers(isLocalDemoRoomId(room.id) ? membersForRoom(room) : []);
      return;
    }
    listRoomMembersVisible(room.id)
      .then((serverMembers) =>
        setRoomMembers(mapRoomMembers(serverMembers, currentUserId)),
      )
      .catch(() => undefined);
  }, [currentUserId, room.id, room.memberCount]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id)) return;
    setMyRole(isKnownOwner ? "owner" : "member");
    const client = supabase;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reloadProfiles = async () => {
      try {
        const serverMembers = await listRoomMembersVisible(room.id);
        if (!active) return;
        const mappedMembers = mapRoomMembers(serverMembers, currentUserId);
        const currentByUserId = new Map(
          mappedMembers
            .filter((member) => Boolean(member.userId))
            .map((member) => [member.userId!, member]),
        );
        setRoomMembers(mappedMembers);
        setMessages((items) =>
          items.map((item) => {
            if (item.kind === "system" || !item.userId) return item;
            const currentProfile = currentByUserId.get(item.userId);
            return currentProfile
              ? {
                  ...item,
                  name: currentProfile.name,
                  avatarUri: currentProfile.avatarUri,
                }
              : item;
          }),
        );
      } catch {
        // Keep the last complete profile state until the next realtime event.
      }
    };
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reloadProfiles(), 120);
    };
    const channel = client
      .channel(`chat-member-profiles-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_profiles",
          filter: `room_id=eq.${room.id}`,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_memberships",
          filter: `room_id=eq.${room.id}`,
        },
        scheduleReload,
      )
      .subscribe();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [currentUserId, room.id]);
  useEffect(() => {
    initialScrollDone.current = false;
    lastObservedLatestMessageIdRef.current = null;
    lastSyncedServerMessageIdRef.current = null;
    setChatReady(false);
    setInitialMessagesLoaded(false);
    setChatLoadError("");
    setHasOlderMessages(true);
    setNewMessagePreview(null);
    setShowScrollToBottom(false);
    setMessages([]);
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      const pending = LOCAL_PENDING_MESSAGES.get(room.id) ?? [];
      setMessages(
        isScreenshotDemoRoomId(room.id)
          ? [...screenshotDemoChatMessages(myDisplayName), ...pending]
          : isLocalDemoRoomId(room.id)
            ? pending.length
              ? pending
              : messages
            : pending,
      );
      setHasOlderMessages(false);
      setInitialMessagesLoaded(true);
      setChatReady(true);
      return;
    }
    listRoomMessages(room.id, initialMessageLimit)
      .then((serverMessages) => {
        const pending = LOCAL_PENDING_MESSAGES.get(room.id) ?? [];
        const byId = new Map<string, ChatMessage>();
        [
          ...serverMessages.map((item) =>
            mapServerChatMessage(item, currentUserId),
          ),
          ...pending,
        ].forEach((item) => byId.set(item.id, item));
        setMessages(mergeChatMessages([...byId.values()]));
        lastSyncedServerMessageIdRef.current =
          serverMessages[serverMessages.length - 1]?.id ?? null;
        setHasOlderMessages(serverMessages.length === initialMessageLimit);
        setChatLoadError("");
        setInitialMessagesLoaded(true);
      })
      .catch((error) => {
        setChatLoadError(serverErrorMessage(error));
        setInitialMessagesLoaded(true);
      });
  }, [chatReloadNonce, currentUserId, room.id]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id)) return;
    const client = supabase;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let reloadInFlight = false;
    let reloadPending = false;
    const reload = async () => {
      if (reloadInFlight) {
        reloadPending = true;
        return;
      }
      reloadInFlight = true;
      try {
        do {
          reloadPending = false;
          const serverMessages = await listRoomMessages(
            room.id,
            initialMessageLimit,
          );
          lastSyncedServerMessageIdRef.current =
            serverMessages[serverMessages.length - 1]?.id ?? null;
          setMessages((current) => {
            const mapped = serverMessages.map((item) =>
              mapServerChatMessage(item, currentUserId),
            );
            return mergeChatMessages(current, mapped);
          });
        } while (reloadPending);
      } catch {
        // Realtime will deliver a later event; avoid retry storms here.
      } finally {
        reloadInFlight = false;
      }
    };
    const scheduleReload = (delay = 0) => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void reload(), delay);
    };
    const checkForMissedMessages = async () => {
      if (AppState.currentState !== "active") return;
      try {
        const cursor = await getLatestRoomMessageCursor(room.id);
        if (cursor?.id !== lastSyncedServerMessageIdRef.current) {
          await reload();
          // A newly joined member may not be allowed to load messages from
          // before joined_at even though the lightweight cursor can see one.
          // Remember the checked cursor to avoid a needless polling loop.
          lastSyncedServerMessageIdRef.current = cursor?.id ?? null;
        }
      } catch {
        // The next realtime event or foreground check retries naturally.
      }
    };
    const channel = client
      .channel(`chat-messages-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${room.id}`,
        },
        () => scheduleReload(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          void checkForMissedMessages();
      });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForMissedMessages();
    });
    // Realtime remains primary. This single-row cursor check only repairs
    // missed websocket events while the room is actually on screen.
    fallbackTimer = setInterval(() => void checkForMissedMessages(), 4000);
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      if (fallbackTimer) clearInterval(fallbackTimer);
      appStateSubscription.remove();
      client.removeChannel(channel);
    };
  }, [currentUserId, room.id]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id)) return;
    const client = supabase;
    const channel = client
      .channel(`chat-styles-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_member_chat_styles",
          filter: `room_id=eq.${room.id}`,
        },
        () =>
          listRoomMessages(room.id, initialMessageLimit)
            .then((rows) =>
              setMessages((current) =>
                mergeChatMessages(
                  rows.map((item) =>
                    mapServerChatMessage(item, currentUserId),
                  ),
                  current.filter(
                    (item) =>
                      item.delivery === "sending" || item.delivery === "failed",
                  ),
                ),
              ),
            )
            .catch(() => undefined),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [currentUserId, room.id]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id)) return;
    const client = supabase;
    client.auth.getUser().then(({ data: userData }) => {
      if (!userData.user) return;
      return client
        .from("room_memberships")
        .select("role")
        .eq("room_id", room.id)
        .eq("user_id", userData.user.id)
        .eq("status", "active")
        .maybeSingle()
        .then(({ data }) => {
          if (
            data?.role === "owner" ||
            data?.role === "cohost" ||
            data?.role === "member"
          )
            setMyRole(data.role);
        });
    });
  }, [isKnownOwner, room.id]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id) || !isOwner) {
      setPendingJoinRequests([]);
      return;
    }
    const client = supabase;
    let active = true;
    const reload = () =>
      listPendingRoomJoinRequests(room.id)
        .then((rows) => {
          if (active)
            setPendingJoinRequests(
              rows.map((row) => ({
                id: row.id,
                name: row.requested_name,
                createdAt: row.created_at,
              })),
            );
        })
        .catch(() => undefined);
    reload();
    const channel = client
      .channel(`chat-join-requests-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_join_requests",
          filter: `room_id=eq.${room.id}`,
        },
        reload,
      )
      .subscribe();
    return () => {
      active = false;
      client.removeChannel(channel);
    };
  }, [isOwner, room.id]);
  const loadOlderMessages = async () => {
    if (
      loadingOlderRef.current ||
      !hasOlderMessages ||
      !isSupabaseConfigured ||
      !isUuid(room.id)
    )
      return;
    const oldest = messages.find(
      (item) => item.createdAt && !item.id.startsWith("pending-"),
    );
    if (!oldest?.createdAt) return;
    prependHeightRef.current = scrollMetrics.current.contentHeight;
    prependOffsetRef.current = scrollMetrics.current.offsetY;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const older = await listRoomMessages(
        room.id,
        olderMessagePageSize,
        oldest.createdAt,
      );
      const mapped = older.map((item) =>
        mapServerChatMessage(item, currentUserId),
      );
      setHasOlderMessages(older.length === olderMessagePageSize);
      setMessages((current) => {
        return mergeChatMessages(mapped, current);
      });
    } catch (error) {
      prependHeightRef.current = null;
      prependOffsetRef.current = null;
      prependAnchorRef.current = null;
      Alert.alert("이전 채팅 불러오기 실패", serverErrorMessage(error));
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };
  const scrollToLatest = (animated = true) => {
    setNewMessagePreview(null);
    setShowScrollToBottom(false);
    requestAnimationFrame(() =>
      chatScrollRef.current?.scrollToEnd({ animated }),
    );
  };
  const scrollToMessagePosition = (messageId: string) => {
    const y = messagePositions.current[messageId];
    if (y === undefined) return false;
    setJumpHighlightId(messageId);
    chatScrollRef.current?.scrollTo({ y: Math.max(0, y - 72), animated: true });
    setTimeout(
      () => setJumpHighlightId((current) => (current === messageId ? null : current)),
      1600,
    );
    return true;
  };
  const jumpToMessage = async (messageId: string) => {
    if (scrollToMessagePosition(messageId)) return;
    if (!isSupabaseConfigured || !isUuid(messageId) || !isUuid(room.id)) return;
    try {
      const createdAt = await getRoomMessageCreatedAt(messageId);
      if (!createdAt) return;
      const through = new Date(new Date(createdAt).getTime() + 1).toISOString();
      const context = await listRoomMessages(room.id, 50, through);
      setMessages((current) => {
        return mergeChatMessages(
          context.map((item) => mapServerChatMessage(item, currentUserId)),
          current,
        );
      });
      setTimeout(() => scrollToMessagePosition(messageId), 120);
    } catch (error) {
      Alert.alert("답장 위치 이동 실패", serverErrorMessage(error));
    }
  };
  const focusComposer = () => {
    const { layoutHeight, contentHeight, offsetY } = scrollMetrics.current;
    const distanceFromBottom = Math.max(
      0,
      contentHeight - layoutHeight - offsetY,
    );
    if (nearBottomRef.current || distanceFromBottom <= 180) {
      keyboardOpenedAtBottomRef.current = true;
      requestAnimationFrame(() => scrollToLatest(false));
      setTimeout(() => scrollToLatest(false), 40);
    }
  };
  const prepareComposerFocus = () => {
    if (chatKeyboardVisible) return;
    const { layoutHeight, contentHeight, offsetY } = scrollMetrics.current;
    const distanceFromBottom = Math.max(
      0,
      contentHeight - layoutHeight - offsetY,
    );
    keyboardOpenedAtBottomRef.current =
      nearBottomRef.current || distanceFromBottom <= 180;
    composerFocusPreparedRef.current = true;
    // Reserve the banner slot before iOS starts its keyboard transition.
    setChatKeyboardVisible(true);
    if (keyboardOpenedAtBottomRef.current) {
      requestAnimationFrame(() => scrollToLatestRef.current(false));
      setTimeout(() => scrollToLatestRef.current(false), 20);
      setTimeout(() => scrollToLatestRef.current(false), 80);
      setTimeout(() => scrollToLatestRef.current(false), 180);
      setTimeout(() => scrollToLatestRef.current(false), 320);
    }
  };
  useEffect(() => {
    initialScrollDone.current = false;
    requestAnimationFrame(() => setTimeout(() => scrollToLatest(false), 80));
  }, [room.id]);
  const submitTextMessage = async (
    localId: string,
    text: string,
    reply?: { id: string; name: string; text: string },
  ) => {
    try {
      let id = localId;
      if (isSupabaseConfigured && isUuid(room.id))
        id = await sendTextMessage({
          roomId: room.id,
          body: text,
          replyToMessageId: isUuid(reply?.id) ? reply?.id : undefined,
        });
      setMessages((items) =>
        items.map((item) =>
          item.id === localId
            ? {
                ...item,
                id,
                delivery: "sent" as const,
                time: formatChatClock(new Date().toISOString()),
              }
            : item,
        ),
      );
    } catch {
      setMessages((items) =>
        items.map((item) =>
          item.id === localId ? { ...item, delivery: "failed" as const } : item,
        ),
      );
    }
  };
  const pendingTextSeq = useRef(0);
  const textSendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const send = () => {
    const text = message.trim();
    if (!text) return;
    const createdAt = new Date().toISOString();
    pendingTextSeq.current += 1;
    const localId = `pending-text-${Date.now()}-${pendingTextSeq.current}`;
    const reply = replyTo ?? undefined;
    setMessages((items) => [
      ...items,
      {
        id: localId,
        kind: "text",
        mine: true,
        name: myDisplayName,
        avatarUri: myProfile?.avatarUri,
        text,
        time: "지금",
        createdAt,
        replyTo: reply,
        delivery: "sending",
        bubbleColor,
        textColor,
      },
    ]);
    setMessage("");
    setReplyTo(null);
    requestAnimationFrame(() => scrollToLatestRef.current(false));
    setTimeout(() => scrollToLatestRef.current(false), 40);
    setTimeout(() => scrollToLatestRef.current(false), 140);
    textSendQueueRef.current = textSendQueueRef.current
      .then(() => submitTextMessage(localId, text, reply))
      .catch(() => undefined);
  };
  scrollToLatestRef.current = scrollToLatest;
  const sendHeart = async (targetNameOverride?: string): Promise<boolean> => {
    const createdAt = new Date().toISOString();
    const targetName = targetNameOverride ?? selectedMember ?? "느린준";
    const body = `${myDisplayName}님이 ${targetName}님에게 하트를 보냈습니다.`;
    try {
      let id = `heart-${Date.now()}`;
      if (isSupabaseConfigured && isUuid(room.id))
        id = await sendSystemMessage({ roomId: room.id, body });
      setMessages((value) => [
        ...value,
        { id, kind: "system", event: "heart", text: body, createdAt },
      ]);
      setTool(null);
      return true;
    } catch (error) {
      Alert.alert("하트 보내기 실패", serverErrorMessage(error));
      return false;
    }
  };
  const sendSecretTo = async (
    target: RoomMember | undefined,
    draft: string,
  ): Promise<boolean> => {
    const text = draft.trim();
    if (!text) return false;
    const createdAt = new Date().toISOString();
    const targetName = target?.name ?? selectedMember ?? "느린준";
    try {
      let id = `secret-${Date.now()}`;
      if (isSupabaseConfigured && isUuid(room.id)) {
        if (!target?.userId || !isUuid(target.userId)) {
          Alert.alert(
            "비밀 쪽지 실패",
            "서버에 등록된 멤버에게만 보낼 수 있습니다.",
          );
          return false;
        }
        id = await sendSecretMessage({
          roomId: room.id,
          body: text,
          recipientUserId: target.userId,
        });
      }
      setMessages((value) => [
        ...value,
        {
          id,
          userId: currentUserId,
          kind: "secret",
          mine: true,
          name: myDisplayName,
          avatarUri: myProfile?.avatarUri,
          recipient: targetName,
          text,
          time: "지금",
          createdAt,
        },
      ]);
      setSecretDraft("");
      setTool(null);
      return true;
    } catch (error) {
      Alert.alert("비밀 쪽지 실패", serverErrorMessage(error));
      return false;
    }
  };
  const sendSecret = async () =>
    sendSecretTo(
      roomMembers.find((member) => member.name === selectedMember),
      secretDraft,
    );
  const sendPointTo = async (
    target: RoomMember | undefined,
    rawAmount: string,
  ): Promise<boolean> => {
    if (pointSendingRef.current) return false;
    const normalizedAmount = rawAmount.trim();
    if (!/^[0-9]+$/.test(normalizedAmount)) {
      Alert.alert("포인트 보내기", "포인트는 숫자로만 입력해주세요.");
      return false;
    }
    const amount = Number(normalizedAmount);
    const targetName = target?.name;
    if (!targetName) return false;
    if (target?.mine || target?.userId === currentUserId) {
      Alert.alert("포인트 보내기", "본인에게는 포인트를 보낼 수 없습니다.");
      return false;
    }
    if (!target?.userId) {
      Alert.alert(
        "포인트 보내기 실패",
        "서버에 등록된 멤버에게만 포인트를 보낼 수 있습니다.",
      );
      return false;
    }
    if (!Number.isSafeInteger(amount) || amount < 1) {
      Alert.alert("포인트 보내기", "1p 이상 입력해주세요.");
      return false;
    }
    let availablePoints = points;
    if (amount > availablePoints && isSupabaseConfigured) {
      try {
        const latestWallet = await getMyWallet();
        availablePoints = latestWallet.pointBalance;
        if (typeof onPointBalanceChange === "function")
          onPointBalanceChange(availablePoints);
      } catch {
        // The transfer RPC remains the source of truth if this refresh fails.
      }
    }
    if (amount > availablePoints) {
      Alert.alert(
        "포인트 부족",
        `현재 보유 포인트는 ${availablePoints.toLocaleString()}p입니다.`,
      );
      return false;
    }
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      Alert.alert(
        "포인트 보내기 실패",
        "서버에 연결된 채팅방에서만 포인트를 보낼 수 있습니다.",
      );
      return false;
    }
    const createdAt = new Date().toISOString();
    const body = `${myDisplayName}님이 ${targetName}님에게 ${amount.toLocaleString()}p를 보냈습니다.`;
    pointSendingRef.current = true;
    setPointSending(true);
    try {
      let id: string;
      if (!isUuid(target.userId)) {
          Alert.alert(
            "포인트 보내기 실패",
            "서버에 등록된 멤버에게만 보낼 수 있습니다.",
          );
          return false;
      }
        const fingerprint = `${room.id}:${target.userId}:${amount}`;
        if (pointTransferRequestRef.current?.fingerprint !== fingerprint) {
          pointTransferRequestRef.current = {
            fingerprint,
            requestId: `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
          };
        }
        const transferInput = {
          roomId: room.id,
          recipientUserId: target.userId,
          amount,
          requestId: pointTransferRequestRef.current.requestId,
        };
        if (!supabase) throw new Error("POINT_TRANSFER_CLIENT_NOT_READY");
        const { data, error } = await supabase.rpc("transfer_room_points", {
          p_room_id: transferInput.roomId,
          p_recipient_user_id: transferInput.recipientUserId,
          p_amount: transferInput.amount,
          p_request_id: transferInput.requestId,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.message_id || !Number.isFinite(Number(row?.point_balance)))
          throw new Error("POINT_TRANSFER_INVALID_RESPONSE");
        const result = {
          pointBalance: Number(row.point_balance ?? 0),
          messageId: row.message_id as string,
        };
        id = result.messageId;
        if (typeof onPointBalanceChange === "function")
          onPointBalanceChange(result.pointBalance);
        pointTransferRequestRef.current = null;
      setMessages((value) =>
        value.some((item) => item.id === id)
          ? value
          : [
              ...value,
              { id, kind: "system", event: "point", text: body, createdAt },
            ],
      );
      setPointTarget(null);
      setPointTargetMember(null);
      setPointDraft("");
      scrollToLatest();
      return true;
    } catch (error) {
      Alert.alert("포인트 보내기 실패", serverErrorMessage(error));
      return false;
    } finally {
      pointSendingRef.current = false;
      setPointSending(false);
    }
  };
  const sendPoint = async () =>
    sendPointTo(
      pointTargetMember ??
        roomMembers.find((member) => member.name === pointTarget),
      pointDraft,
    );
  const uploadImageMessage = async (
    selected: ChatImageAsset[],
    existingId?: string,
  ) => {
    const localId = existingId ?? `pending-image-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const reply = replyTo ?? undefined;
    const sessionId = roomSessionRef.current;
    const previewUris = selected.map((asset) => asset.uri);
    if (!existingId)
      setMessages((items) => [
        ...items,
        {
          id: localId,
          kind: "image",
          mine: true,
          name: myDisplayName,
          avatarUri: myProfile?.avatarUri,
          imageUris: previewUris,
          time: "지금",
          createdAt,
          replyTo: reply,
          delivery: "sending",
          uploadProgress: 0,
          uploadProgressLabel:
            selected.length > 1 ? `0/${selected.length}` : undefined,
          pendingUploadAssets: selected,
        },
      ]);
    else
      setMessages((items) =>
        items.map((item) =>
          item.id === localId
            ? {
                ...item,
                delivery: "sending" as const,
                uploadProgress: 0,
                uploadProgressLabel:
                  selected.length > 1 ? `0/${selected.length}` : undefined,
                pendingUploadAssets: selected,
              }
            : item,
        ),
      );
    scrollToLatest();
    try {
      const output: string[] = [];
      const uploadIds: string[] = [];
      for (let index = 0; index < selected.length; index += 1) {
        if (sessionId !== roomSessionRef.current) {
          throw new Error("UPLOAD_CANCELLED");
        }
        const asset = await prepareChatImage(selected[index]);
        const isGif =
          asset.mimeType === "image/gif" ||
          asset.uri.toLowerCase().endsWith(".gif");
        if (isGif) {
          const response = await fetch(asset.uri);
          const bytes = await response.arrayBuffer();
          if (selected.length !== 1) {
            throw new Error("GIF는 한 장씩만 전송할 수 있습니다.");
          }
          if (bytes.byteLength > 5 * 1024 * 1024) {
            Alert.alert("GIF 용량 초과", "GIF는 5MB 이하만 보낼 수 있습니다.");
            continue;
          }
          output.push(asset.uri);
          if (isSupabaseConfigured && isUuid(room.id)) {
            const upload = await uploadValidatedImage({
              uri: asset.uri,
              mimeType: "image/gif",
              fileSize: bytes.byteLength,
              width: asset.width ?? 1,
              height: asset.height ?? 1,
              purpose: "chat",
              roomId: room.id,
            });
            uploadIds.push(upload.uploadId);
          }
          setMessages((items) =>
            items.map((item) =>
              item.id === localId
                ? {
                    ...item,
                    uploadProgress: (index + 1) / selected.length,
                    uploadProgressLabel:
                      selected.length > 1
                        ? `${index + 1}/${selected.length}`
                        : undefined,
                  }
                : item,
            ),
          );
          continue;
        }
        const width = asset.width ?? 1600;
        const height = asset.height ?? 1200;
        output.push(asset.uri);
        if (isSupabaseConfigured && isUuid(room.id)) {
          const response = await fetch(asset.uri);
          const bytes = await response.arrayBuffer();
          const upload = await uploadValidatedImage({
            uri: asset.uri,
            mimeType: "image/jpeg",
            fileSize: bytes.byteLength,
            width,
            height,
            purpose: "chat",
            roomId: room.id,
          });
          uploadIds.push(upload.uploadId);
        }
        setMessages((items) =>
          items.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  uploadProgress: (index + 1) / selected.length,
                  uploadProgressLabel:
                    selected.length > 1
                      ? `${index + 1}/${selected.length}`
                      : undefined,
                }
              : item,
          ),
        );
      }
      if (sessionId !== roomSessionRef.current) {
        throw new Error("UPLOAD_CANCELLED");
      }
      let id = localId;
      if (uploadIds.length)
        id = await sendUploadedImages({
          roomId: room.id,
          uploadIds,
          replyToMessageId: isUuid(replyTo?.id) ? replyTo?.id : undefined,
        });
      setMessages((items) =>
        items.map((item) =>
          item.id === localId
            ? {
                ...item,
                id,
                imageUris: output,
                delivery: "sent" as const,
                uploadProgress: 1,
                uploadProgressLabel: undefined,
                pendingUploadAssets: undefined,
              }
            : item,
        ),
      );
      setReplyTo(null);
      setTool(null);
    } catch {
      if (sessionId !== roomSessionRef.current || !mountedRef.current) {
        const pending = LOCAL_PENDING_MESSAGES.get(room.id) ?? [];
        const next = pending.some((item) => item.id === localId)
          ? pending.map((item) =>
              item.id === localId
                ? {
                    ...item,
                    delivery: "failed" as const,
                    imageUris: previewUris,
                    pendingUploadAssets: selected,
                    uploadProgressLabel: undefined,
                  }
                : item,
            )
          : [
              ...pending,
              {
                id: localId,
                kind: "image" as const,
                mine: true,
                name: myDisplayName,
                avatarUri: myProfile?.avatarUri,
                imageUris: previewUris,
                time: "지금",
                createdAt,
                replyTo: reply,
                delivery: "failed" as const,
                pendingUploadAssets: selected,
              },
            ];
        LOCAL_PENDING_MESSAGES.set(room.id, next);
        return;
      }
      setMessages((items) =>
        items.map((item) =>
          item.id === localId
            ? {
                ...item,
                delivery: "failed" as const,
                imageUris: previewUris,
                uploadProgressLabel: undefined,
                pendingUploadAssets: selected,
              }
            : item,
        ),
      );
    }
  };
  const sendImage = async (source: "camera" | "gallery") => {
    const selected = await pickChatImages(source);
    if (selected.length) {
      Keyboard.dismiss();
      setTool(null);
      requestAnimationFrame(() => setImageEditorAssets(selected));
    }
  };
  const retryMessage = (
    item: Extract<ChatMessage, { kind: "text" | "image" }>,
  ) => {
    if (item.kind === "text")
      void submitTextMessage(item.id, item.text, item.replyTo);
    else
      void uploadImageMessage(
        item.pendingUploadAssets ??
          (item.imageUris ?? []).map(
            (uri) =>
              ({
                uri,
                width: 1600,
                height: 1200,
                type: "image",
                mimeType: uri.toLowerCase().endsWith(".gif")
                  ? "image/gif"
                  : "image/jpeg",
              }) as ImagePicker.ImagePickerAsset,
          ),
        item.id,
      );
  };
  const deletePendingMessage = (id: string) =>
    setMessages((items) => items.filter((item) => item.id !== id));
  const copyMessage = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("복사됨", "메시지를 클립보드에 복사했습니다.");
  };
  const openPromotion = async () => {
    if (room.isAdult) {
      setTool(null);
      setToast("성인방은 프로모션을 사용할 수 없어요.");
      setTimeout(() => setToast(""), 1800);
      return;
    }
    const result = await onPromote();
    setTool(null);
    if (result.ok) {
      setToast("프로모션에 올렸습니다.");
      if (!isSupabaseConfigured || !isUuid(room.id)) {
        const body = `${myDisplayName}님이 프로모션을 돌렸습니다.`;
        setMessages((value) => [
          ...value,
          {
            id: `promotion-${Date.now()}`,
            kind: "system",
            event: "room",
            text: body,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } else if (result.remainingMs < 0) {
      setToast("성인방은 프로모션을 사용할 수 없어요.");
    } else {
      setToast("아직 프로모션을 돌릴 수 없습니다");
    }
    setTimeout(() => setToast(""), 1800);
  };
  const saveImage = async (uri: string) => {
    if (!uri) return;
    if (Platform.OS === "web") {
      Alert.alert("사진 저장", "모바일 앱에서 사진함에 저장할 수 있습니다.");
      return false;
    }
    const MediaLibrary = await import("expo-media-library/legacy");
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) return false;
    try {
      let localUri = uri;
      if (!uri.startsWith("file://")) {
        const manipulated = await ImageManipulator.manipulateAsync(uri, [], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        localUri = manipulated.uri;
      }
      await MediaLibrary.saveToLibraryAsync(localUri);
      setToast("사진이 저장되었습니다.");
      setTimeout(() => setToast(""), 1800);
      return true;
    } catch (error) {
      Alert.alert("저장 실패", serverErrorMessage(error));
      return false;
    }
  };
  const messageActions = (
    item: Extract<ChatMessage, { kind: "text" | "secret" | "image" }>,
  ) => {
    const createdAt = Date.parse(item.createdAt ?? "");
    const localOnly =
      item.delivery === "sending" ||
      item.delivery === "failed" ||
      String(item.id).startsWith("pending-");
    const canDelete =
      item.mine &&
      (item.kind === "text" || item.kind === "image") &&
      (localOnly ||
        (Number.isFinite(createdAt) &&
          Date.now() - createdAt <= 5 * 60 * 1000 &&
          (item.kind !== "text" || item.text !== "삭제된 메시지입니다.")));
    return Alert.alert("메시지", undefined, [
      ...(item.kind === "text" || item.kind === "image"
        ? [
            {
              text: "답장",
              onPress: () => {
                setReplyTo({
                  id: item.id,
                  name: item.name,
                  text: item.kind === "image" ? "사진" : item.text,
                });
                setTimeout(() => composerInputRef.current?.focus(), 120);
              },
            },
          ]
        : []),
      ...(item.kind !== "image"
        ? [{ text: "복사", onPress: () => copyMessage(item.text) }]
        : []),
      ...(canDelete
        ? [
            {
              text: "삭제하기",
              style: "destructive" as const,
              onPress: async () => {
                try {
                  if (localOnly) {
                    setMessages((current) =>
                      current.filter((message) => message.id !== item.id),
                    );
                    return;
                  }
                  if (isSupabaseConfigured && isUuid(item.id))
                    await softDeleteMyMessage(item.id);
                  setMessages((current) =>
                    current.map((message) =>
                      message.id === item.id
                        ? message.kind === "image"
                          ? {
                              id: message.id,
                              kind: "text" as const,
                              mine: message.mine,
                              name: message.name,
                              avatarUri: message.avatarUri,
                              text: "삭제된 메시지입니다.",
                              time: message.time,
                              createdAt: message.createdAt,
                              delivery: message.delivery,
                              uploadProgress: message.uploadProgress,
                              bubbleColor: message.bubbleColor,
                              textColor: message.textColor,
                            }
                          : message.kind === "text"
                            ? {
                                ...message,
                                text: "삭제된 메시지입니다.",
                                replyTo: undefined,
                              }
                            : message
                        : message,
                    ),
                  );
                } catch (error) {
                  Alert.alert("메시지 삭제 실패", serverErrorMessage(error));
                }
              },
            },
          ]
        : []),
      { text: "취소", style: "cancel" },
    ]);
  };
  const combinedMessages = useMemo(() => {
    const requestMessages: ChatMessage[] = isOwner
      ? pendingJoinRequests.map((request) => ({
          id: `request-${request.id}`,
          kind: "system",
          event: "join",
          text: `${request.name}님이 가입 신청을 보냈습니다.`,
          createdAt: request.createdAt,
        }))
      : [];
    return mergeChatMessages(messages, requestMessages);
  }, [isOwner, messages, pendingJoinRequests]);
  const visibleMessages = combinedMessages.filter((item) => {
    if (item.kind !== "secret") return true;
    return item.mine || item.recipient === myDisplayName || isSuperAdmin;
  });
  useEffect(() => {
    const recentAvatarUris = [...visibleMessages]
      .reverse()
      .filter((item) => item.kind !== "system" && Boolean(item.avatarUri))
      .map((item) => ("avatarUri" in item ? item.avatarUri : undefined))
      .filter((uri): uri is string => Boolean(uri))
      .slice(0, 5);
    const memberAvatarUris = roomMembers
      .map((member) => member.avatarUri)
      .filter((uri): uri is string => Boolean(uri));
    [...new Set([...recentAvatarUris, ...memberAvatarUris])]
      .slice(0, 24)
      .forEach((uri) => ExpoImage.prefetch(uri).catch(() => undefined));
  }, [roomMembers, visibleMessages.length]);
  const usesServerReadReceipt = Boolean(
    isSupabaseConfigured && isUuid(room.id),
  );
  const readStorageKey = `mute:last-read:${currentUserId ?? "local"}:${room.id}`;
  const latestReadableMessageId =
    [...visibleMessages].reverse().find((item) => isUuid(item.id))?.id ?? null;
  useEffect(() => {
    latestReadableMessageIdRef.current = latestReadableMessageId;
  }, [latestReadableMessageId]);
  useEffect(() => {
    if (!chatReady || !initialMessagesLoaded || !latestReadableMessageId)
      return;
    onReadRef.current?.(room.id);
    void (usesServerReadReceipt
      ? markRoomRead(room.id, latestReadableMessageId)
      : AsyncStorage.setItem(readStorageKey, latestReadableMessageId)
    ).catch(() => undefined);
  }, [
    chatReady,
    initialMessagesLoaded,
    latestReadableMessageId,
    readStorageKey,
    room.id,
    usesServerReadReceipt,
  ]);
  const computedUnreadMarkerId = useMemo(() => {
    if (!readBoundaryLoaded || !readBoundaryId) return null;
    const boundaryIndex = visibleMessages.findIndex(
      (item) => item.id === readBoundaryId,
    );
    const candidates = visibleMessages.slice(
      boundaryIndex >= 0 ? boundaryIndex + 1 : 0,
    );
    return (
      candidates.find((item) => item.kind !== "system" && !item.mine)?.id ??
      null
    );
  }, [readBoundaryId, readBoundaryLoaded, visibleMessages]);
  useEffect(() => {
    if (!readBoundaryLoaded || !initialMessagesLoaded || entryUnreadResolvedRef.current)
      return;
    entryUnreadResolvedRef.current = true;
    setEntryUnreadMarkerId(computedUnreadMarkerId);
  }, [computedUnreadMarkerId, initialMessagesLoaded, readBoundaryLoaded]);
  const unreadMarkerId = entryUnreadMarkerId;
  useEffect(() => {
    let active = true;
    setReadBoundaryLoaded(false);
    setReadBoundaryId(null);
    setEntryUnreadMarkerId(null);
    entryUnreadResolvedRef.current = false;
    const load = usesServerReadReceipt
      ? getRoomReadReceipt(room.id).then(
          (value) => value?.lastReadMessageId ?? null,
        )
      : AsyncStorage.getItem(readStorageKey);
    load
      .then((value) => {
        if (active) {
          setReadBoundaryId(value);
          setReadBoundaryLoaded(true);
        }
      })
      .catch(() => {
        if (active) setReadBoundaryLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [readStorageKey, room.id, usesServerReadReceipt]);
  useEffect(() => {
    return () => {
      const latest = latestReadableMessageIdRef.current;
      if (!latest) return;
      onRead?.(room.id);
      (usesServerReadReceipt
        ? markRoomRead(room.id, latest)
        : AsyncStorage.setItem(readStorageKey, latest)
      ).catch(() => undefined);
    };
  }, [readStorageKey, room.id, usesServerReadReceipt]);
  useEffect(() => {
    unreadFocusDoneRef.current = false;
  }, [room.id, initialFocusUnread]);
  useEffect(() => {
    if (
      !initialFocusUnread ||
      unreadFocusDoneRef.current ||
      !chatReady ||
      !unreadMarkerId
    )
      return;
    unreadFocusDoneRef.current = true;
    setTimeout(() => scrollToMessagePosition(unreadMarkerId), 120);
  }, [chatReady, initialFocusUnread, unreadMarkerId]);
  const latestVisibleMessage = visibleMessages[visibleMessages.length - 1];
  useEffect(() => {
    const latest = latestVisibleMessage;
    const latestId = latest?.id ?? null;
    if (!chatReady || !initialMessagesLoaded) {
      lastObservedLatestMessageIdRef.current = latestId;
      return;
    }
    if (!latestId || latestId === lastObservedLatestMessageIdRef.current)
      return;
    lastObservedLatestMessageIdRef.current = latestId;
    if (!latest || latest.kind === "system" || latest.mine) return;
    if (nearBottomRef.current) scrollToLatest();
    else
      setNewMessagePreview({
        name: latest.name,
        text:
          latest.kind === "text"
            ? latest.text
            : latest.kind === "image"
              ? "사진을 보냈습니다."
              : latest.kind === "story"
                ? "스토리를 올렸습니다."
                : "비밀 쪽지가 도착했습니다.",
      });
  }, [
    chatReady,
    initialMessagesLoaded,
    latestVisibleMessage?.id,
    latestVisibleMessage?.kind,
    latestVisibleMessage && "mine" in latestVisibleMessage
      ? latestVisibleMessage.mine
      : undefined,
    latestVisibleMessage && "name" in latestVisibleMessage
      ? latestVisibleMessage.name
      : undefined,
    latestVisibleMessage && "text" in latestVisibleMessage
      ? latestVisibleMessage.text
      : undefined,
  ]);
  const chatSearchMatches = chatSearchResults;
  const activeSearchMessage = chatSearchMatches[chatSearchCursor];
  const chatSearchBusy = chatSearchLoading || chatSearchNavigating;
  const clearChatSearchNavigationTimers = () => {
    chatSearchNavigationTimerRefs.current.forEach((timer) =>
      clearTimeout(timer),
    );
    chatSearchNavigationTimerRefs.current = [];
  };
  const cancelChatSearchNavigation = () => {
    chatSearchNavigationSeqRef.current += 1;
    clearChatSearchNavigationTimers();
    setChatSearchNavigating(false);
  };
  const retryScrollToMessagePosition = (messageId: string, seq: number) => {
    clearChatSearchNavigationTimers();
    const delays = [40, 120, 240, 420];
    delays.forEach((delay, index) => {
      const timer = setTimeout(() => {
        if (chatSearchNavigationSeqRef.current !== seq) return;
        const moved = scrollToMessagePosition(messageId);
        if (moved || index === delays.length - 1) {
          clearChatSearchNavigationTimers();
          setChatSearchNavigating(false);
        }
      }, delay);
      chatSearchNavigationTimerRefs.current.push(timer);
    });
  };
  useEffect(() => () => clearChatSearchNavigationTimers(), []);
  useEffect(() => {
    setChatSearchCursor(0);
    setChatSearchResults([]);
  }, [chatSearch]);
  useEffect(() => {
    if (!activeSearchMessage) {
      setChatSearchNavigating(false);
      return;
    }
    const seq = chatSearchNavigationSeqRef.current + 1;
    chatSearchNavigationSeqRef.current = seq;
    setChatSearchNavigating(true);
    void jumpToMessage(activeSearchMessage.id).finally(() => {
      if (chatSearchNavigationSeqRef.current !== seq) return;
      retryScrollToMessagePosition(activeSearchMessage.id, seq);
    });
  }, [activeSearchMessage?.id]);
  const runChatSearch = async () => {
    const keyword = chatSearch.trim();
    cancelChatSearchNavigation();
    if (keyword.length < 2) {
      setChatSearchResults([]);
      setChatSearchCursor(0);
      Alert.alert("검색어를 2글자 이상 입력해주세요.");
      return;
    }
    if (!isUuid(room.id)) {
      const localResults = combinedMessages
        .filter(
          (item): item is Extract<ChatMessage, { kind: "text" }> =>
            item.kind === "text" &&
            item.text.toLowerCase().includes(keyword.toLowerCase()),
        )
        .reverse()
        .map((item) => ({
          id: item.id,
          createdAt: item.createdAt ?? new Date().toISOString(),
          text: item.text,
        }));
      setChatSearchResults(localResults);
      setChatSearchCursor(0);
      return;
    }
    setChatSearchLoading(true);
    try {
      const rows = (await searchRoomMessages(room.id, keyword)) as Array<{
        id: string;
        body: string | null;
        created_at: string;
      }>;
      setChatSearchResults(
        rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          text: row.body ?? "",
        })),
      );
      setChatSearchCursor(0);
    } catch (error) {
      Alert.alert("검색 실패", serverErrorMessage(error));
    } finally {
      setChatSearchLoading(false);
    }
  };
  const moveSearch = (delta: number) => {
    if (!chatSearchMatches.length || chatSearchBusy) return;
    setChatSearchCursor(
      (value) =>
        (value + delta + chatSearchMatches.length) % chatSearchMatches.length,
    );
  };
  if (imageEditorAssets)
    return (
      <ChatImageEditor
        assets={imageEditorAssets}
        onBack={() => setImageEditorAssets(null)}
        onSend={(assets) => {
          setImageEditorAssets(null);
          void uploadImageMessage(assets);
        }}
      />
    );
  if (profileMember)
    return (
      <MemberProfile
        member={profileMember}
        room={room}
        viewerRole={myRole}
        editable={Boolean(profileMember.mine)}
        startEditMode={profileEditOnOpen}
        onBack={() => {
          initialScrollDone.current = false;
          restoreScrollAfterPanelRef.current = true;
          setChatReady(false);
          setProfileMember(null);
          setProfileEditOnOpen(false);
        }}
        onSaved={(updated) => {
          setProfileMember(updated);
          setRoomMembers((items) =>
            items.map((item) =>
              item.userId === updated.userId || (item.mine && updated.mine)
                ? updated
                : item,
            ),
          );
          setMessages((items) =>
            items.map((item) =>
              item.kind !== "system" &&
              ((updated.userId && item.name === profileMember.name) ||
                (updated.mine && item.mine))
                ? {
                    ...item,
                    name: updated.name,
                    avatarUri: updated.avatarUri,
                  }
                : item,
            ),
          );
        }}
        availablePoints={points}
        onHeart={() => sendHeart(profileMember.name)}
        onPoint={(amount) => sendPointTo(profileMember, amount)}
        onSecret={(body) => sendSecretTo(profileMember, body)}
      />
    );
  if (customColorTarget)
    return (
      <CustomColorScreen
        target={customColorTarget.target}
        productId={customColorTarget.productId}
        initialColor={customColorTarget.target === "bubble" ? bubbleColor : customColorTarget.target==="text"?textColor:effectiveChatBackground}
        entitlements={chatEntitlements}
        onEntitlementsChange={setChatEntitlements}
        onBack={() => setCustomColorTarget(null)}
        onComplete={(color,productId) => {
          if (customColorTarget.target === "bubble") {setBubbleColor(color);setBubbleProductId(productId);}
          else if(customColorTarget.target==="text"){setTextColor(color);setTextProductId(productId);}
          else {setChatBackground(color);setBackgroundProductId(productId);}
          listActiveChatEntitlements().then(setChatEntitlements).catch(()=>undefined);
          setCustomColorTarget(null);
        }}
      />
    );
  const addStoryPreview = async (story: StoryItem) => {
    const preview = story.blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ")
      .slice(0, 86);
    const imageUri = story.blocks.find((block) => block.type === "image")?.uri;
    const createdAt = story.createdAt ?? new Date().toISOString();
    try {
      let id = `story-${story.id}-${Date.now()}`;
      setMessages((items) =>
        items.some((item) => item.kind === "story" && item.storyId === story.id)
          ? items
          : [
              ...items,
              {
                id,
                kind: "story",
                mine: story.mine ?? true,
                name: story.author,
                avatarUri: story.authorAvatarUri,
                storyId: story.id,
                title: story.title,
                preview,
                imageUri,
                time: "지금",
                createdAt,
                bubbleColor,
                textColor,
              },
            ],
      );
    } catch (error) {
      Alert.alert("스토리 알림 실패", serverErrorMessage(error));
    }
  };
  const closePanel = () => {
    restoreScrollAfterPanelRef.current = true;
    initialScrollDone.current = false;
    setStoryPanelInitialId(null);
    setStoryPanelInitialWrite(false);
    setChatReady(false);
    setPanel(null);
  };
  const panelTitle =
    panel === "applications"
      ? "가입 신청 목록"
      : panel === "members"
        ? "멤버 관리"
        : panel === "blocked"
          ? "차단 멤버 목록"
          : panel === "profile"
            ? "프로필"
            : "방 공개 설정";
  if (panel === "overview")
    return (
      <RoomDetail
        room={room}
        joined
        currentUserId={currentUserId}
        adminReadOnly={readOnly}
        isSuperAdmin={isSuperAdmin}
        onAdminReportUser={onAdminReportUser}
        pending={false}
        onBack={closePanel}
        onApply={closePanel}
        onEnterChat={closePanel}
        onEdit={onEditRoom}
        enterLabel="채팅방으로 돌아가기"
      />
    );
  if (panel === "stories")
    return (
      <StoryPanel
        room={room}
        joined
        isStaff={isStaff}
        showChatButton={false}
        showInternalHeader
        title="스토리"
        initialSelectedId={storyPanelInitialId ?? undefined}
        initialWrite={storyPanelInitialWrite}
        onClose={closePanel}
        onEnterChat={closePanel}
        onStorySaved={(story) => {
          setStoryPanelInitialWrite(false);
          if (
            !messages.some(
              (item) => item.kind === "story" && item.storyId === story.id,
            )
          )
            void addStoryPreview(story);
        }}
      />
    );
  if (panel)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <TopBar
          title={panelTitle}
          onBack={() => {
            if (panel === "applications" && onApplicationsBack) {
              onApplicationsBack();
              return;
            }
            closePanel();
          }}
        />
        {panel === "applications" ? (
          <JoinRequests room={room} />
        ) : panel === "members" ? (
          <MemberPanel
            room={room}
            isOwner={isOwner}
            isSuperAdmin={isSuperAdmin}
            onAdminReportUser={onAdminReportUser}
            onProfile={setProfileMember}
          />
        ) : panel === "blocked" ? (
          <BlockedMembers room={room} />
        ) : (
          <RoomAccessSettings room={room} onSaved={() => setPanel(null)} />
        )}
      </SafeAreaView>
    );
  const selectedRoomMember = roomMembers.find(
    (item) => item.name === selectedMember,
  );
  const selectedMemberMuted=Boolean(selectedRoomMember?.mutedUntil&&Date.parse(selectedRoomMember.mutedUntil)>Date.now());
  const chatAccentColor = (color?: string) =>
    color && color.toLowerCase() !== colors.text.toLowerCase()
      ? color
      : colors.mint700;
  const storyThemeAccent =
    appTheme.id === "white"
      ? "#1C1C1C"
      : appTheme.id === "dark"
        ? "#F2F2F2"
        : appTheme.accent;
  const finishRoomDelete = () => {
    setDrawerOpen(false);
    setToast("방이 삭제되었습니다.");
    setTimeout(() => {
      onDeleted?.(room.id);
      if (!onDeleted) onBack();
    }, 350);
  };
  const confirmRoomDeleted = async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const remainingRoom = await getRoomById(room.id);
        return remainingRoom === null;
      } catch (error) {
        lastError = error;
        if (attempt < 2)
          await new Promise((resolve) => setTimeout(resolve, 180));
      }
    }
    if (lastError) throw lastError;
    return false;
  };
  const submitRoomDelete = async () => {
    if (roomDeleteSubmitting) {
      setToast("방 삭제를 처리하는 중입니다.");
      setTimeout(() => setToast(""), 1400);
      return;
    }
    if (!isUuid(room.id)) {
      Alert.alert("방 삭제 실패", "서버에 생성된 방만 삭제할 수 있습니다.");
      return;
    }
    setRoomDeleteSubmitting(true);
    setToast("방을 삭제하는 중입니다.");
    try {
      await withTimeout(
        deleteRoom(room.id),
        20000,
        "방 삭제 요청 시간이 초과되었습니다.",
      );
      finishRoomDelete();
    } catch (error) {
      // A committed request can still lose its response. Reconcile with the
      // server before showing a false failure to the user.
      const deleted = await confirmRoomDeleted().catch(() => false);
      if (deleted) finishRoomDelete();
      else {
        setToast("");
        Alert.alert("방 삭제 실패", serverErrorMessage(error));
      }
    } finally {
      setRoomDeleteSubmitting(false);
    }
  };
  const muteSelectedMember=(seconds:number,label:string)=>{
    if(!selectedRoomMember?.userId)return;
    setRoomMemberMute(room.id,selectedRoomMember.userId,seconds).then((until)=>{setRoomMembers((items)=>items.map((item)=>item.userId===selectedRoomMember.userId?{...item,mutedUntil:until}:item));setSelectedMember(null);setToast(`${selectedRoomMember.name}님을 ${label} 동안 채팅 금지했습니다.`);setTimeout(()=>setToast(""),1800);}).catch((error)=>Alert.alert("채팅 금지 실패",serverErrorMessage(error)));
  };
  const openSelectedMemberMute=()=>Alert.alert("채팅 금지 기간 선택",undefined,[{text:"10초",onPress:()=>muteSelectedMember(10,"10초")},{text:"30초",onPress:()=>muteSelectedMember(30,"30초")},{text:"1분",onPress:()=>muteSelectedMember(60,"1분")},{text:"5분",onPress:()=>muteSelectedMember(300,"5분")},{text:"10분",onPress:()=>muteSelectedMember(600,"10분")},{text:"1시간",onPress:()=>muteSelectedMember(3600,"1시간")},{text:"취소",style:"cancel"}]);
  const unmuteSelectedMember=()=>{if(!selectedRoomMember?.userId)return;clearRoomMemberMute(room.id,selectedRoomMember.userId).then(()=>{setRoomMembers((items)=>items.map((item)=>item.userId===selectedRoomMember.userId?{...item,mutedUntil:null}:item));setSelectedMember(null);}).catch((error)=>Alert.alert("채팅 금지 해제 실패",serverErrorMessage(error)));};
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <TopBar
        title={`[${room.name}]`}
        inlineCount={room.memberCount}
        onBack={onBack}
        edgeBackEnabled={false}
        secondaryTrailing="search"
        onSecondaryTrailingPress={() => {
          setChatSearchOpen((value) => !value);
          setChatSearch("");
          setChatSearchResults([]);
        }}
        trailing="menu"
        onTrailingPress={() => {
          rememberScrollPosition();
          Keyboard.dismiss();
          setTool(null);
          setChatSearchOpen(false);
          readOnly && !isSuperAdmin ? openPanel("members") : setDrawerOpen(true);
        }}
      />
      {chatSearchOpen && (
        <View style={s.chatSearchBar}>
          <TextInput
            autoFocus
            value={chatSearch}
            onChangeText={setChatSearch}
            onSubmitEditing={runChatSearch}
            placeholder="이 방의 채팅 검색"
            placeholderTextColor={colors.textMuted}
            style={s.chatSearchInput}
          />
          <Pressable
            disabled={chatSearchBusy}
            onPress={runChatSearch}
            style={s.chatSearchButtonWrap}
          >
            <LinearGradient
              colors={
                appTheme.id === "white"
                  ? ["#F6F6F6", "#F6F6F6"]
                  : appTheme.id === "dark"
                    ? ["#222222", "#222222"]
                    : ["#82B9C1", "#5DBB8C"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                s.chatSearchButton,
                appTheme.id === "white" && s.chatSearchButtonWhite,
                chatSearchBusy && s.chatSearchButtonDisabled,
              ]}
            >
              {chatSearchBusy ? (
                <ActivityIndicator
                  size="small"
                  color={appTheme.id === "white" ? "#1C1C1C" : "#fff"}
                />
              ) : (
                <Ionicons
                  name="search"
                  size={18}
                  color={appTheme.id === "white" ? "#1C1C1C" : "#fff"}
                />
              )}
            </LinearGradient>
          </Pressable>
          <Text
            style={[
              s.chatSearchCount,
              {
                color:
                  appTheme.id === "white"
                    ? "#1C1C1C"
                    : appTheme.id === "dark"
                      ? "#F2F2F2"
                      : appTheme.accent,
              },
            ]}
          >
            {chatSearchMatches.length
              ? `${chatSearchCursor + 1}/${chatSearchMatches.length}`
              : "0건"}
          </Text>
          <Pressable
            disabled={!chatSearchMatches.length || chatSearchBusy}
            onPress={() => moveSearch(1)}
            style={s.chatSearchNav}
          >
            <Ionicons
              name="chevron-up"
              size={19}
              color={
                chatSearchMatches.length && !chatSearchBusy
                  ? colors.textSubtle
                  : colors.gray300
              }
            />
          </Pressable>
          <Pressable
            disabled={!chatSearchMatches.length || chatSearchBusy}
            onPress={() => moveSearch(-1)}
            style={s.chatSearchNav}
          >
            <Ionicons
              name="chevron-down"
              size={19}
              color={
                chatSearchMatches.length && !chatSearchBusy
                  ? colors.textSubtle
                  : colors.gray300
              }
            />
          </Pressable>
          <Pressable
            onPress={() => {
              cancelChatSearchNavigation();
              setChatSearchOpen(false);
              setChatSearch("");
              setChatSearchResults([]);
            }}
            style={s.chatSearchNav}
          >
            <Ionicons name="close" size={20} color={colors.textSubtle} />
          </Pressable>
        </View>
      )}
      <KeyboardAvoidingView
        style={[s.flex, { backgroundColor: effectiveChatBackground }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {readOnly && (
          <View style={s.readOnlyBanner}>
            <Ionicons name="eye-outline" size={15} color={colors.mint700} />
            <Text style={s.readOnlyText}>관리자 읽기 전용 조회</Text>
          </View>
        )}
        <ScrollView
          ref={chatScrollRef}
          style={{
            backgroundColor: effectiveChatBackground,
            opacity: chatReady ? 1 : 0,
          }}
          contentContainerStyle={s.messages}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onLayout={(event) => {
            scrollMetrics.current.layoutHeight = event.nativeEvent.layout.height;
            if (!keyboardOpenedAtBottomRef.current) return;
            requestAnimationFrame(() =>
              requestAnimationFrame(() => scrollToLatestRef.current(false)),
            );
          }}
          onTouchStart={() => {
            Keyboard.dismiss();
            if (tool) setTool(null);
            if (selectedMember) setSelectedMember(null);
          }}
          scrollEventThrottle={80}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } =
              event.nativeEvent;
            scrollMetrics.current = {
              layoutHeight: layoutMeasurement.height,
              contentHeight: contentSize.height,
              offsetY: contentOffset.y,
            };
            if (
              chatReady &&
              contentOffset.y <= 24 &&
              contentSize.height > layoutMeasurement.height + 20
            )
              void loadOlderMessages();
            nearBottomRef.current =
              contentSize.height - layoutMeasurement.height - contentOffset.y <
              120;
            ROOM_SCROLL_STATE.set(room.id, {
              offsetY: contentOffset.y,
              nearBottom: nearBottomRef.current,
            });
            setShowScrollToBottom(!nearBottomRef.current);
            if (nearBottomRef.current && newMessagePreview)
              setNewMessagePreview(null);
          }}
          onContentSizeChange={(width, height) => {
            if (!initialMessagesLoaded) return;
            if (prependHeightRef.current !== null) {
              const previousHeight = prependHeightRef.current;
              const previousOffset =
                prependOffsetRef.current ?? scrollMetrics.current.offsetY;
              prependHeightRef.current = null;
              prependOffsetRef.current = null;
              prependAnchorRef.current = null;
              const delta = Math.max(0, height - previousHeight);
              const nextY = Math.max(0, previousOffset + delta);
              requestAnimationFrame(() => {
                chatScrollRef.current?.scrollTo({
                  y: nextY,
                  animated: false,
                });
                scrollMetrics.current.offsetY = nextY;
              });
              scrollMetrics.current.contentHeight = height;
              return;
            }
            scrollMetrics.current.contentHeight = height;
            if (!initialScrollDone.current) {
              initialScrollDone.current = true;
              const saved = ROOM_SCROLL_STATE.get(room.id);
              if (
                restoreScrollAfterPanelRef.current &&
                saved &&
                !saved.nearBottom
              ) {
                restoreScrollAfterPanelRef.current = false;
                chatScrollRef.current?.scrollTo({
                  y: Math.max(0, saved.offsetY),
                  animated: false,
                });
                setChatReady(true);
                return;
              }
              restoreScrollAfterPanelRef.current = false;
              chatScrollRef.current?.scrollToEnd({ animated: false });
              requestAnimationFrame(() => setChatReady(true));
            } else if (nearBottomRef.current) scrollToLatest(false);
          }}
        >
          {visibleMessages.map((item, index) => {
            const previousMessage = visibleMessages[index - 1];
            const currentDateValue = item.createdAt ?? room.createdAt;
            const previousDateValue =
              previousMessage?.createdAt ?? room.createdAt;
            const dateMarker =
              !previousMessage ||
              chatDateKey(currentDateValue) !==
                chatDateKey(previousDateValue) ? (
                <Text key={`date-${item.id}`} style={s.date}>
                  {formatDateLine(currentDateValue)}
                </Text>
              ) : null;
            const unreadMarker =
              unreadMarkerId === item.id ? (
                <View key={`unread-${item.id}`} style={s.unreadMarker}>
                  <View style={[s.unreadLine, appTheme.id === "dark" && s.unreadLineDark]} />
                  <Text style={[s.unreadText, appTheme.id === "dark" && s.unreadTextDark]}>
                    여기까지 읽었어요
                  </Text>
                  <View style={[s.unreadLine, appTheme.id === "dark" && s.unreadLineDark]} />
                </View>
              ) : null;
            if (item.kind === "system")
              return (
                <View key={item.id}>
                  {dateMarker}
                  {unreadMarker}
                  <SystemMessage event={item.event} text={item.text} />
                </View>
              );
            if (item.kind === "story")
              return (
                <View key={item.id}>
                  {dateMarker}
                  {unreadMarker}
                  <View
                    style={[
                      s.messageRow,
                      item.mine && s.mineRow,
                      s.continuousRow,
                    ]}
                  >
                    {!item.mine && (
                      <Pressable
                        accessibilityLabel={`${item.name} 프로필 메뉴`}
                        onPress={() => {
                          openActiveMemberProfile(item);
                        }}
                      >
                        <Avatar uri={item.avatarUri} size={46} />
                      </Pressable>
                    )}
                    <View
                      style={[s.messageBlock, item.mine && s.mineMessageBlock]}
                    >
                      <Text style={[s.sender, item.mine && s.mineSender]}>
                        {item.name}
                      </Text>
                      <View
                        style={[s.bubbleLine, item.mine && s.mineBubbleLine]}
                      >
                        {item.mine && (
                          <Text numberOfLines={1} style={s.time}>
                            {item.time}
                          </Text>
                        )}
                        <Pressable
                          preserveTheme
                          onPress={() => {
                            rememberScrollPosition();
                            initialScrollDone.current = false;
                            setStoryPanelInitialWrite(false);
                            setStoryPanelInitialId(item.storyId);
                            setPanel("stories");
                          }}
                          style={[
                            s.bubble,
                              {
                                backgroundColor:
                                  item.bubbleColor ??
                                  (item.mine ? bubbleColor : "#F5F5F5"),
                              },
                              item.mine
                                ? { borderBottomRightRadius: 4 }
                                : { borderBottomLeftRadius: 4 },
                            s.storyBubble,
                          ]}
                        >
                          {item.imageUri && (
                            <ExpoImage
                              source={{ uri: item.imageUri }}
                              contentFit="cover"
                              style={s.storyChatPreviewImage}
                            />
                          )}
                          <View style={s.storyChatPreviewHead}>
                            <RNIonicons
                              name="albums-outline"
                              size={16}
                              color={storyThemeAccent}
                            />
                            <RNText
                              style={[
                                s.storyChatPreviewLabel,
                                { color: storyThemeAccent },
                              ]}
                            >
                              {item.name}님이 스토리를 올렸습니다.
                            </RNText>
                          </View>
                          <RNText
                            numberOfLines={1}
                            style={s.storyChatPreviewTitle}
                          >
                            {item.title}
                          </RNText>
                          <RNText
                            numberOfLines={2}
                            style={[
                              s.storyChatPreviewBody,
                              {
                                color:
                                  item.textColor ??
                                  (item.mine ? textColor : colors.text),
                              },
                            ]}
                          >
                            {item.preview}
                          </RNText>
                          <RNText style={s.storyChatPreviewMore}>바로가기</RNText>
                        </Pressable>
                        {!item.mine && (
                          <Text numberOfLines={1} style={s.time}>
                            {item.time}
                          </Text>
                        )}
                      </View>
                    </View>
                    {item.mine && (
                      <Pressable
                        accessibilityLabel={`${item.name} 프로필 메뉴`}
                        onPress={() => {
                          openActiveMemberProfile(item);
                        }}
                      >
                        <Avatar uri={item.avatarUri} size={46} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            const previous = visibleMessages[index - 1];
            const continuous = Boolean(
              previous &&
              previous.kind !== "system" &&
              previous.kind !== "story" &&
              previous.mine === item.mine &&
              previous.name === item.name &&
              sameChatMinute(previous.createdAt, item.createdAt),
            );
            const next = visibleMessages[index + 1];
            const continuesNext = Boolean(
              next &&
              next.kind !== "system" &&
              next.kind !== "story" &&
              next.mine === item.mine &&
              next.name === item.name &&
              sameChatMinute(item.createdAt, next.createdAt),
            );
            const expanded = expandedMessages.includes(item.id);
            const shouldCollapse =
              item.kind === "text" &&
              item.text.length >= CHAT_COLLAPSE_CHAR_THRESHOLD;
            const deliveryMeta = (
              <ChatDeliveryMeta
                item={
                  item as Extract<
                    ChatMessage,
                    { kind: "text" | "image" | "secret" }
                  >
                }
                showTime={!continuesNext}
                onRetry={() =>
                  retryMessage(
                    item as Extract<ChatMessage, { kind: "text" | "image" }>,
                  )
                }
                onDelete={() => deletePendingMessage(item.id)}
              />
            );
            return (
              <View
                key={item.id}
                onLayout={(event) => {
                  messagePositions.current[item.id] =
                    event.nativeEvent.layout.y;
                }}
              >
                {dateMarker}
                {unreadMarker}
                <View
                  style={[
                    s.messageRow,
                    item.mine && s.mineRow,
                    continuous && s.continuousRow,
                  ]}
                >
                  {!item.mine ? (
                    !continuous ? (
                      <Pressable
                        accessibilityLabel={`${item.name} 프로필 메뉴`}
                        onPress={() => {
                          openActiveMemberProfile(item);
                        }}
                      >
                        <Avatar uri={item.avatarUri} size={46} />
                      </Pressable>
                    ) : (
                      <View style={s.avatarSpacer} />
                    )
                  ) : null}
                  <View
                    style={[s.messageBlock, item.mine && s.mineMessageBlock]}
                  >
                    {!continuous && (
                      <Text style={[s.sender, item.mine && s.mineSender]}>
                        {item.name}
                      </Text>
                    )}
                    <View
                      style={[
                        s.bubbleLine,
                        s.tightBubbleLine,
                        item.mine && s.mineBubbleLine,
                      ]}
                    >
                      {item.mine && deliveryMeta}
                      <Pressable
                        preserveTheme
                        onLongPress={() =>
                          item.kind === "image"
                            ? undefined
                            : messageActions(
                                item as Extract<
                                  ChatMessage,
                                  { kind: "text" | "secret" }
                                >,
                              )
                        }
                        style={[
                          s.bubble,
                          item.kind === "image" && s.imageBubble,
                          activeSearchMessage?.id === item.id &&
                            s.searchBubbleActive,
                          jumpHighlightId === item.id && s.searchBubbleActive,
                          {
                            backgroundColor:
                              item.bubbleColor ??
                              (item.mine ? bubbleColor : "#F5F5F5"),
                          },
                          item.mine
                            ? { borderBottomRightRadius: 4 }
                            : { borderBottomLeftRadius: 4 },
                        ]}
                      >
                        {item.replyTo && (
                          <Pressable
                            preserveTheme
                            onPress={() => jumpToMessage(item.replyTo!.id)}
                            style={[
                              s.replyQuote,
                              {
                                borderLeftColor:
                                  chatAccentColor(
                                    item.textColor ?? (item.mine ? textColor : undefined),
                                  ),
                              },
                            ]}
                          >
                            <RNText
                              style={[
                                s.replyQuoteName,
                                {
                                  color:
                                    chatAccentColor(
                                      item.textColor ?? (item.mine ? textColor : undefined),
                                    ),
                                },
                              ]}
                            >
                              {replyLabel(item.replyTo.name, myDisplayName)}
                            </RNText>
                            <RNText numberOfLines={1} style={s.replyQuoteText}>
                              {item.replyTo.text}
                            </RNText>
                          </Pressable>
                        )}
                        {item.kind === "image" ? (
                          item.imageUris?.length ? (
                            <ImageGrid
                              uris={item.imageUris}
                              disabled={item.delivery === "sending"}
                              onReply={() => messageActions(item)}
                              onPress={(_uri, index) =>
                                setPhotoViewer({
                                  uris: item.imageUris ?? [],
                                  index,
                                  menuOpen: false,
                                })
                              }
                            />
                          ) : (
                            <View style={s.imagePlaceholder}>
                              <Ionicons
                                name="image-outline"
                                size={30}
                                color={colors.gray300}
                              />
                            </View>
                          )
                        ) : item.kind === "secret" ? (
                          <View style={s.secretContent}>
                            <View style={s.secretLabel}>
                              <RNIonicons
                                name="lock-closed"
                                size={12}
                                color={colors.pink600}
                              />
                              <RNText style={s.secretLabelText}>
                                {item.recipient}님에게만 보이는 쪽지
                              </RNText>
                            </View>
                            <LinkedText
                              preserveColor
                              style={[
                                s.messageText,
                                {
                                  color:
                                    item.textColor ??
                                    (item.mine ? textColor : colors.text),
                                },
                              ]}
                            >
                              {item.text}
                            </LinkedText>
                          </View>
                        ) : (
                          <View>
                            {item.text === "삭제된 메시지입니다." ? (
                              <View style={s.deletedMessageRow}>
                                <Ionicons
                                  name="ban-outline"
                                  size={14}
                                  color={colors.textMuted}
                                />
                                <Text style={s.deletedMessageText}>
                                  삭제된 메시지입니다.
                                </Text>
                              </View>
                            ) : (
                              <LinkedText
                                preserveColor
                                numberOfLines={
                                  expanded || !shouldCollapse
                                    ? undefined
                                    : CHAT_COLLAPSE_LINE_LIMIT
                                }
                                style={[
                                  s.messageText,
                                  {
                                    color:
                                      item.textColor ??
                                      (item.mine ? textColor : colors.text),
                                  },
                                ]}
                              >
                                {item.text}
                              </LinkedText>
                            )}
                            {shouldCollapse && (
                              <Pressable
                                onPress={(event) => {
                                  event.stopPropagation?.();
                                  setExpandedMessages((ids) =>
                                    ids.includes(item.id)
                                      ? ids.filter((id) => id !== item.id)
                                      : [...ids, item.id],
                                  );
                                }}
                              >
                                <RNText
                                  style={[s.expandMessage, { color: "#1C1C1C" }]}
                                >
                                  {expanded ? "접기" : "전체보기"}
                                </RNText>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </Pressable>
                      {!item.mine && deliveryMeta}
                    </View>
                  </View>
                  {item.mine ? (
                    !continuous ? (
                      <Pressable
                        accessibilityLabel={`${item.name} 프로필 메뉴`}
                        onPress={() => {
                          openActiveMemberProfile(item);
                        }}
                      >
                        <Avatar uri={item.avatarUri} size={46} />
                      </Pressable>
                    ) : (
                      <View style={s.avatarSpacer} />
                    )
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
        {!chatReady && (
          <View pointerEvents="none" style={s.chatInitialLoader}>
            <ActivityIndicator color={colors.mint700} />
          </View>
        )}
        {chatReady && chatLoadError ? (
          <View style={s.chatInitialLoader}>
            <Text style={s.centerStateText}>채팅을 불러오지 못했어요.</Text>
            <Text style={s.centerStateText}>{chatLoadError}</Text>
            <Pressable
              onPress={() => setChatReloadNonce((value) => value + 1)}
              style={{ paddingHorizontal: 18, paddingVertical: 10 }}
            >
              <Text style={{ color: activeAppTheme.accent, fontWeight: "600" }}>
                다시 시도
              </Text>
            </Pressable>
          </View>
        ) : null}
        {loadingOlder && (
          <View pointerEvents="none" style={s.olderMessagesLoaderOverlay}>
            <ActivityIndicator color={colors.mint700} />
          </View>
        )}
        {newMessagePreview && (
          <Pressable
            onPress={() => scrollToLatest(false)}
            style={[
              s.newMessagePreview,
              appTheme.id === "dark" && s.newMessagePreviewDark,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                s.newMessagePreviewName,
                appTheme.id === "dark" && s.newMessagePreviewTextDark,
              ]}
            >
              {newMessagePreview.name}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                s.newMessagePreviewText,
                appTheme.id === "dark" && s.newMessagePreviewTextDark,
              ]}
            >
              {newMessagePreview.text}
            </Text>
          </Pressable>
        )}
        {showScrollToBottom && (
          <Pressable
            accessibilityLabel="가장 최근 메시지로 이동"
            onPress={() => scrollToLatest()}
            style={s.scrollToBottomButton}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
        {!chatSearchOpen && (
          <>
            {!readOnly && (
              <ComposerPanel
                tool={tool}
                showPromotion={isOwner && !room.isAdult}
                promotionRemainingMs={Math.max(0,promotionAvailableAt-Date.now())}
                onCamera={() => sendImage("camera")}
                onGallery={() => sendImage("gallery")}
                onTopSpace={() => {
                  setTool(null);
                  setTopSpaceOpen(true);
                }}
                onPromotion={openPromotion}
                onNewStory={() => {
                  rememberScrollPosition();
                  initialScrollDone.current = false;
                  setTool(null);
                  setStoryPanelInitialId(null);
                  setStoryPanelInitialWrite(true);
                  setPanel("stories");
                }}
                onComingSoon={(label) => {
                  setTool(null);
                  setToast("아직 준비 중인 기능입니다.");
                  setTimeout(() => setToast(""), 1800);
                }}
                secretDraft={secretDraft}
                onSecretDraft={setSecretDraft}
                onSendSecret={sendSecret}
                bubbleColor={bubbleColor}
                textColor={textColor}
                backgroundColor={effectiveChatBackground}
                bubbleProductId={bubbleProductId}
                textProductId={textProductId}
                backgroundProductId={backgroundProductId}
                onBubbleColor={(color,productId)=>{setBubbleColor(color);setBubbleProductId(productId);}}
                onTextColor={(color,productId)=>{setTextColor(color);setTextProductId(productId);}}
                onBackgroundColor={(color,productId)=>{setChatBackground(color);setBackgroundProductId(productId);}}
                onCustomColor={(target)=>{const productId=nextCustomProductId(chatEntitlements,target);if(!productId){setToast("커스텀 색상은 최대 10개까지 보유할 수 있습니다.");setTimeout(()=>setToast(""),1800);return;}rememberScrollPosition();initialScrollDone.current=false;setCustomColorTarget({target,productId});}}
                entitlements={chatEntitlements}
                onEntitlementsChange={setChatEntitlements}
              />
            )}
            {!readOnly && replyTo && (
              <View style={s.replyComposer}>
                <View style={s.flex}>
                  <Text style={s.replyComposerName}>
                    {replyLabel(replyTo.name, myDisplayName)}
                  </Text>
                  <Text numberOfLines={1} style={s.replyComposerText}>
                    {replyTo.text}
                  </Text>
                </View>
                <Pressable onPress={() => setReplyTo(null)}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            )}
            {!readOnly && (
              <View
                style={
                  androidChatBottomInset
                    ? { paddingBottom: androidChatBottomInset }
                    : undefined
                }
                onLayout={() => {
                  if (!keyboardOpenedAtBottomRef.current) return;
                  requestAnimationFrame(() => scrollToLatestRef.current(false));
                }}
              >
                <View style={s.composer}>
                <RNPressable
                  hitSlop={18}
                  accessibilityLabel="채팅 더보기"
                  onPress={() => {
                    setSelectedMember(null);
                    setReplyTo(null);
                    setDrawerOpen(false);
                    setChatSearchOpen(false);
                    Keyboard.dismiss();
                    setTool((value) => (value === "media" ? null : "media"));
                  }}
                  style={themedStyle(
                    [s.iconCircle, tool === "media" && s.iconCircleActive],
                    "view",
                  )}
                >
                  <Ionicons
                    name={tool === "media" ? "close" : "add"}
                    size={22}
                    color={tool === "media" ? colors.mint700 : colors.textSubtle}
                  />
                </RNPressable>
                <RNPressable
                  hitSlop={18}
                  accessibilityLabel="채팅 색상"
                  onPress={() => {
                    setSelectedMember(null);
                    setReplyTo(null);
                    setDrawerOpen(false);
                    setChatSearchOpen(false);
                    Keyboard.dismiss();
                    setTool((value) => (value === "style" ? null : "style"));
                  }}
                  style={themedStyle(
                    [s.iconCircle, tool === "style" && s.iconCircleActive],
                    "view",
                  )}
                >
                  <Ionicons
                    name="brush-outline"
                    size={22}
                    color={tool === "style" ? colors.mint700 : colors.textSubtle}
                  />
                </RNPressable>
                <TextInput
                  ref={composerInputRef}
                  value={message}
                  onPressIn={prepareComposerFocus}
                  onFocus={() => {
                    prepareComposerFocus();
                    focusComposer();
                  }}
                  onChangeText={setMessage}
                  onSubmitEditing={send}
                  placeholder="메시지를 입력해주세요."
                  placeholderTextColor={colors.textMuted}
                  style={[
                    s.composerInput,
                    Platform.OS === "web" &&
                      ({ outlineStyle: "none" } as object),
                  ]}
                />
                <Pressable
                  disabled={!message.trim()}
                  onPress={send}
                  style={s.send}
                >
                  <LinearGradient
                    colors={
                      message.trim()
                        ? ["#82B9C1", "#5DBB8C"]
                        : ["#C9D8D5", "#BFCAC7"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.sendGradient}
                  >
                    <Ionicons name="paper-plane" size={18} color={themeForeground(appTheme)} />
                  </LinearGradient>
                </Pressable>
                </View>
                {chatKeyboardVisible && !adsDisabled && (
                  <InlineBannerAd
                    placement="chat"
                    dark={appTheme.id === "dark"}
                    reserveSpace
                  />
                )}
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
      <MemberActionSheet
        member={selectedMember}
        avatarUri={selectedRoomMember?.avatarUri}
        selfOnly={Boolean(selectedRoomMember?.mine)}
        readOnly={readOnly}
        canModerate={Boolean(
          selectedRoomMember &&
            !selectedRoomMember.mine &&
            !selectedRoomMember.owner &&
            (isOwner || !selectedRoomMember.coHost),
        )}
        isMuted={selectedMemberMuted}
        onMute={openSelectedMemberMute}
        onUnmute={unmuteSelectedMember}
        secretOpen={tool === "secret"}
        onClose={() => {
          setSelectedMember(null);
          if (tool === "secret") setTool(null);
        }}
        onHeart={() => {
          sendHeart();
          setSelectedMember(null);
        }}
        onPoint={() => {
          setPointTarget(selectedMember);
          setPointTargetMember(selectedRoomMember ?? null);
          setPointDraft("");
          setSelectedMember(null);
        }}
        onSecret={() => setTool("secret")}
        onProfile={() => {
          const found = selectedRoomMember ?? {
            name: selectedMember ?? "멤버",
            intro: "이 방에서 사용하는 프로필입니다.",
          };
          rememberScrollPosition();
          restoreScrollAfterPanelRef.current = true;
          setSelectedMember(null);
          setProfileEditOnOpen(Boolean(found.mine));
          setProfileMember(found);
        }}
        onReport={async () => {
          const found = selectedRoomMember;
          try {
            if (isSuperAdmin && found?.userId) {
              onAdminReportUser(found.userId, found.name);
            } else if (found?.userId && isUuid(found.userId)) {
              const submitted = await confirmReportSubmission({
                targetType: "user",
                targetId: found.userId,
                reason: "other",
                detail: `멤버 신고: ${found.name}`,
              });
              if (!submitted) return;
              Alert.alert("신고 접수 완료", "멤버 신고가 접수되었습니다.");
            } else
              Alert.alert(
                "신고 불가",
                "서버에 생성된 멤버만 신고할 수 있습니다.",
              );
          } catch (error) {
            Alert.alert("신고 실패", serverErrorMessage(error));
          }
          setSelectedMember(null);
        }}
        secretDraft={secretDraft}
        onSecretDraft={setSecretDraft}
        onSendSecret={() => {
          sendSecret();
          setSelectedMember(null);
        }}
      />
      {pointTarget && (
        <View style={s.sheetLayer}>
          <Pressable
            accessibilityLabel="포인트 보내기 닫기"
            onPress={() => {
              if (pointSending) return;
              setPointTarget(null);
              setPointTargetMember(null);
              setPointDraft("");
            }}
            style={s.sheetDim}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
            style={s.sheetKeyboard}
          >
            <View style={s.pointSendSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.pointSendTitle}>
                {pointTarget}님에게 포인트 보내기
              </Text>
              <Text style={s.pointSendBody}>
                1p부터 보유 포인트 {points.toLocaleString()}p까지 보낼 수
                있어요.
              </Text>
              <TextInput
                autoFocus
                value={pointDraft}
                onChangeText={(value) => {
                  if (/^[0-9]*$/.test(value)) setPointDraft(value);
                }}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="보낼 포인트"
                placeholderTextColor={colors.textMuted}
                style={[
                  s.pointSendInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                ]}
              />
              <View style={s.pointSendActions}>
                <Pressable
                  disabled={pointSending}
                  onPress={() => {
                    setPointTarget(null);
                    setPointTargetMember(null);
                    setPointDraft("");
                  }}
                  style={s.pointSendCancel}
                >
                  <Text style={s.pointSendCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  disabled={
                    pointSending ||
                    !pointDraft ||
                    Number(pointDraft) < 1 ||
                    Number(pointDraft) > points
                  }
                  onPress={sendPoint}
                  style={[
                    s.pointSendButton,
                    (pointSending ||
                      !pointDraft ||
                      Number(pointDraft) < 1 ||
                      Number(pointDraft) > points) &&
                      s.disabled,
                  ]}
                >
                  <LinearGradient
                    colors={["#82B9C1", "#5DBB8C"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.pointSendGradient}
                  >
                    <Text style={s.primaryText}>
                      {pointSending ? "전송 중..." : "보내기"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
      {photoViewer && (
        <View {...photoViewerSwipe.panHandlers} style={s.photoViewer}>
          <FlatList
            data={photoViewer.uris}
            horizontal
            pagingEnabled
            initialScrollIndex={photoViewer.index}
            getItemLayout={(_data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            keyExtractor={(uri, index) => `${uri}-${index}`}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setPhotoViewer((current) =>
                current ? { ...current, index, menuOpen: false } : current,
              );
            }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel="사진 닫기"
                onPress={() => setPhotoViewer(null)}
                style={s.photoViewerPage}
              >
                <Pressable
                  onPress={(event) => event.stopPropagation()}
                  style={s.photoViewerPageImageWrap}
                >
                  <ExpoImage
                    source={{ uri: item }}
                    contentFit="contain"
                    style={s.photoViewerExpandedImage}
                  />
                </Pressable>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
          />
          <Pressable
            onPress={() => setPhotoViewer(null)}
            style={s.photoViewerCloseLeft}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
          <Pressable
            onPress={() =>
              setPhotoViewer((current) =>
                current ? { ...current, menuOpen: !current.menuOpen } : current,
              )
            }
            style={s.photoViewerMore}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </Pressable>
          {photoViewer.menuOpen && (
            <View style={s.photoViewerMenu}>
              <Pressable
                onPress={async () => {
                  const saved = await saveImage(
                    photoViewer.uris[photoViewer.index],
                  );
                  if (saved)
                    setPhotoViewer((current) =>
                      current ? { ...current, menuOpen: false } : current,
                    );
                }}
                style={s.photoViewerMenuItem}
              >
                <Text style={s.photoViewerMenuText}>저장하기</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setPhotoViewer((current) =>
                    current ? { ...current, menuOpen: false } : current,
                  );
                  if (!isUuid(room.id)) {
                    Alert.alert(
                      "신고 불가",
                      "서버에 생성된 방의 사진만 신고할 수 있습니다.",
                    );
                    return;
                  }
                  try {
                    const submitted = await confirmReportSubmission({
                      targetType: "room",
                      targetId: room.id,
                      reason: "other",
                      detail: `채팅 이미지 신고: ${room.name}`,
                    });
                    if (!submitted) return;
                    Alert.alert(
                      "신고 접수 완료",
                      "이미지 신고가 접수되었습니다.",
                    );
                  } catch (error) {
                    Alert.alert("신고 실패", serverErrorMessage(error));
                  }
                }}
                style={s.photoViewerMenuItem}
              >
                <Text style={s.photoViewerMenuText}>신고하기</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      <TopSpaceSheet
        open={topSpaceOpen}
        room={room}
        points={points}
        expiresAt={topSpaceExpiresAt}
        remaining={topSpaceRemaining}
        result={boostResult}
        loading={topSpaceSubmitting}
        onClose={() => {
          if (topSpaceSubmitting) return;
          setTopSpaceOpen(false);
          setBoostResult(null);
        }}
        onBoost={async (option) => {
          if (topSpaceSubmitting) return;
          setTopSpaceSubmitting(true);
          try {
            setBoostResult((await onBoost(option)) ? "success" : "shortage");
          } catch (error) {
            Alert.alert("탑스페이스 실패", serverErrorMessage(error));
          } finally {
            setTopSpaceSubmitting(false);
          }
        }}
      />
      <ChatDrawer
        open={drawerOpen}
        roomId={room.id}
        profile={myProfile}
        isOwner={isOwner}
        isStaff={isStaff}
        isSuperAdmin={isSuperAdmin}
        readOnly={readOnly}
        onClose={() => setDrawerOpen(false)}
        onProfileEdit={() => {
          if (!myProfile) {
            setToast("방 프로필을 불러오는 중입니다.");
            setTimeout(() => setToast(""), 1600);
            return;
          }
          rememberScrollPosition();
          restoreScrollAfterPanelRef.current = true;
          setDrawerOpen(false);
          setProfileEditOnOpen(true);
          setProfileMember(myProfile);
        }}
        onApplications={() => {
          setDrawerOpen(false);
          openPanel("applications");
        }}
        onStories={() => {
          setDrawerOpen(false);
          setStoryPanelInitialId(null);
          setStoryPanelInitialWrite(false);
          openPanel("overview");
        }}
        onOpenMembers={() => {
          setDrawerOpen(false);
          openPanel("members");
        }}
        onBlocked={() => {
          setDrawerOpen(false);
          openPanel("blocked");
        }}
        onEditRoom={() => {
          setDrawerOpen(false);
          onEditRoom();
        }}
        onRoomSettings={() => {
          setDrawerOpen(false);
          openPanel("roomSettings");
        }}
        onDelete={() =>
          Alert.alert(
            "방 삭제하기",
            "방을 정말 삭제하시겠습니까? 모든 내역이 삭제됩니다.",
            [
              { text: "취소", style: "cancel" },
              {
                text: "삭제하기",
                style: "destructive",
                onPress: submitRoomDelete,
              },
            ],
          )
        }
        onLeave={() =>
          Alert.alert(
            "방 나가기",
            "방을 정말 나가시겠습니까? 모든 내역이 삭제됩니다.",
            [
              { text: "취소", style: "cancel" },
              {
                text: "나가기",
                style: "destructive",
                onPress: async () => {
                  if (roomExitSubmittingRef.current) return;
                  roomExitSubmittingRef.current = true;
                  try {
                    await leaveRoom(room.id);
                    setDrawerOpen(false);
                    setToast("방에서 나갔습니다.");
                    setTimeout(onBack, 350);
                  } catch (error) {
                    const message = serverErrorMessage(error);
                    Alert.alert(
                      "방 나가기 실패",
                      message.includes("TRANSFER_OWNERSHIP_REQUIRED")
                        ? "방장은 방장 권한을 양도한 뒤 나갈 수 있습니다."
                        : message,
                    );
                  } finally {
                    roomExitSubmittingRef.current = false;
                  }
                },
              },
            ],
          )
        }
      />
      {toast !== "" && (
        <View pointerEvents="none" style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function initialStoryItems(room: Room): StoryItem[] {
  if (SCREENSHOT_DEMO_ENABLED) {
    return [
      {
        id: "demo-story-1",
        roomId: room.id,
        roomName: room.name,
        title: "비 온 뒤의 창가",
        author: "소라",
        authorAvatarUri: "https://i.pravatar.cc/300?img=32",
        createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        visibility: "public",
        blocks: [
          {
            id: "demo-story-1-text-1",
            type: "text",
            text: "비가 그친 뒤 창밖의 색이 유난히 선명했어요. 오늘 발견한 장면들을 남겨봅니다.",
          },
          {
            id: "demo-story-1-image-1",
            type: "image",
            uri: "https://picsum.photos/seed/mute-story-rain/1200/900",
          },
          {
            id: "demo-story-1-text-2",
            type: "text",
            text: "여러분이 발견한 장면도 댓글로 들려주세요.",
          },
        ],
        comments: [
          {
            id: "demo-comment-1",
            author: "준",
            authorAvatarUri: "https://i.pravatar.cc/300?img=12",
            body: "사진 분위기 정말 좋다. 나도 오늘 찍은 사진 올려볼게!",
            createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          },
          {
            id: "demo-comment-2",
            author: "하루",
            authorAvatarUri: "https://i.pravatar.cc/300?img=47",
            body: "빛이 예쁘게 담겼다.",
            createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            mine: true,
          },
        ],
        views: 126,
        hearts: 18,
        liked: true,
      },
      {
        id: "demo-story-2",
        roomId: room.id,
        roomName: room.name,
        title: "오늘의 작은 기록",
        author: "준",
        authorAvatarUri: "https://i.pravatar.cc/300?img=12",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        visibility: "public",
        blocks: [
          {
            id: "demo-story-2-text-1",
            type: "text",
            text: "좋아하는 음악과 따뜻한 커피로 시작한 하루.",
          },
          {
            id: "demo-story-2-image-1",
            type: "image",
            uri: "https://picsum.photos/seed/mute-story-coffee/1200/900",
          },
        ],
        comments: [],
        views: 84,
        hearts: 11,
      },
      {
        id: "demo-story-3",
        roomId: room.id,
        roomName: room.name,
        title: "오늘 발견한 문장",
        author: "하루",
        authorAvatarUri: "https://i.pravatar.cc/300?img=47",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        visibility: "public",
        blocks: [
          {
            id: "demo-story-3-text-1",
            type: "text",
            text: "오래 기억하고 싶은 문장을 만났어요.",
          },
        ],
        comments: [],
        views: 63,
        hearts: 9,
        mine: true,
      },
    ];
  }
  return [
    {
      id: "demo-story-1",
      roomId: room.id,
      roomName: room.name,
      title: "이번 주 오프라인 일정 정리",
      author: "초록윤",
      createdAt: "2026-06-18T10:20:00.000Z",
      visibility: "public",
      blocks: [
        {
          id: "demo-story-1-text-1",
          type: "text",
          text: "토요일 저녁 산책 후보 코스를 정리했습니다. 강변 코스, 공원 코스, 카페 합류 코스 중에서 편한 쪽으로 의견 남겨주세요.",
        },
        {
          id: "demo-story-1-text-2",
          type: "text",
          text: "처음 오는 멤버도 부담 없도록 중간 합류 지점과 우천 시 대체 장소까지 같이 적어두었습니다.",
        },
      ],
      comments: [
        {
          id: "demo-comment-1",
          author: "느린준",
          body: "저는 토요일 저녁이 좋아요. 강변 코스 한 표요.",
          createdAt: "2026-06-18T10:36:00.000Z",
        },
        {
          id: "demo-comment-2",
          author: "해질녘",
          body: "사진 찍기엔 공원 코스가 더 좋아 보여요.",
          createdAt: "2026-06-18T10:44:00.000Z",
        },
      ],
      views: 128,
      hearts: 18,
      liked: false,
      mine: false,
    },
    {
      id: "demo-story-2",
      roomId: room.id,
      roomName: room.name,
      title: "오늘의 분위기 기록",
      author: "나",
      createdAt: "2026-06-17T19:10:00.000Z",
      visibility: "room",
      blocks: [
        {
          id: "demo-story-2-text-1",
          type: "text",
          text: "오늘 대화 분위기가 좋아서 짧게 남겨둡니다. 다음에도 이렇게 편하게 이야기하면 좋겠어요.",
        },
      ],
      comments: [],
      views: 42,
      hearts: 5,
      liked: false,
      mine: true,
    },
  ];
}

function mapServerStory(story: ServerStory, currentUserId?: string): StoryItem {
  return {
    id: story.id,
    roomId: story.roomId,
    roomName: story.roomName,
    title: story.title,
    author: story.author,
    authorAvatarUri: story.authorAvatarUrl,
    createdAt: story.createdAt,
    visibility: story.visibility,
    views: story.viewCount,
    hearts: story.heartCount,
    liked: story.liked,
    blocks: story.blocks.map((block, index) =>
      block.type === "text"
        ? { id: `${story.id}-text-${index}`, type: "text", text: block.text }
        : {
            id: `${story.id}-image-${index}`,
            type: "image",
            uri: block.uri,
            storagePath: block.storagePath,
            mimeType: block.mimeType,
          },
    ),
    comments: story.comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      authorAvatarUri: comment.authorAvatarUrl,
      body: comment.body,
      createdAt: comment.createdAt,
      mine: comment.authorUserId === currentUserId,
    })),
    mine: story.authorUserId === currentUserId,
  };
}

function StoryPanel({
  room,
  joined,
  isSuperAdmin = false,
  isStaff: initialStaff,
  showChatButton = true,
  showInternalHeader = false,
  title = "스토리",
  showLinkedRoom = false,
  initialSelectedId,
  initialWrite = false,
  onClose,
  onEnterChat,
  onStorySaved,
  onOpenDetail,
  onWriteRequest,
}: {
  room: Room;
  joined: boolean;
  isSuperAdmin?: boolean;
  isStaff: boolean;
  showChatButton?: boolean;
  showInternalHeader?: boolean;
  title?: string;
  showLinkedRoom?: boolean;
  initialSelectedId?: string;
  initialWrite?: boolean;
  onClose?: () => void;
  onEnterChat: () => void;
  onStorySaved?: (story: StoryItem) => void;
  onOpenDetail?: (story: StoryItem) => void;
  onWriteRequest?: () => void;
}) {
  const canViewMemberStories = joined || isSuperAdmin;
  const [filter, setFilter] = useState<"all" | StoryVisibility>(
    canViewMemberStories ? "all" : "public",
  );
  const [staff, setStaff] = useState(initialStaff);
  const isStaff = staff;
  const [items, setItems] = useState<StoryItem[]>(() =>
    isLocalDemoRoomId(room.id) ? initialStoryItems(room) : [],
  );
  const [selected, setSelected] = useState<StoryItem | null>(null);
  const [editing, setEditing] = useState<StoryItem | null>(null);
  const [writing, setWriting] = useState(initialWrite);
  const [currentProfile, setCurrentProfile] = useState<RoomMember | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storiesLoaded, setStoriesLoaded] = useState(isLocalDemoRoomId(room.id));
  const [storiesLoadError, setStoriesLoadError] = useState("");
  const seededSelection = useRef(false);
  useEffect(() => {
    if (room.isAdult && filter === "public")
      setFilter(canViewMemberStories ? "all" : "room");
  }, [canViewMemberStories, filter, room.isAdult]);
  const visible =
    filter === "all"
      ? items
      : items.filter((item) => item.visibility === filter);
  const reloadStories = async (showSpinner = false) => {
    if (!supabase || !isUuid(room.id)) {
      setItems(isLocalDemoRoomId(room.id) ? initialStoryItems(room) : []);
      setCurrentProfile(
        isLocalDemoRoomId(room.id)
          ? (membersForRoom(room).find((member) => member.mine) ?? null)
          : null,
      );
      setStoriesLoaded(true);
      setStoriesLoadError("");
      if (showSpinner) setRefreshing(false);
      return;
    }
    if (showSpinner) setRefreshing(true);
    try {
      const [serverStories, userResult, serverMembers] = await Promise.all([
        listStories({ roomId: room.id, publicOnly: !canViewMemberStories }),
        supabase.auth.getUser(),
        listRoomMembersVisible(room.id).catch(() => []),
      ]);
      const userId = userResult.data.user?.id;
      setItems(serverStories.map((story) => mapServerStory(story, userId)));
      setStoriesLoadError("");
      const mappedMembers = mapRoomMembers(serverMembers, userId);
      setCurrentProfile(mappedMembers.find((member) => member.mine) ?? null);
    } catch (error) {
      setStoriesLoadError(serverErrorMessage(error));
      throw error;
    } finally {
      setStoriesLoaded(true);
      if (showSpinner) setRefreshing(false);
    }
  };
  useEffect(() => {
    if (!supabase || !isUuid(room.id) || !joined) return;
    const client = supabase;
    client.auth
      .getUser()
      .then(({ data: userData }) => {
        const userId = userData.user?.id;
        if (!userId) return null;
        return client
          .from("room_memberships")
          .select("role")
          .eq("room_id", room.id)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
      })
      .then((result) => {
        if (result)
          setStaff(
            result.data?.role === "owner" || result.data?.role === "cohost",
          );
      })
      .catch(() => undefined);
  }, [joined, room.id]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id)) return;
    reloadStories(false).catch(() => undefined);
  }, [canViewMemberStories, room.id]);
  useEffect(() => {
    if (!supabase || !isUuid(room.id)) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => reloadStories(false).catch(() => undefined),
        200,
      );
    };
    const channel = client
      .channel(`room-stories-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
          filter: `room_id=eq.${room.id}`,
        },
        scheduleReload,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [joined, room.id]);
  useEffect(() => {
    if (!canViewMemberStories && filter !== "public") setFilter("public");
  }, [canViewMemberStories, filter]);
  useEffect(() => {
    if (!initialSelectedId || seededSelection.current || selected) return;
    const target = items.find((item) => item.id === initialSelectedId);
    if (target) {
      setSelected(target);
      seededSelection.current = true;
    }
  }, [initialSelectedId, items, selected]);
  const saveStory = (story: StoryItem) => {
    setItems((current) =>
      current.some((item) => item.id === story.id)
        ? current.map((item) => (item.id === story.id ? story : item))
        : [story, ...current],
    );
    onStorySaved?.(story);
    setSelected(story);
    setEditing(null);
    setWriting(false);
  };
  const removeStory = async (story: StoryItem) => {
    Alert.alert("스토리 삭제", "삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            if (isSupabaseConfigured && isUuid(story.id))
              await deleteStory(story.id);
            setItems((current) =>
              current.filter((item) => item.id !== story.id),
            );
            setSelected(null);
          } catch (error) {
            Alert.alert("삭제 실패", serverErrorMessage(error));
          }
        },
      },
    ]);
  };
  if (writing || editing)
    return (
      <StoryEditor
        room={room}
        initial={editing}
        currentProfile={currentProfile ?? undefined}
        embedded={showInternalHeader ? false : !showChatButton}
        onCancel={() => {
          if (initialWrite && !editing) {
            setWriting(false);
            onClose?.();
            return;
          }
          setWriting(false);
          setEditing(null);
        }}
        onSave={saveStory}
      />
    );
  if (selected)
    return showInternalHeader ? (
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <StoryDetail
          story={selected}
          room={room}
          joined={joined}
          canModerate={staff}
          currentProfile={currentProfile ?? undefined}
          showLinkedRoom={showLinkedRoom}
          onBack={() => setSelected(null)}
          onChange={(story) => {
            setSelected(story);
            setItems((current) =>
              current.map((item) => (item.id === story.id ? story : item)),
            );
          }}
          onEdit={() => setEditing(selected)}
          onDelete={() => removeStory(selected)}
        />
      </SafeAreaView>
    ) : (
      <StoryDetail
        story={selected}
        room={room}
        joined={joined}
        canModerate={staff}
        currentProfile={currentProfile ?? undefined}
        showLinkedRoom={showLinkedRoom}
        onBack={() => setSelected(null)}
        onChange={(story) => {
          setSelected(story);
          setItems((current) =>
            current.map((item) => (item.id === story.id ? story : item)),
          );
        }}
        onEdit={() => setEditing(selected)}
        onDelete={() => removeStory(selected)}
      />
    );
  const content = (
    <View style={s.flex}>
      <View style={s.storyVisibility}>
        {canViewMemberStories && (
          <>
            <Pressable
              onPress={() => setFilter("all")}
              style={[
                s.visibilityOption,
                filter === "all" && s.visibilityOptionActive,
              ]}
            >
              <Ionicons
                name="apps-outline"
                size={14}
                color={filter === "all" ? colors.mint700 : colors.textMuted}
              />
              <Text style={s.visibilityText}>모두 보기</Text>
            </Pressable>
            <Pressable
              onPress={() => setFilter("room")}
              style={[
                s.visibilityOption,
                filter === "room" && s.visibilityOptionActive,
              ]}
            >
              <Ionicons
                name="people-outline"
                size={14}
                color={filter === "room" ? colors.mint700 : colors.textMuted}
              />
              <Text style={s.visibilityText}>방 멤버</Text>
            </Pressable>
          </>
        )}
        {!room.isAdult && (
          <Pressable
            onPress={() => setFilter("public")}
            style={[
              s.visibilityOption,
              filter === "public" && s.visibilityOptionActive,
            ]}
          >
            <Ionicons
              name="earth-outline"
              size={14}
              color={filter === "public" ? colors.mint700 : colors.textMuted}
            />
            <Text style={s.visibilityText}>전체 공개</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reloadStories(true)}
            tintColor={activeAppTheme.accent}
          />
        }
        contentContainerStyle={[s.panel, { paddingBottom: joined ? 150 : 100 }]}
      >
        {!storiesLoaded ? (
          <View style={s.centerState}>
            <ActivityIndicator color={activeAppTheme.accent} />
            <Text style={s.centerStateText}>스토리를 불러오고 있어요.</Text>
          </View>
        ) : visible.map((story) => {
          const text = story.blocks
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join(" ");
          const latest = story.comments.at(-1);
          const imageUri = story.blocks.find(
            (block) => block.type === "image",
          )?.uri;
          return (
            <Pressable
              key={story.id}
              onPress={() =>
                onOpenDetail ? onOpenDetail(story) : setSelected(story)
              }
              style={s.story}
            >
              <View style={s.storyAuthor}>
                <Avatar uri={story.authorAvatarUri} size={42} />
                <View style={s.flex}>
                  <Text style={s.storyAuthorName}>{story.author}</Text>
                  <Text style={s.storyTime}>
                    {formatStoryTime(story.createdAt)} ·{" "}
                    {story.visibility === "public"
                      ? "전체 공개"
                      : "방 멤버 공개"}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={2} style={s.storyTitle}>
                {story.title}
              </Text>
              <LinkedText numberOfLines={4} ellipsizeMode="tail" style={s.storyBody}>
                {text}
              </LinkedText>
              {imageUri && (
                <ExpoImage
                  source={{ uri: imageUri }}
                  contentFit="cover"
                  style={s.storyPreviewImage}
                />
              )}
              {latest && (
                <View style={s.storyComment}>
                  <Avatar uri={latest.authorAvatarUri} size={30} />
                  <View style={s.flex}>
                    <Text style={s.storyCommentName}>{latest.author}</Text>
                    <Text numberOfLines={2} style={s.storyCommentBody}>
                      {latest.body}
                    </Text>
                  </View>
                </View>
              )}
              {story.comments.length > 0 && (
                <Text style={s.storyMeta}>
                  댓글 {story.comments.length}개 모두 보기
                </Text>
              )}
            </Pressable>
          );
        })}
        {storiesLoaded && visible.length === 0 && (
          <Empty
            title={storiesLoadError ? "스토리를 불러오지 못했어요" : "스토리가 없어요"}
            body={storiesLoadError || "아직 올라온 스토리가 없습니다."}
          />
        )}
      </ScrollView>
      {joined && (
        <>
          {showChatButton && (
            <Pressable onPress={onEnterChat} style={s.storyChatButton}>
              <LinearGradient
                colors={["#82B9C1", "#5DBB8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.fullGradient}
              >
                <Text style={s.primaryText}>채팅방 들어가기</Text>
              </LinearGradient>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel="스토리 글쓰기"
            onPress={() =>
              onWriteRequest ? onWriteRequest() : setWriting(true)
            }
            style={[s.storyFab, !showChatButton && { bottom: 22 }]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.fabGradient}
            >
              <Ionicons name="create-outline" size={22} color={themeForeground(activeAppTheme)} />
            </LinearGradient>
          </Pressable>
        </>
      )}
    </View>
  );
  if (showInternalHeader)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <TopBar title={title} onBack={onClose ?? onEnterChat} />
        {content}
      </SafeAreaView>
    );
  return content;
}

function StoryDetail({
  story,
  room,
  joined,
  canModerate,
  currentProfile,
  publicMode = false,
  showLinkedRoom = false,
  hideHeader = false,
  onBack,
  onChange,
  onEdit,
  onDelete,
  onOpenRoom,
}: {
  story: StoryItem;
  room?: Room;
  joined: boolean;
  canModerate: boolean;
  currentProfile?: RoomMember | null;
  publicMode?: boolean;
  showLinkedRoom?: boolean;
  hideHeader?: boolean;
  onBack: () => void;
  onChange: (story: StoryItem) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenRoom?: () => void;
}) {
  const adsDisabled = useAdFree();
  const [comment, setComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentSubmittingRef = useRef(false);
  const [heartSubmitting, setHeartSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useAppTheme();
  const foreground = themeForeground(theme);
  const canDelete = story.mine || canModerate;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const refreshStory = async (showSpinner = true) => {
    if (!supabase || !isUuid(story.id) || !room?.id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const [rows, userResult] = await Promise.all([
        listStories({ storyId: story.id, limit: 1 }),
        supabase.auth.getUser(),
      ]);
      const row = rows[0];
      if (row) onChangeRef.current(mapServerStory(row, userResult.data.user?.id));
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  };
  useEffect(() => {
    if (!supabase || !isUuid(story.id)) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => refreshStory(false).catch(() => undefined),
        180,
      );
    };
    const channel = client
      .channel(`story-detail-${story.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
          filter: `id=eq.${story.id}`,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "story_comments",
          filter: `story_id=eq.${story.id}`,
        },
        scheduleReload,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [story.id, room?.id]);
  useEffect(() => {
    if (!publicMode || !isSupabaseConfigured || !isUuid(story.id)) return;
    recordStoryView(story.id)
      .then((views) => onChange({ ...story, views }))
      .catch(() => undefined);
  }, [publicMode, story.id]);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const frameListener = Keyboard.addListener(
      "keyboardWillChangeFrame",
      (event) => {
        const screenHeight = Dimensions.get("screen").height;
        setKeyboardInset(
          Math.max(
            0,
            screenHeight - event.endCoordinates.screenY - safeAreaInsets.bottom,
          ),
        );
      },
    );
    const hideListener = Keyboard.addListener("keyboardWillHide", () =>
      setKeyboardInset(0),
    );
    return () => {
      frameListener.remove();
      hideListener.remove();
    };
  }, [safeAreaInsets.bottom]);
  const toggleHeart = async () => {
    if (heartSubmitting) return;
    setHeartSubmitting(true);
    try {
      if (isSupabaseConfigured && isUuid(story.id)) {
        const result = await toggleStoryLike(story.id);
        onChange({ ...story, liked: result.liked, hearts: result.heartCount });
      } else
        onChange({
          ...story,
          liked: !story.liked,
          hearts: Math.max(0, story.hearts + (story.liked ? -1 : 1)),
        });
    } catch (error) {
      Alert.alert("하트 처리 실패", serverErrorMessage(error));
    } finally {
      setHeartSubmitting(false);
    }
  };
  const submit = async () => {
    const body = comment.trim();
    if (!body || !joined || commentSubmittingRef.current) return;
    commentSubmittingRef.current = true;
    setCommentSubmitting(true);
    try {
      let id = `comment-${Date.now()}`;
      if (isSupabaseConfigured && isUuid(story.id)) {
        id = await addStoryComment(story.id, body);
        if (room?.id && isUuid(room.id)) {
          const [rows, userResult] = await Promise.all([
            listStories({ roomId: room.id }),
            supabase?.auth.getUser(),
          ]);
          const latest = rows.find((item) => item.id === story.id);
          if (latest) {
            onChange(mapServerStory(latest, userResult?.data.user?.id));
            setComment("");
            return;
          }
        }
      }
      onChange({
        ...story,
        comments: [
          ...story.comments,
          {
            id,
            author: currentProfile?.name ?? "나",
            authorAvatarUri: currentProfile?.avatarUri,
            body,
            createdAt: new Date().toISOString(),
            mine: true,
          },
        ],
      });
      setComment("");
    } catch (error) {
      Alert.alert("댓글 작성 실패", serverErrorMessage(error));
    } finally {
      commentSubmittingRef.current = false;
      setCommentSubmitting(false);
    }
  };
  const removeComment = async (item: StoryComment) => {
    Alert.alert("댓글 삭제", "삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            if (isSupabaseConfigured && isUuid(item.id))
              await deleteStoryComment(item.id);
            onChange({
              ...story,
              comments: story.comments.filter(
                (commentItem) => commentItem.id !== item.id,
              ),
            });
          } catch (error) {
            Alert.alert("댓글 삭제 실패", serverErrorMessage(error));
          }
        },
      },
    ]);
  };
  const storyMenuActions = [
    ...(story.mine
      ? [
          {
            label: "편집하기",
            onPress: () => {
              setMenuOpen(false);
              onEdit();
            },
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: "삭제하기",
            onPress: () => {
              setMenuOpen(false);
              onDelete();
            },
          },
        ]
      : []),
    {
      label: "신고하기",
      onPress: async () => {
        setMenuOpen(false);
        if (!isUuid(story.id)) {
          Alert.alert(
            "신고 불가",
            "서버에 저장된 스토리만 신고할 수 있습니다.",
          );
          return;
        }
        try {
          const submitted = await confirmReportSubmission({
            targetType: "story",
            targetId: story.id,
            reason: "other",
            detail: `스토리 신고: ${story.title}`,
          });
          if (!submitted) return;
          Alert.alert("신고 접수 완료", "스토리 신고가 접수되었습니다.");
        } catch (error) {
          Alert.alert("신고 실패", serverErrorMessage(error));
        }
      },
    },
  ];
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={undefined}
      keyboardVerticalOffset={0}
    >
      <EdgeBackLayer onBack={onBack} />
      {!hideHeader && (
        <LinearGradient
          colors={["#82B9C1", "#5DBB8C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.storyDetailHeader, s.androidHeaderInset58]}
        >
          <Pressable onPress={onBack} style={s.storyHeaderAction}>
            <Ionicons name="chevron-back" size={22} color={foreground} />
          </Pressable>
          <Text style={[s.storyDetailHeaderTitle, { color: foreground }]}>스토리</Text>
          <View style={s.storyHeaderRight}>
            <Pressable
              hitSlop={10}
              onPress={() => setMenuOpen((value) => !value)}
              style={s.storyHeaderAction}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={foreground} />
            </Pressable>
          </View>
        </LinearGradient>
      )}
      {!hideHeader && menuOpen && (
        <View style={s.storyMenuLayer}>
          <Pressable
            accessibilityLabel="스토리 메뉴 닫기"
            onPress={() => setMenuOpen(false)}
            style={s.sheetDim}
          />
          <View style={s.storyHeaderMenu}>
            <View style={s.storyHeaderMenuList}>
              {storyMenuActions.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={s.storyHeaderMenuRow}
                >
                  <Text style={s.storyHeaderMenuText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
      <ScrollView
        style={s.flex}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshStory}
            tintColor={activeAppTheme.accent}
          />
        }
        contentContainerStyle={s.storyDetail}
      >
        <Text numberOfLines={1} ellipsizeMode="tail" style={s.storyDetailTitle}>
          {story.title}
        </Text>
        <View style={s.storyAuthor}>
          <Avatar uri={story.authorAvatarUri} size={46} />
          <View style={s.flex}>
            <Text style={s.storyAuthorName}>{story.author}</Text>
            <Text style={s.storyTime}>
              {formatStoryTime(story.createdAt)} · 조회 {story.views} · 하트{" "}
              {story.hearts}
            </Text>
          </View>
          <Pressable
            disabled={heartSubmitting}
            onPress={toggleHeart}
            style={s.storyInlineHeart}
          >
            <Ionicons
              name={story.liked ? "heart" : "heart-outline"}
              size={21}
              color={story.liked ? colors.pink600 : colors.textSubtle}
            />
          </Pressable>
          {showLinkedRoom && (
            <Pressable
              onPress={onOpenRoom}
              disabled={!onOpenRoom}
              style={s.storyLinkedRoomInline}
            >
              <RoomImage room={room} size={30} />
              <View style={s.storyLinkedText}>
                <Text style={s.storyLinkedLabel}>연결된 채팅방</Text>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={s.storyLinkedName}
                >
                  {story.roomName}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
        {story.blocks.map((block, index) =>
          block.type === "text" ? (
            <LinkedText key={block.id} style={s.storyDetailText}>
              {block.text}
            </LinkedText>
          ) : (
            <ExpoImage
              key={block.id}
              source={{ uri: block.uri }}
              contentFit="cover"
              style={[s.storyDetailImage, index === 0 && s.storyFirstImage]}
            />
          ),
        )}
        {!adsDisabled && (
          <InlineBannerAd
            placement="story"
            dark={theme.id === "dark"}
          />
        )}
        <View style={s.commentSection}>
          <Text style={s.commentCount}>댓글 {story.comments.length}</Text>
          {story.comments.map((item) => (
            <View key={item.id} style={s.storyDetailComment}>
              <Avatar uri={item.authorAvatarUri} size={34} />
              <View style={s.flex}>
                <View style={s.commentMetaLine}>
                  <Text style={s.storyCommentName}>{item.author}</Text>
                  <Text style={s.storyCommentTime}>
                    {formatStoryTime(item.createdAt)}
                  </Text>
                </View>
                <LinkedText style={s.storyCommentBody}>{item.body}</LinkedText>
              </View>
              {(story.mine || item.mine) && (
                <Pressable
                  accessibilityLabel="댓글 삭제"
                  onPress={() => removeComment(item)}
                  style={s.commentDelete}
                >
                  <Ionicons name="close" size={16} color={colors.gray300} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      {joined && (
        <View
          style={[
            s.commentComposerShell,
            theme.id === "dark" && {
              backgroundColor: "#222222",
              borderTopColor: "#343434",
            },
            keyboardInset > 0 && { marginBottom: keyboardInset },
          ]}
        >
          <View
            style={[
              s.commentComposer,
              theme.id === "dark" && { backgroundColor: "#222222" },
            ]}
          >
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="댓글을 입력해주세요."
              placeholderTextColor={colors.textMuted}
              style={[
                s.commentInput,
                theme.id === "dark" && {
                  backgroundColor: "#2B2B2B",
                  color: "#F4F4F4",
                },
              ]}
            />
            <Pressable
              disabled={!comment.trim() || commentSubmitting}
              onPress={submit}
              style={[
                s.commentSend,
                (!comment.trim() || commentSubmitting) && s.disabled,
              ]}
            >
              <LinearGradient
                colors={
                  comment.trim() ? ["#82B9C1", "#5DBB8C"] : ["#C9D8D5", "#BFCAC7"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.fullGradient}
              >
                <Ionicons name="paper-plane" size={17} color={foreground} />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function StoryEditor({
  room,
  initial,
  currentProfile,
  embedded = false,
  onCancel,
  onSave,
}: {
  room: Room;
  initial: StoryItem | null;
  currentProfile?: RoomMember | null;
  embedded?: boolean;
  onCancel: () => void;
  onSave: (story: StoryItem) => void;
}) {
  const appTheme = useAppTheme();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [visibility, setVisibility] = useState<StoryVisibility>(
    room.isAdult ? "room" : initial?.visibility ?? "room",
  );
  const [blocks, setBlocks] = useState<StoryBlock[]>(
    initial?.blocks ?? [{ id: "text-1", type: "text", text: "" }],
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const updateText = (id: string, text: string) =>
    setBlocks((items) =>
      items.map((item) =>
        item.id === id && item.type === "text" ? { ...item, text } : item,
      ),
    );
  const addText = () =>
    setBlocks((items) => [
      ...items,
      { id: `text-${Date.now()}`, type: "text", text: "" },
    ]);
  const addImages = async () => {
    const remaining =
      10 - blocks.filter((block) => block.type === "image").length;
    if (remaining <= 0) {
      Alert.alert("첨부 제한", "사진은 최대 10장까지 첨부할 수 있습니다.");
      return;
    }
    const source = await promptImageSource();
    if (!source || source === "remove") return;
    const asset = await pickSingleImage({
      source,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!asset || asset.mimeType === "image/gif") return;
    const width = asset.width ?? 1440;
    const height = asset.height ?? 1440;
    const scale = Math.min(1, 1200 / Math.max(width, height));
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const optimized = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: outputWidth, height: outputHeight } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    let uploadId: string | undefined;
    if (isSupabaseConfigured && isUuid(room.id)) {
      const bytes = await (await fetch(optimized.uri)).arrayBuffer();
      const uploaded = await uploadValidatedImage({
        uri: optimized.uri,
        mimeType: "image/jpeg",
        fileSize: bytes.byteLength,
        width: outputWidth,
        height: outputHeight,
        purpose: "story",
        roomId: room.id,
      });
      uploadId = uploaded.uploadId;
    }
    setBlocks((items) => [
      ...items,
      {
        id: `image-${Date.now()}`,
        type: "image",
        uri: optimized.uri,
        uploadId,
        mimeType: "image/jpeg",
      },
    ]);
  };
  const save = async () => {
    if (savingRef.current) return;
    const normalized = blocks
      .filter((block) => block.type === "image" || block.text.trim())
      .map((block) =>
        block.type === "text" ? { ...block, text: block.text.trim() } : block,
      );
    const normalizedTitle = title.trim();
    if (
      !normalizedTitle ||
      !normalized.some(
        (block) => block.type === "image" || block.type === "text",
      )
    )
      return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload: StoryBlockInput[] = normalized.map((block) =>
        block.type === "text"
          ? { type: "text", text: block.text }
          : {
              type: "image",
              uploadId: block.uploadId,
              storagePath: block.storagePath,
              mimeType: block.mimeType,
              uri: block.uri,
            },
      );
      let id = initial?.id ?? `story-${Date.now()}`;
      const effectiveVisibility: StoryVisibility = room.isAdult ? "room" : visibility;
      let createdNewStory = false;
      if (isSupabaseConfigured && isUuid(room.id)) {
        if (initial && isUuid(initial.id))
          await updateStoryContent(
            initial.id,
            normalizedTitle,
            payload,
            effectiveVisibility,
          );
        else {
          id = await createStoryWithBlocks({
            roomId: room.id,
            visibility: effectiveVisibility,
            title: normalizedTitle,
            blocks: payload,
          });
          createdNewStory = true;
        }
        if (createdNewStory && isUuid(id)) {
          try {
            await announceStoryCreated(id);
          } catch (error) {
            console.warn("announceStoryCreated failed", error);
          }
        }
        const [savedStories, userResult] = await Promise.all([
          listStories({ roomId: room.id }),
          supabase?.auth.getUser(),
        ]);
        const savedStory = savedStories.find((item) => item.id === id);
        if (savedStory) {
          onSave(mapServerStory(savedStory, userResult?.data.user?.id));
          return;
        }
      }
      onSave({
        id,
        roomId: room.id,
        roomName: room.name,
        title: normalizedTitle,
        author: initial?.author ?? currentProfile?.name ?? "나",
        authorAvatarUri: initial?.authorAvatarUri ?? currentProfile?.avatarUri,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        visibility: effectiveVisibility,
        blocks: normalized,
        comments: initial?.comments ?? [],
        views: initial?.views ?? 0,
        hearts: initial?.hearts ?? 0,
        liked: initial?.liked ?? false,
        mine: true,
      });
    } catch (error) {
      Alert.alert("스토리 저장 실패", serverErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const hasBody = blocks.some(
    (block) =>
      block.type === "image" ||
      (block.type === "text" && Boolean(block.text.trim())),
  );
  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      style={s.flex}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={s.storyEditor}
      >
        <TextInput
          value={title}
          onChangeText={(value) => setTitle(value.slice(0, 45))}
          placeholder="제목"
          placeholderTextColor={colors.textMuted}
          style={s.storyTitleInput}
        />
        <View style={s.storyAuthor}>
          <Avatar
            uri={initial?.authorAvatarUri ?? currentProfile?.avatarUri}
            size={44}
          />
          <View>
            <Text style={s.storyAuthorName}>
              {initial?.author ?? currentProfile?.name ?? "나"}
            </Text>
            <Text style={s.storyTime}>{room.name} 프로필</Text>
          </View>
        </View>
        <View style={s.storyEditorVisibility}>
          <Pressable
            onPress={() => setVisibility("room")}
            style={[
              s.visibilityOption,
              visibility === "room" && s.visibilityOptionActive,
            ]}
          >
            <Text style={s.visibilityText}>방 멤버</Text>
          </Pressable>
          {!room.isAdult && (
            <Pressable
              onPress={() => setVisibility("public")}
              style={[
                s.visibilityOption,
                visibility === "public" && s.visibilityOptionActive,
              ]}
            >
              <Text style={s.visibilityText}>전체 공개</Text>
            </Pressable>
          )}
        </View>
        {blocks.map((block) =>
          block.type === "text" ? (
            <View key={block.id} style={s.storyTextBlockWrap}>
              <TextInput
                value={block.text}
                onChangeText={(text) => updateText(block.id, text)}
                multiline
                placeholder="본문을 입력하세요."
                placeholderTextColor={colors.textMuted}
                style={s.storyBlockInput}
                scrollEnabled={false}
              />
              <Pressable
                onPress={() =>
                  setBlocks((items) =>
                    items.filter((item) => item.id !== block.id),
                  )
                }
                style={s.storyTextRemove}
              >
                <Ionicons name="close" size={15} color={colors.gray300} />
              </Pressable>
            </View>
          ) : (
            <View key={block.id} style={s.storyEditorImageWrap}>
              <ExpoImage
                source={{ uri: block.uri }}
                contentFit="cover"
                style={s.storyEditorImage}
              />
              <Pressable
                onPress={() =>
                  setBlocks((items) =>
                    items.filter((item) => item.id !== block.id),
                  )
                }
                style={s.storyImageRemove}
              >
                <Ionicons name="close" size={17} color="#FFF" />
              </Pressable>
            </View>
          ),
        )}
        <View style={s.storyEditorToolbar}>
          <Pressable onPress={addImages} style={s.storyToolbarButton}>
            <Ionicons
              name="images-outline"
              size={21}
              color={colors.textSubtle}
            />
          </Pressable>
          <Pressable onPress={addText} style={s.storyToolbarButton}>
            <Ionicons name="text-outline" size={21} color={colors.textSubtle} />
          </Pressable>
          <View style={s.flex} />
          <Pressable onPress={onCancel} style={s.storyEditorCancel}>
            <Text style={s.storyEditorCancelText}>취소</Text>
          </Pressable>
          <RNPressable
            disabled={saving || !title.trim() || !hasBody}
            onPress={save}
            style={[
              s.storyEditorSubmit,
              (saving || !title.trim() || !hasBody) && s.disabled,
            ]}
          >
            <ExpoLinearGradient
              colors={
                saving || !title.trim() || !hasBody
                  ? ["#C9D8D5", "#BFCAC7"]
                  : appTheme.gradient
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.fullGradient}
            >
              <RNText
                style={[
                  s.primaryText,
                  appTheme.id === "white" && { color: "#1C1C1C" },
                ]}
              >
                {saving ? "저장 중..." : "게시"}
              </RNText>
            </ExpoLinearGradient>
          </RNPressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
  return embedded ? (
    <View style={s.safe}>{content}</View>
  ) : (
    <SafeAreaView style={s.safe}>
      <TopBar
        title={initial ? "스토리 편집" : "스토리 작성"}
        onBack={onCancel}
      />
      {content}
    </SafeAreaView>
  );
}

function PublicStoryFeed({
  roomData,
  joinedIds,
  hiddenRoomIds = [],
  openRoom,
  query = "",
  loading = false,
  onDetailChange,
}: {
  roomData: Room[];
  joinedIds: string[];
  hiddenRoomIds?: string[];
  openRoom: (room: Room) => void;
  query?: string;
  loading?: boolean;
  onDetailChange?: (open: boolean) => void;
}) {
  const appTheme = useAppTheme();
  const isDarkTheme = appTheme.id === "dark";
  const [sort, setSort] = useState<"random" | "views" | "hearts" | "latest">(
    "latest",
  );
  const [selected, setSelected] = useState<StoryItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [publicStories, setPublicStories] = useState<StoryItem[]>(() =>
    SCREENSHOT_DEMO_ENABLED
      ? initialStoryItems(screenshotDemoRooms[0])
      : [],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(SCREENSHOT_DEMO_ENABLED);
  const [loadError, setLoadError] = useState("");
  const [visibleStoryCount, setVisibleStoryCount] = useState(12);
  const [randomBucket, setRandomBucket] = useState(() =>
    Math.floor(Date.now() / THREE_HOURS_MS),
  );
  const hiddenStoryRoomIds = useMemo(
    () => new Set(hiddenRoomIds),
    [hiddenRoomIds],
  );
  useEffect(() => {
    onDetailChange?.(Boolean(selected));
    return () => onDetailChange?.(false);
  }, [onDetailChange, selected]);
  const reloadPublicStories = async (showSpinner = false) => {
    if (SCREENSHOT_DEMO_ENABLED) {
      setPublicStories(initialStoryItems(screenshotDemoRooms[0]));
      setLoaded(true);
      setRefreshing(false);
      return;
    }
    if (!supabase) {
      setLoaded(true);
      return;
    }
    if (showSpinner) setRefreshing(true);
    try {
      const [serverStories, userResult] = await Promise.all([
        listStories({ publicOnly: true }),
        supabase.auth.getUser(),
      ]);
      setPublicStories(
        serverStories.map((story) =>
          mapServerStory(story, userResult.data.user?.id),
        ),
      );
      setLoadError("");
      setLoaded(true);
    } catch (error) {
      setLoadError(serverErrorMessage(error));
      setLoaded(true);
      throw error;
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  };
  useEffect(() => {
    reloadPublicStories(false).catch(() => undefined);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setRandomBucket(Math.floor(Date.now() / THREE_HOURS_MS));
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (SCREENSHOT_DEMO_ENABLED) return;
    if (!supabase) return;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => reloadPublicStories(false).catch(() => undefined),
        250,
      );
    };
    const channel = client
      .channel("public-story-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        scheduleReload,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, []);
  const sortedStories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    const result = publicStories.filter(
      (story) =>
        !hiddenStoryRoomIds.has(story.roomId) &&
        (!normalizedQuery ||
          story.title.toLocaleLowerCase("ko-KR").includes(normalizedQuery)),
    );
    if (sort === "views") return result.sort((a, b) => b.views - a.views);
    if (sort === "hearts") return result.sort((a, b) => b.hearts - a.hearts);
    if (sort === "latest")
      return result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    return result.sort(
      (a, b) =>
        stableHash(`${randomBucket}:${a.id}`) -
        stableHash(`${randomBucket}:${b.id}`),
    );
  }, [hiddenStoryRoomIds, publicStories, query, sort, randomBucket]);
  useEffect(() => {
    setVisibleStoryCount(12);
  }, [query, sort, randomBucket, hiddenRoomIds]);
  const visibleStories = useMemo(
    () => sortedStories.slice(0, visibleStoryCount),
    [sortedStories, visibleStoryCount],
  );
  const hasMoreStories = visibleStoryCount < sortedStories.length;
  const loadMoreStories = () => {
    if (!loaded || loading || !hasMoreStories) return;
    setVisibleStoryCount((count) => Math.min(count + 12, sortedStories.length));
  };
  if (selected) {
    const linkedRoom = roomData.find((item) => item.id === selected.roomId);
    if (editing && linkedRoom)
      return (
        <StoryEditor
          room={linkedRoom}
          initial={selected}
          onCancel={() => setEditing(false)}
          onSave={(story) => {
            setSelected(story);
            setPublicStories((items) =>
              items.map((item) => (item.id === story.id ? story : item)),
            );
            setEditing(false);
          }}
        />
      );
    return (
      <StoryDetail
        story={selected}
        room={linkedRoom}
        publicMode
        showLinkedRoom
        joined={joinedIds.includes(selected.roomId)}
        canModerate={false}
        onBack={() => setSelected(null)}
        onChange={(story) => {
          setSelected(story);
          setPublicStories((items) =>
            items.map((item) => (item.id === story.id ? story : item)),
          );
        }}
        onEdit={() => {
          if (linkedRoom) setEditing(true);
        }}
        onDelete={async () => {
          try {
            if (isUuid(selected.id)) await deleteStory(selected.id);
            setPublicStories((items) =>
              items.filter((item) => item.id !== selected.id),
            );
            setSelected(null);
          } catch (error) {
            Alert.alert("삭제 실패", serverErrorMessage(error));
          }
        }}
        onOpenRoom={linkedRoom ? () => openRoom(linkedRoom) : undefined}
      />
    );
  }
  return (
    <FlatList
      data={visibleStories}
      keyExtractor={(item) => item.id}
      style={isDarkTheme ? s.publicStoryListDark : undefined}
      contentContainerStyle={[
        s.publicStoryList,
        isDarkTheme && s.publicStoryListDark,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => reloadPublicStories(true)}
          tintColor={activeAppTheme.accent}
        />
      }
      ListEmptyComponent={
        loading || !loaded ? (
          <View style={s.centerState}>
            <ActivityIndicator color={activeAppTheme.accent} />
          </View>
        ) : loadError ? (
          <Empty title="스토리를 불러오지 못했어요" body={loadError} />
        ) : query.trim() ? (
          <Empty
            title="검색 결과가 없어요"
            body="다른 제목으로 검색해 보세요."
          />
        ) : (
          <Empty
            title="공개 스토리가 없어요"
            body="전체 공개로 올라온 스토리가 아직 없습니다."
          />
        )
      }
      ListHeaderComponent={
        query.trim() ? null : (
          <View style={[s.publicStoryHeader, isDarkTheme && s.publicStoryCardDark]}>
            <Text style={s.publicStoryHeaderText}>공개 스토리</Text>
            <View style={s.storySortRow}>
              {(
                [
                  ["random", "랜덤"],
                  ["views", "조회순"],
                  ["hearts", "하트순"],
                  ["latest", "최신순"],
                ] as const
              ).map(([value, label]) => (
                <Pressable key={value} onPress={() => setSort(value)}>
                  <Text
                    style={[
                      s.storySortText,
                      sort === value && s.storySortTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      }
      ListFooterComponent={
        hasMoreStories ? (
          <View style={s.publicStoryLoadingMore}>
            <ActivityIndicator color={activeAppTheme.accent} />
          </View>
        ) : null
      }
      onEndReached={loadMoreStories}
      onEndReachedThreshold={0.35}
      renderItem={({ item }) => {
        const body = item.blocks
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join(" ");
        const thumbnail = item.blocks.find(
          (block): block is Extract<StoryBlock, { type: "image" }> =>
            block.type === "image",
        );
        return (
          <Pressable
            onPress={() => setSelected(item)}
            style={({ pressed }) => [
              s.publicStoryCard,
              isDarkTheme && s.publicStoryCardDark,
              pressed && s.publicStoryPressed,
            ]}
          >
            <View style={s.publicStoryMain}>
              <View style={s.publicStoryCopy}>
                <Text numberOfLines={2} style={s.publicStoryTitle}>
                  {item.title}
                </Text>
                <LinkedText
                  numberOfLines={3}
                  ellipsizeMode="tail"
                  style={s.publicStoryBody}
                >
                  {body}
                </LinkedText>
                <View style={s.publicStoryStats}>
                  <Text
                    style={[
                      s.publicStoryMeta,
                      (appTheme.id === "white" || appTheme.id === "mint") &&
                        s.publicStoryMetaGreen,
                      isDarkTheme && s.publicStoryMetaDark,
                    ]}
                  >
                    {formatStoryTime(item.createdAt)}
                  </Text>
                  <Text style={s.publicStoryStat}>조회 {item.views}</Text>
                  <Ionicons name="heart" size={12} color={colors.pink600} />
                  <Text style={s.publicStoryStat}>{item.hearts}</Text>
                </View>
              </View>
              {thumbnail && (
                <ExpoImage
                  source={{ uri: thumbnail.uri }}
                  contentFit="cover"
                  style={s.publicStoryThumbnail}
                />
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function RoomAccessSettings({
  room,
  onSaved,
}: {
  room: Room;
  onSaved: () => void;
}) {
  const [visibility, setVisibility] = useState<"public" | "private">(
    room.isPrivate ? "private" : "public",
  );
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const invalidPin = visibility === "private" && pin.length !== 6;
  useEffect(() => {
    setVisibility(room.isPrivate ? "private" : "public");
    setPin("");
  }, [room.id, room.isPrivate]);
  const save = async () => {
    setSaving(true);
    try {
      if (isSupabaseConfigured && isUuid(room.id))
        await configureRoomAccess({ roomId: room.id, visibility, pin });
      onSaved();
    } catch (error) {
      setSaving(false);
      Alert.alert("저장 실패", serverErrorMessage(error));
    }
  };
  return (
    <ScrollView contentContainerStyle={s.accessSettings}>
      <Text style={s.accessTitle}>방 노출 범위</Text>
      <View style={s.visibilityRows}>
        <Pressable
          onPress={() => {
            setVisibility("public");
            setPin("");
          }}
          style={[
            s.visibilityCard,
            visibility === "public" && s.visibilityCardActive,
          ]}
        >
          <Ionicons name="earth-outline" size={21} color={colors.mint700} />
          <View>
            <Text style={s.visibilityCardTitle}>공개방</Text>
            <Text style={s.visibilityCardText}>홈과 검색에 표시</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setVisibility("private")}
          style={[
            s.visibilityCard,
            visibility === "private" && s.visibilityCardActive,
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={21}
            color={colors.mint700}
          />
          <View>
            <Text style={s.visibilityCardTitle}>비밀방</Text>
            <Text style={s.visibilityCardText}>PIN 6자리 필수</Text>
          </View>
        </Pressable>
      </View>
      {visibility === "private" && (
        <View style={s.field}>
          <Text style={s.fieldLabel}>PIN 비밀번호</Text>
          <TextInput
            value={pin}
            onChangeText={(value) =>
              setPin(value.replace(/\D/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            secureTextEntry
            placeholder="숫자 6자리"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />
          {invalidPin && (
            <Text style={s.pinError}>
              비밀방은 PIN 6자리를 반드시 설정해야 합니다.
            </Text>
          )}
        </View>
      )}
      <Pressable
        disabled={saving || invalidPin}
        onPress={save}
        style={[s.accessSave, (saving || invalidPin) && s.disabled]}
      >
        <LinearGradient
          colors={
            saving || invalidPin
              ? ["#C9D8D5", "#BFCAC7"]
              : ["#82B9C1", "#5DBB8C"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.accessSaveGradient}
        >
          <Text style={s.primaryText}>
            {saving ? "저장 중..." : "설정 저장"}
          </Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

function MemberPanel({
  room,
  isOwner,
  isSuperAdmin,
  onAdminReportUser,
  onProfile,
}: {
  room: Room;
  isOwner: boolean;
  isSuperAdmin: boolean;
  onAdminReportUser: (id: string, label: string) => void;
  onProfile: (member: RoomMember) => void;
}) {
  const [members, setMembers] = useState<RoomMember[]>(() =>
    isLocalDemoRoomId(room.id) ? membersForRoom(room) : [],
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isLocalDemoRoomId(room.id));
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      setMembers(isLocalDemoRoomId(room.id) ? membersForRoom(room) : []);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([supabase?.auth.getUser(), listRoomMembersVisible(room.id)])
      .then(([userResult, serverMembers]) => {
        if (active)
          setMembers(mapRoomMembers(serverMembers, userResult?.data.user?.id));
      })
      .catch((error) => {
        if (active) setLoadError(serverErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [room.id, room.memberCount]);
  if (loading)
    return (
      <View style={s.centerState}>
        <ActivityIndicator color={activeAppTheme.accent} />
        <Text style={s.centerStateText}>멤버를 불러오고 있어요.</Text>
      </View>
    );
  if (loadError)
    return <Empty title="멤버를 불러오지 못했어요" body={loadError} />;
  const selected = members.find((member) => member.name === editing);
  const toggle = async () => {
    if (!selected?.userId) return;
    try {
      if (isSupabaseConfigured && isUuid(room.id) && isUuid(selected.userId))
        await setRoomMemberRole(
          room.id,
          selected.userId,
          selected.coHost ? "member" : "cohost",
        );
      setMembers((value) =>
        value.map((member) =>
          member.name !== editing
            ? member
            : { ...member, coHost: !member.coHost },
        ),
      );
      setEditing(null);
    } catch (error) {
      Alert.alert("권한 변경 실패", serverErrorMessage(error));
    }
  };
  const transfer = () => {
    if (!selected?.userId) return;
    const targetUserId = selected.userId;
    Alert.alert(
      "방장 권한 위임",
      `${selected.name}님에게 방장을 넘기시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "위임하기",
          style: "destructive",
          onPress: async () => {
            try {
              if (
                isSupabaseConfigured &&
                isUuid(room.id) &&
                isUuid(targetUserId)
              )
                await transferRoomOwnership(room.id, targetUserId);
              setMembers((items) =>
                items.map((item) =>
                  item.userId === targetUserId
                    ? { ...item, owner: true, coHost: false }
                    : item.mine
                      ? { ...item, owner: false, coHost: true }
                      : item,
                ),
              );
              setEditing(null);
            } catch (error) {
              Alert.alert("방장 위임 실패", serverErrorMessage(error));
            }
          },
        },
      ],
    );
  };
  const remove = async (ban: boolean) => {
    if (!selected?.userId) return;
    try {
      if (isSupabaseConfigured && isUuid(room.id) && isUuid(selected.userId))
        await kickOrBanRoomMember({
          roomId: room.id,
          userId: selected.userId,
          ban,
        });
      setMembers((items) =>
        items.filter((item) => item.userId !== selected.userId),
      );
      setEditing(null);
    } catch (error) {
      Alert.alert("멤버 내보내기 실패", serverErrorMessage(error));
    }
  };
  return (
    <View style={s.flex}>
      <ScrollView contentContainerStyle={s.memberPanel}>
        <Text style={s.memberLabel}>멤버 {members.length}명</Text>
        {members.map((member) => (
          <MemberCard
            key={member.userId ?? member.name}
            {...member}
            onPress={() => onProfile(member)}
            onLongPress={
              isOwner && !member.owner
                ? () => setEditing(member.name)
                : isSuperAdmin && member.userId
                  ? () => onAdminReportUser(member.userId!, member.name)
                  : undefined
            }
          />
        ))}
      </ScrollView>
      {isOwner && (
        <CoHostSheet
          member={selected}
          onClose={() => setEditing(null)}
          onToggle={toggle}
          onTransfer={transfer}
          onKick={() => remove(false)}
          onBan={() => remove(true)}
        />
      )}
    </View>
  );
}

function MemberCard({
  name,
  intro,
  avatarUri,
  owner,
  mine,
  coHost,
  onPress,
  onLongPress,
  onManage,
}: {
  name: string;
  intro: string;
  avatarUri?: string;
  owner?: boolean;
  mine?: boolean;
  coHost?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onManage?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.memberCard, pressed && s.pressed]}
    >
      <Avatar uri={avatarUri} size={50} />
      <View style={s.memberCardBody}>
        <View style={s.memberTitleLine}>
          <Text style={s.memberName}>{name}</Text>
          {mine && <Badge text="나" />}
          {owner && <Badge text="방장" pink />}
          {coHost && <Badge text="부방장" />}
        </View>
        <Text style={s.memberIntro}>{intro}</Text>
      </View>
      {onManage && (
        <Pressable
          accessibilityLabel={`${name} 관리`}
          onPress={onManage}
          style={s.memberManage}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={19}
            color={colors.textMuted}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

function MemberProfile({
  member,
  room,
  viewerRole = null,
  editable = false,
  startEditMode = false,
  onBack,
  onSaved,
  onHeart,
  onPoint,
  onSecret,
  onReport,
  availablePoints = 0,
}: {
  member: RoomMember;
  room: Room;
  viewerRole?: "owner" | "cohost" | "member" | null;
  editable?: boolean;
  startEditMode?: boolean;
  onBack: () => void;
  onSaved?: (member: RoomMember) => void;
  onHeart?: () => Promise<boolean>;
  onPoint?: (amount: string) => Promise<boolean>;
  onSecret?: (body: string) => Promise<boolean>;
  onReport?: () => void | Promise<void>;
  availablePoints?: number;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(member.name);
  const [intro, setIntro] = useState(member.intro);
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(startEditMode);
  const [quickAction, setQuickAction] = useState<"point" | "secret" | null>(
    null,
  );
  const [quickDraft, setQuickDraft] = useState("");
  const [quickSending, setQuickSending] = useState(false);
  const closeQuickAction = () => {
    if (quickSending) return;
    Keyboard.dismiss();
    setQuickAction(null);
    setQuickDraft("");
  };
  const submitQuickAction = async () => {
    if (quickSending || !quickAction || !quickDraft.trim()) return;
    setQuickSending(true);
    try {
      const sent =
        quickAction === "point"
          ? await onPoint?.(quickDraft)
          : await onSecret?.(quickDraft);
      if (sent) {
        setQuickAction(null);
        setQuickDraft("");
        onBack();
      }
    } finally {
      setQuickSending(false);
    }
  };
  const confirmHeart = () => {
    if (!onHeart) return;
    Alert.alert(
      "하트 보내기",
      `${member.name}님에게 하트를 보내시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "보내기",
          onPress: () => {
            void onHeart().then((sent) => {
              if (sent) onBack();
            });
          },
        },
      ],
    );
  };
  const pick = async () => {
    if (!editable || !editMode) {
      setPhotoOpen(true);
      return;
    }
    const source = await promptImageSource({
      allowDelete: Boolean(avatar || member.avatarUri),
    });
    if (!source) return;
    if (source === "remove") {
      setAvatar(null);
      setAvatarRemoved(true);
      return;
    }
    const asset = await pickSingleImage({
      source,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (asset) {
      setAvatar(asset);
      setAvatarRemoved(false);
    }
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let avatarUploadId: string | undefined;
      if (avatar && isSupabaseConfigured && isUuid(room.id)) {
        const resized = await ImageManipulator.manipulateAsync(
          avatar.uri,
          [{ resize: { width: 512, height: 512 } }],
          { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
        );
        const bytes = await (await fetch(resized.uri)).arrayBuffer();
        const upload = await uploadValidatedImage({
          uri: resized.uri,
          mimeType: "image/jpeg",
          fileSize: bytes.byteLength,
          width: 512,
          height: 512,
          purpose: "profile-avatar",
        });
        avatarUploadId = upload.uploadId;
      }
      if (isSupabaseConfigured && isUuid(room.id)) {
        await setRoomOwnerProfile({
          roomId: room.id,
          displayName: name.trim(),
          introduction: intro.trim(),
          avatarUploadId,
        });
        if (avatarRemoved) await clearRoomProfileAvatar(room.id);
      }
      onSaved?.({
        ...member,
        name: name.trim(),
        intro: intro.trim(),
        avatarUri: avatarRemoved
          ? undefined
          : (avatar?.uri ?? member.avatarUri),
      });
      setEditMode(false);
      Alert.alert("프로필 저장 완료", "방 프로필이 저장되었습니다.");
    } catch (error) {
      Alert.alert("프로필 저장 실패", serverErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const reportOnly = !editable && !member.mine && !viewerRole && Boolean(onReport);
  const canShowMenu = !editable && !member.mine && Boolean(viewerRole);
  const showQuickActions = Boolean(
    onHeart || onPoint || onSecret || canShowMenu,
  );
  const manageableUserId =
    member.userId && isUuid(member.userId) ? member.userId : null;
  const canManageTarget = Boolean(
    isSupabaseConfigured && isUuid(room.id) && manageableUserId,
  );
  const isMuted = Boolean(
    member.mutedUntil && new Date(member.mutedUntil).getTime() > Date.now(),
  );
  const actions =
    viewerRole === "owner"
      ? [
          member.coHost ? "부방장 해제하기" : "부방장 설정하기",
          "방장 양도하기",
          isMuted ? "채팅 금지 해제" : "채팅 금지",
          "강퇴하기",
          "차단하기",
          "신고하기",
        ]
      : viewerRole === "cohost"
        ? member.owner || member.coHost
          ? ["차단하기", "신고하기"]
          : [
              isMuted ? "채팅 금지 해제" : "채팅 금지",
              "강퇴하기",
              "차단하기",
              "신고하기",
            ]
        : ["차단하기", "신고하기"];
  const finishAction = (title: string, message: string) =>
    Alert.alert(title, message, [{ text: "확인", onPress: onBack }]);
  const applyMute = async (durationSeconds: number, labelText: string) => {
    if (!canManageTarget || !manageableUserId) {
      Alert.alert("처리 불가", "서버에 생성된 멤버만 관리할 수 있습니다.");
      return;
    }
    try {
      await setRoomMemberMute(room.id, manageableUserId, durationSeconds);
      finishAction(
        "채팅 금지 완료",
        `${member.name}님을 ${labelText} 동안 채팅 금지했습니다.`,
      );
    } catch (error) {
      Alert.alert("채팅 금지 실패", serverErrorMessage(error));
    }
  };
  const selectAction = async (label: string) => {
    setMenuOpen(false);
    if (label === "차단하기") {
      if (!manageableUserId) {
        Alert.alert("차단 불가", "서버에 생성된 사용자만 차단할 수 있습니다.");
        return;
      }
      Alert.alert(
        "차단하기",
        `${member.name}님을 차단하시겠습니까?\n차단한 사용자의 콘텐츠는 내 화면에서 숨겨지고 운영자 검토 요청이 접수됩니다.`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "차단하기",
            style: "destructive",
            onPress: async () => {
              try {
                await blockUser(manageableUserId);
                await submitReport({
                  targetType: "user",
                  targetId: manageableUserId,
                  reason: "other",
                  detail: `사용자 차단: ${member.name}`,
                });
                finishAction(
                  "차단 완료",
                  "사용자를 차단했고 운영자 검토 요청이 접수되었습니다.",
                );
              } catch (error) {
                Alert.alert("차단 실패", serverErrorMessage(error));
              }
            },
          },
        ],
      );
      return;
    }
    if (label === "신고하기") {
      if (!manageableUserId) {
        Alert.alert("신고 불가", "서버에 생성된 멤버만 신고할 수 있습니다.");
        return;
      }
      const submitted = await confirmReportSubmission({
        targetType: "user",
        targetId: manageableUserId,
        reason: "other",
        detail: `멤버 신고: ${member.name}`,
      });
      if (submitted)
        Alert.alert("신고 접수 완료", "멤버 신고가 접수되었습니다.");
      return;
    }
    if (!canManageTarget || !manageableUserId) {
      Alert.alert("처리 불가", "서버에 생성된 멤버만 관리할 수 있습니다.");
      return;
    }
    if (label === "부방장 설정하기" || label === "부방장 해제하기") {
      setRoomMemberRole(
        room.id,
        manageableUserId,
        label === "부방장 설정하기" ? "cohost" : "member",
      )
        .then(() =>
          finishAction(
            "권한 변경 완료",
            `${member.name}님의 권한을 변경했습니다.`,
          ),
        )
        .catch((error) =>
          Alert.alert("권한 변경 실패", serverErrorMessage(error)),
        );
      return;
    }
    if (label === "방장 양도하기") {
      Alert.alert(
        "방장 양도하기",
        `${member.name}님에게 방장 권한을 넘기시겠습니까?`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "양도하기",
            onPress: () =>
              transferRoomOwnership(room.id, manageableUserId)
                .then(() =>
                  finishAction(
                    "방장 양도 완료",
                    `${member.name}님에게 방장 권한을 넘겼습니다.`,
                  ),
                )
                .catch((error) =>
                  Alert.alert("방장 양도 실패", serverErrorMessage(error)),
                ),
          },
        ],
      );
      return;
    }
    if (label === "강퇴하기") {
      Alert.alert("강퇴하기", `${member.name}님을 방에서 내보내시겠습니까?`, [
        { text: "취소", style: "cancel" },
        {
          text: "강퇴하기",
          style: "destructive",
          onPress: () =>
            kickOrBanRoomMember({
              roomId: room.id,
              userId: manageableUserId,
              ban: false,
            })
              .then(() =>
                finishAction("강퇴 완료", `${member.name}님을 내보냈습니다.`),
              )
              .catch((error) =>
                Alert.alert("강퇴 실패", serverErrorMessage(error)),
              ),
        },
      ]);
      return;
    }
    if (label === "채팅 금지 해제") {
      clearRoomMemberMute(room.id, manageableUserId)
        .then(() =>
          finishAction(
            "채팅 금지 해제 완료",
            `${member.name}님의 채팅 금지를 해제했습니다.`,
          ),
        )
        .catch((error) =>
          Alert.alert("채팅 금지 해제 실패", serverErrorMessage(error)),
        );
      return;
    }
    if (label === "채팅 금지") {
      Alert.alert("채팅 금지 기간 선택", undefined, [
        { text: "10초", onPress: () => applyMute(10, "10초") },
        { text: "30초", onPress: () => applyMute(30, "30초") },
        { text: "1분", onPress: () => applyMute(60, "1분") },
        { text: "5분", onPress: () => applyMute(300, "5분") },
        { text: "10분", onPress: () => applyMute(600, "10분") },
        { text: "1시간", onPress: () => applyMute(3600, "1시간") },
        { text: "취소", style: "cancel" },
      ]);
    }
  };
  const displayedAvatarUri = avatarRemoved
    ? undefined
    : (avatar?.uri ?? member.avatarUri);
  return (
    <SafeAreaView style={s.safe}>
      <EdgeBackLayer onBack={onBack} />
      <StatusBar style="light" />
      <TopBar
        title={editable && editMode ? "프로필 수정" : "프로필"}
        onBack={onBack}
        trailing={
          reportOnly
            ? "warning-outline"
            : canShowMenu
              ? "ellipsis-horizontal"
              : undefined
        }
        onTrailingPress={
          reportOnly
            ? () => void onReport?.()
            : canShowMenu
              ? () => setMenuOpen((value) => !value)
              : undefined
        }
      />
      {canShowMenu && menuOpen && (
        <View style={s.sheetLayer}>
          <Pressable
            accessibilityLabel="프로필 메뉴 닫기"
            onPress={() => setMenuOpen(false)}
            style={s.sheetDim}
          />
          <View style={s.profileActionMenu}>
            <View style={s.profileActionList}>
              {actions.map((label) => (
                <Pressable
                  key={label}
                  onPress={() => selectAction(label)}
                  style={s.profileActionRow}
                >
                  <Text style={s.profileActionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={s.memberProfilePage}
        >
          <Pressable
            accessibilityLabel={
              editable && editMode ? "프로필 사진 변경" : "프로필 사진 크게 보기"
            }
            onPress={pick}
          >
            <Avatar uri={displayedAvatarUri} size={96} />
          </Pressable>
          {editable && !editMode ? (
            <>
              <View style={s.memberProfileNameLine}>
                <Text style={s.memberProfileName}>{member.name}</Text>
                {member.owner ? (
                  <Badge text="방장" pink />
                ) : member.coHost ? (
                  <RNText style={s.badge}>부방장</RNText>
                ) : null}
              </View>
              <Text style={s.memberProfileRoom}>
                {room.name}에서 사용하는 프로필
              </Text>
              <View style={s.memberProfileCard}>
                <Text style={s.memberProfileLabel}>자기 소개</Text>
                <Text style={s.memberProfileIntro}>{member.intro}</Text>
              </View>
              <Pressable
                onPress={() => setEditMode(true)}
                style={s.profileEditShortcut}
              >
                <View style={s.profileEditIcon}>
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={colors.mint700}
                  />
                </View>
                <Text style={s.profileEditShortcutText}>프로필 편집</Text>
              </Pressable>
            </>
          ) : editable ? (
            <View style={s.memberProfileEditCard}>
              <LimitedField
                label="이름"
                value={name}
                onChange={(value) => setName(value.slice(0, 13))}
                placeholder="방에서 사용할 이름"
                limit={13}
              />
              <LimitedField
                label="자기 소개"
                value={intro}
                onChange={(value) => setIntro(value.slice(0, 60))}
                placeholder="자기 소개를 입력해주세요."
                limit={60}
                multiline
              />
              <Pressable
                disabled={saving || !name.trim() || !intro.trim()}
                onPress={save}
                style={[
                  s.profileSaveButton,
                  (saving || !name.trim() || !intro.trim()) && s.disabled,
                ]}
              >
                <LinearGradient
                  colors={
                    saving || !name.trim() || !intro.trim()
                      ? ["#C9D8D5", "#BFCAC7"]
                      : ["#82B9C1", "#5DBB8C"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.profileSaveGradient}
                >
                  <Text style={s.primaryText}>저장하기</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.memberProfileNameLine}>
                <Text style={s.memberProfileName}>{member.name}</Text>
                {member.owner ? (
                  <Badge text="방장" pink />
                ) : member.coHost ? (
                  <Badge text="부방장" />
                ) : null}
              </View>
              <Text style={s.memberProfileRoom}>
                {room.name}에서 사용하는 프로필
              </Text>
              <View style={s.memberProfileCard}>
                <Text style={s.memberProfileLabel}>자기 소개</Text>
                <Text style={s.memberProfileIntro}>{member.intro}</Text>
              </View>
              {showQuickActions && (
                <View style={s.memberProfileActions}>
                  {onHeart && (
                    <ProfileQuickAction
                      icon="heart-outline"
                      label="하트"
                      onPress={confirmHeart}
                    />
                  )}
                  {onPoint && (
                    <ProfileQuickAction
                      icon="cash-outline"
                      label="포인트"
                      onPress={() => setQuickAction("point")}
                    />
                  )}
                  {onSecret && (
                    <ProfileQuickAction
                      icon="mail-outline"
                      label="쪽지"
                      onPress={() => setQuickAction("secret")}
                    />
                  )}
                  {canShowMenu && (
                    <ProfileQuickAction
                      icon="ban-outline"
                      label={isMuted ? "금지 해제" : "채팅 금지"}
                      onPress={() =>
                        selectAction(isMuted ? "채팅 금지 해제" : "채팅 금지")
                      }
                    />
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {photoOpen && (
        <View style={s.photoViewer}>
          <ProfileCaptureGuard />
          <Pressable
            accessibilityLabel="프로필 사진 닫기"
            onPress={() => setPhotoOpen(false)}
            style={s.photoViewerDim}
          />
          <ExpoImage
            source={
              displayedAvatarUri
                ? { uri: displayedAvatarUri }
                : require("./assets/default-profile.png")
            }
            contentFit="cover"
            style={s.photoViewerImage}
          />
        </View>
      )}
      {quickAction && (
        <View style={s.sheetLayer}>
          <Pressable
            accessibilityLabel={`${quickAction === "point" ? "포인트" : "비밀 쪽지"} 보내기 닫기`}
            onPress={closeQuickAction}
            style={s.sheetDim}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.sheetKeyboard}
          >
            <View style={s.pointSendSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.pointSendTitle}>
                {quickAction === "point" ? "포인트 보내기" : "비밀 쪽지 보내기"}
              </Text>
              <Text style={s.pointSendBody}>
                {quickAction === "point"
                  ? `${member.name}님에게 1p부터 ${availablePoints.toLocaleString()}p까지 보낼 수 있어요.`
                  : `${member.name}님에게 보낼 비밀 쪽지를 입력해주세요.`}
              </Text>
              <TextInput
                autoFocus
                value={quickDraft}
                onChangeText={(value) => {
                  if (quickAction !== "point" || /^[0-9]*$/.test(value))
                    setQuickDraft(value);
                }}
                keyboardType={quickAction === "point" ? "number-pad" : "default"}
                multiline={quickAction === "secret"}
                maxLength={quickAction === "secret" ? 500 : 10}
                placeholder={quickAction === "point" ? "보낼 포인트" : "비밀 쪽지를 입력해주세요."}
                placeholderTextColor={colors.textMuted}
                style={[
                  s.pointSendInput,
                  quickAction === "secret" && s.profileSecretInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                ]}
              />
              <View style={s.pointSendActions}>
                <Pressable
                  disabled={quickSending}
                  onPress={closeQuickAction}
                  style={s.pointSendCancel}
                >
                  <Text style={s.pointSendCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  disabled={
                    quickSending ||
                    !quickDraft.trim() ||
                    (quickAction === "point" &&
                      (Number(quickDraft) < 1 || Number(quickDraft) > availablePoints))
                  }
                  onPress={() => void submitQuickAction()}
                  style={[
                    s.pointSendButton,
                    (quickSending ||
                      !quickDraft.trim() ||
                      (quickAction === "point" &&
                        (Number(quickDraft) < 1 || Number(quickDraft) > availablePoints))) &&
                      s.disabled,
                  ]}
                >
                  <LinearGradient
                    colors={["#82B9C1", "#5DBB8C"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.pointSendGradient}
                  >
                    <Text style={s.primaryText}>{quickSending ? "전송 중..." : "보내기"}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

function ProfileQuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  const pink = icon === "heart-outline" || icon === "heart";
  const fixedPoint = icon === "cash-outline" || icon === "mail-outline";
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[s.profileQuickAction, !onPress && s.profileQuickActionDisabled]}
    >
      {fixedPoint ? (
        <RNView
          style={[
            s.profileQuickActionIcon,
            { backgroundColor: FIXED_POINT_SOFT },
          ]}
        >
          <RNIonicons name={icon} size={22} color={FIXED_POINT_COLOR} />
        </RNView>
      ) : (
        <View
          style={[
            s.profileQuickActionIcon,
            pink && s.profileQuickActionIconPink,
          ]}
        >
          <Ionicons
            name={icon}
            size={22}
            color={pink ? colors.pink600 : colors.mint700}
          />
        </View>
      )}
      <Text style={s.profileQuickActionText}>{label}</Text>
    </Pressable>
  );
}

function NativeProfileCaptureGuard() {
  ScreenCapture.usePreventScreenCapture("mute-profile");
  return null;
}
function ProfileCaptureGuard() {
  return Platform.OS === "web" ? null : <NativeProfileCaptureGuard />;
}

function RoomOverview({
  room,
  onProfile,
}: {
  room: Room;
  onProfile: (member: RoomMember) => void;
}) {
  const [members, setMembers] = useState<RoomMember[]>(() =>
    isLocalDemoRoomId(room.id) ? membersForRoom(room) : [],
  );
  const [stories, setStories] = useState<StoryItem[]>(() =>
    isLocalDemoRoomId(room.id) ? initialStoryItems(room) : [],
  );
  const [loading, setLoading] = useState(!isLocalDemoRoomId(room.id));
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      setMembers(isLocalDemoRoomId(room.id) ? membersForRoom(room) : []);
      setStories(isLocalDemoRoomId(room.id) ? initialStoryItems(room) : []);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setLoadError("");
    Promise.all([
      supabase?.auth.getUser(),
      listRoomMembersVisible(room.id),
      listStories({ roomId: room.id, limit: 5 }),
    ])
      .then(([userResult, serverMembers, serverStories]) => {
        if (!active) return;
        const currentUserId = userResult?.data.user?.id;
        setMembers(mapRoomMembers(serverMembers, currentUserId));
        setStories(
          serverStories.map((story) => mapServerStory(story, currentUserId)),
        );
      })
      .catch((error) => {
        if (active) setLoadError(serverErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [room.id, room.memberCount]);
  if (loading)
    return (
      <View style={s.centerState}>
        <ActivityIndicator color={activeAppTheme.accent} />
        <Text style={s.centerStateText}>방 정보를 불러오고 있어요.</Text>
      </View>
    );
  if (loadError)
    return <Empty title="방 정보를 불러오지 못했어요" body={loadError} />;
  return (
    <ScrollView contentContainerStyle={s.overviewPage}>
      <DefaultRoomCover room={room} />
      <View style={s.overviewIntro}>
        <Text style={s.spaceTitle}>{room.name}</Text>
        <LinkedText style={s.spaceBody}>{room.description}</LinkedText>
      </View>
      <Text style={s.overviewSection}>멤버</Text>
      <View style={s.detailMemberGrid}>
        {members.map((member) => (
          <Pressable
            key={member.userId ?? member.name}
            onPress={() => onProfile(member)}
            style={s.detailMemberItem}
          >
            <Avatar uri={member.avatarUri} size={58} />
            <Text style={s.gridName}>{member.name}</Text>
            {member.owner ? (
              <Badge text="방장" pink />
            ) : member.coHost ? (
              <Badge text="부방장" />
            ) : null}
          </Pressable>
        ))}
      </View>
      <Text style={s.overviewSection}>스토리</Text>
      {stories.length ? (
        stories.map((story) => (
          <View key={story.id} style={s.overviewStory}>
            <Text numberOfLines={1} style={s.storyTitle}>
              {story.title}
            </Text>
            <LinkedText numberOfLines={2} style={s.storyBody}>
              {story.blocks
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join(" ")}
            </LinkedText>
          </View>
        ))
      ) : (
        <Text style={[s.emptyBody, { paddingHorizontal: 20 }]}>
          아직 작성된 스토리가 없어요.
        </Text>
      )}
    </ScrollView>
  );
}

function JoinRequests({ room }: { room: Room }) {
  const [requests, setRequests] = useState<
    { id: string; name: string; intro: string; status: string; avatarUri?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const processingRef = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const reload = () =>
      listPendingRoomJoinRequestsWithAvatars(room.id)
        .then((rows) => {
          if (active)
            setRequests(
              rows.map((row: {
                id: string;
                requested_name: string;
                requested_introduction: string;
                avatar_url?: string;
              }) => ({
                id: row.id,
                name: row.requested_name,
                intro: row.requested_introduction,
                avatarUri: row.avatar_url,
                status: "pending",
              })),
            );
        })
        .catch((error) => {
          if (active)
            Alert.alert(
              "가입 신청 목록 불러오기 실패",
              serverErrorMessage(error),
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    reload();
    const channel = supabase
      ?.channel(`join-request-list-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_join_requests",
          filter: `room_id=eq.${room.id}`,
        },
        reload,
      )
      .subscribe();
    return () => {
      active = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [room.id]);
  const decide = async (id: string, status: "approved" | "rejected") => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessingId(id);
    try {
      if (isSupabaseConfigured && isUuid(id))
        await decideRoomJoin(id, status === "approved");
      if (isSupabaseConfigured && isUuid(room.id))
        markRoomJoinRequestNotificationsRead(room.id).catch(() => undefined);
      setRequests((items) => items.filter((item) => item.id !== id));
      setToast(
        `가입 신청을 ${status === "approved" ? "승인" : "거절"}하였습니다.`,
      );
      setTimeout(() => setToast(""), 1800);
    } catch (error) {
      Alert.alert("처리 실패", serverErrorMessage(error));
    } finally {
      processingRef.current = false;
      setProcessingId(null);
    }
  };
  if (loading)
    return (
      <View style={s.centerState}>
        <ActivityIndicator color={colors.mint700} />
        <Text style={s.centerStateText}>가입 신청을 불러오고 있어요.</Text>
      </View>
    );
  if (requests.length === 0)
    return (
      <Empty
        title="가입 신청이 없어요"
        body="새 신청이 들어오면 이곳에 표시됩니다."
      />
    );
  return (
    <View style={s.flex}>
      <ScrollView contentContainerStyle={s.requestList}>
        {requests.map((item) => (
          <View key={item.id} style={s.requestCard}>
            <Avatar uri={item.avatarUri} size={52} />
            <View style={s.requestBody}>
              <Text style={s.memberName}>{item.name}</Text>
              <Text style={s.memberIntro}>{item.intro}</Text>
              {item.status === "pending" ? (
                <View style={s.requestActions}>
                  <Pressable
                    disabled={Boolean(processingId)}
                    onPress={() => decide(item.id, "rejected")}
                    style={s.rejectButton}
                  >
                    <Text style={s.rejectText}>거절</Text>
                  </Pressable>
                  <Pressable
                    disabled={Boolean(processingId)}
                    onPress={() => decide(item.id, "approved")}
                    style={s.approveButton}
                  >
                    <LinearGradient
                      colors={["#82B9C1", "#5DBB8C"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.approveGradient}
                    >
                      <Text style={s.primaryText}>승인</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : (
                <Text
                  style={[
                    s.requestResult,
                    item.status === "rejected" && s.requestRejected,
                  ]}
                >
                  {item.status === "approved"
                    ? "승인했습니다."
                    : "거절했습니다."}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      {toast !== "" && (
        <View pointerEvents="none" style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function BlockedMembers({ room }: { room: Room }) {
  const [items, setItems] = useState<
    { userId: string; reason: string; createdAt: string }[]
  >([]);
  const [departed, setDeparted] = useState<
    { userId: string; name: string; avatarUri?: string; leftAt?: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !isUuid(room.id)) {
      setItems([
        {
          userId: "demo-ban-001",
          reason: "내보내고 차단 · 반복 도배",
          createdAt: "2026.06.16",
        },
        {
          userId: "demo-ban-002",
          reason: "강퇴 후 재입장 차단 · 욕설 신고 누적",
          createdAt: "2026.06.14",
        },
        {
          userId: "demo-ban-003",
          reason: "수동 차단 · 비밀방 PIN 무단 공유",
          createdAt: "2026.06.10",
        },
      ]);
      setDeparted([]);
      setLoading(false);
      return;
    }
    Promise.all([
      listBlockedRoomMembers(room.id),
      listDepartedRoomMembers(room.id),
    ])
      .then(([rows, departedRows]) => {
        if (active)
          setItems(
            rows.map((row) => ({
              userId: row.user_id,
              reason: row.reason || "내보내고 차단함",
              createdAt: new Date(row.created_at).toLocaleDateString("ko-KR"),
            })),
          );
        if (active) setDeparted(departedRows);
      })
      .catch((error) =>
        Alert.alert("차단 목록 불러오기 실패", serverErrorMessage(error)),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [room.id]);
  const unblock = async (userId: string) => {
    try {
      if (isSupabaseConfigured && isUuid(room.id))
        await unbanRoomMember(room.id, userId);
      setItems((current) => current.filter((item) => item.userId !== userId));
    } catch (error) {
      Alert.alert("차단 해제 실패", serverErrorMessage(error));
    }
  };
  const blockDeparted = async (member: (typeof departed)[number]) => {
    try {
      await kickOrBanRoomMember({
        roomId: room.id,
        userId: member.userId,
        ban: true,
      });
      setDeparted((current) =>
        current.filter((item) => item.userId !== member.userId),
      );
      setItems((current) => [
        {
          userId: member.userId,
          reason: "",
          createdAt: new Date().toLocaleDateString("ko-KR"),
        },
        ...current,
      ]);
    } catch (error) {
      Alert.alert("차단 실패", serverErrorMessage(error));
    }
  };
  if (loading)
    return (
      <View style={s.centerState}>
        <ActivityIndicator color={colors.mint700} />
        <Text style={s.centerStateText}>차단 멤버를 불러오고 있어요.</Text>
      </View>
    );
  if (items.length === 0 && departed.length === 0)
    return (
      <Empty
        title="차단된 멤버가 없어요"
        body="내보내고 차단한 멤버를 여기서 관리할 수 있습니다."
      />
    );
  return (
    <ScrollView contentContainerStyle={s.memberPanel}>
      {departed.length > 0 && (
        <Text style={s.memberLabel}>최근 퇴장 멤버</Text>
      )}
      {departed.map((member) => (
        <View key={`departed-${member.userId}`} style={s.departedMember}>
          <Avatar uri={member.avatarUri} size={44} />
          <View style={s.flex}>
            <Text style={s.memberName}>{member.name}</Text>
            <Text style={s.memberIntro}>
              {member.leftAt
                ? new Date(member.leftAt).toLocaleDateString("ko-KR")
                : "퇴장 멤버"}
            </Text>
          </View>
          <Pressable
            onPress={() => blockDeparted(member)}
            style={s.blockButton}
          >
            <Text style={s.blockButtonText}>차단</Text>
          </Pressable>
        </View>
      ))}
      {departed.length > 0 && items.length > 0 && (
        <Text style={s.memberLabel}>차단 멤버</Text>
      )}
      {items.map((item) => (
        <View key={item.userId} style={s.departedMember}>
          <DefaultAvatar size={44} />
          <View style={s.flex}>
            <Text style={s.memberName}>차단 멤버</Text>
            <Text style={s.memberIntro}>
              {item.userId.slice(0, 8)} · {item.createdAt}
            </Text>
          </View>
          <Pressable
            onPress={() => unblock(item.userId)}
            style={[s.blockButton, s.blockButtonActive]}
          >
            <Text style={[s.blockButtonText, s.blockButtonTextActive]}>
              차단 풀기
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function CoHostSheet({
  member,
  onClose,
  onToggle,
  onTransfer,
  onKick,
  onBan,
}: {
  member: RoomMember | undefined;
  onClose: () => void;
  onToggle: () => void;
  onTransfer: () => void;
  onKick: () => void;
  onBan: () => void;
}) {
  if (!member) return null;
  return (
    <View style={s.sheetLayer}>
      <Pressable
        accessibilityLabel="멤버 관리 닫기"
        onPress={onClose}
        style={s.sheetDim}
      />
      <View style={s.coHostSheet}>
        <View style={s.sheetHandle} />
        <View style={s.sheetProfile}>
          <DefaultAvatar size={54} />
          <View>
            <Text style={s.sheetName}>{member.name}</Text>
            <Text style={s.sheetIntro}>
              {member.userId?.slice(0, 8)} · userID 기준 관리
            </Text>
          </View>
        </View>
        <Pressable onPress={onToggle} style={s.memberRoleAction}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={colors.mint700}
          />
          <Text style={s.memberRoleActionText}>
            {member.coHost ? "부방장 권한 해제하기" : "부방장 권한 추가하기"}
          </Text>
        </Pressable>
        <Pressable onPress={onTransfer} style={s.memberRoleAction}>
          <Ionicons
            name="swap-horizontal-outline"
            size={20}
            color={colors.mint700}
          />
          <Text style={s.memberRoleActionText}>방장 권한 위임하기</Text>
        </Pressable>
        <Pressable onPress={onKick} style={s.memberRoleAction}>
          <Ionicons name="exit-outline" size={20} color={colors.textSubtle} />
          <Text style={s.memberRoleActionText}>내보내기</Text>
        </Pressable>
        <Pressable onPress={onBan} style={s.memberRoleAction}>
          <Ionicons name="ban-outline" size={20} color={colors.pink600} />
          <Text style={[s.memberRoleActionText, s.danger]}>
            내보내고 차단하기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type PointLogRow =
  | { kind: "date"; key: string; label: string }
  | {
      kind: "item";
      key: string;
      time: string;
      title: string;
      amount: number;
      balance: number;
    };

function PointLogScreen({
  points,
  onBack,
}: {
  points: number;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<PointLogRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listPointLedger()
      .then((items) => {
        if (!active) return;
        let runningBalance = Number.isFinite(points) ? points : 0;
        let lastDate = "";
        const nextRows = items.flatMap((item, index) => {
          const timestamp = Date.parse(String(item?.createdAt ?? ""));
          const date = Number.isFinite(timestamp)
            ? new Date(timestamp)
            : new Date();
          const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const timeLabel = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          const amount = Number.isFinite(Number(item?.amount))
            ? Number(item?.amount)
            : 0;
          const balanceAfter = runningBalance;
          runningBalance -= amount;
          const rendered: PointLogRow[] = [];
          if (dateLabel !== lastDate) {
            rendered.push({
              kind: "date",
              key: `date-${dateLabel}-${index}`,
              label: dateLabel,
            });
            lastDate = dateLabel;
          }
          rendered.push({
            kind: "item",
            key: item?.id || `point-${index}`,
            time: timeLabel,
            title: pointReasonLabel(String(item?.reason || "admin_point")),
            amount,
            balance: Number.isFinite(balanceAfter) ? balanceAfter : 0,
          });
          return rendered;
        });
        setRows(nextRows);
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setError(serverErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [points]);
  return (
    <SafeAreaView style={s.pointLogPage}>
      <StatusBar style="light" />
      <TopBar title="포인트 내역" onBack={onBack} />
      {loading ? (
        <View style={s.centerState}>
          <ActivityIndicator color={colors.mint700} />
          <Text style={s.centerStateText}>포인트 내역을 불러오고 있어요.</Text>
        </View>
      ) : !rows.length ? (
        <Empty
          title={error ? "포인트 내역을 불러오지 못했어요" : "포인트 내역이 없어요"}
          body={error || "출석체크, 광고 보상, 구매 내역이 이곳에 표시됩니다."}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={s.pointLogScroll}
        >
          {rows.map((item) =>
            item.kind === "date" ? (
              <Text key={item.key} style={s.pointLogDate}>
                {item.label}
              </Text>
            ) : (
              <View key={item.key} style={s.pointLogRow}>
                <Text style={s.pointLogTime}>{item.time}</Text>
                <Text numberOfLines={2} style={s.pointLogTitle}>
                  {item.title}
                </Text>
                <Text
                  style={[
                    s.pointLogAmount,
                    item.amount >= 0 ? s.pointLogPlus : s.pointLogMinus,
                  ]}
                >
                  {item.amount >= 0 ? `+${item.amount}` : String(item.amount)}
                </Text>
                <Text style={s.pointLogBalance}>
                  (
                  {Number.isFinite(item.balance)
                    ? item.balance.toLocaleString()
                    : "0"}
                  )
                </Text>
              </View>
            ),
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PaymentHistoryScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<StoreTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listStoreTransactions()
      .then((next) => {
        if (!mounted) return;
        setItems(next);
        setError("");
      })
      .catch((err) => {
        if (!mounted) return;
        setItems([]);
        setError(serverErrorMessage(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const renderPayment = ({ item }: { item: StoreTransactionItem }) => {
    const title = item.productId || item.entitlementType || "결제 내역";
    const subtitle = [
      item.provider || "store",
      item.environment || "",
      formatCompactDate(item.createdAt),
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <View style={s.paymentHistoryRow}>
        <View style={s.paymentHistoryIcon}>
          <Ionicons name="receipt-outline" size={18} color={colors.mint700} />
        </View>
        <View style={s.paymentHistoryBody}>
          <Text numberOfLines={1} style={s.paymentHistoryTitle}>
            {title}
          </Text>
          <Text numberOfLines={1} style={s.paymentHistorySubtitle}>
            {subtitle}
          </Text>
        </View>
        <Text style={s.paymentHistoryAmount}>
          {item.pointsAwarded > 0
            ? `+${item.pointsAwarded.toLocaleString()}P`
            : item.entitlementType
              ? "구독"
              : "-"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.pointLogPage}>
      <StatusBar style="light" />
      <TopBar title="결제 내역" onBack={onBack} />
      {loading ? (
        <View style={s.centerState}>
          <ActivityIndicator color={colors.mint700} />
          <Text style={s.centerStateText}>결제 내역을 불러오고 있어요.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="never"
          ListEmptyComponent={
            <Empty
              title={error ? "결제 내역을 불러오지 못했어요" : "결제 내역이 없어요"}
              body={error || "결제 내역이 생기면 이곳에 표시됩니다."}
            />
          }
          renderItem={renderPayment}
        />
      )}
    </SafeAreaView>
  );
}

function ItemShopScreen({
  points,
  currentUserId,
  onBack,
  onRecharge,
  onPointBalanceChange,
}: {
  points: number;
  currentUserId?: string;
  onBack: () => void;
  onRecharge: () => void;
  onPointBalanceChange: (value: number) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [storeItems, setStoreItems] = useState<
    Array<{ productId: string; type: string; expiresAt: string | null }>
  >([]);
  const theme = useAppTheme();
  const darkTheme = theme.id === "dark";
  const primaryTextColor = themeForeground(theme);
  const [themeChoice, setThemeChoice] = useState(theme.id);
  const reload = async () => {
    const [store, wallet] = await Promise.all([
      listStoreEntitlements(),
      getMyWallet(),
    ]);
    setStoreItems(store);
    if (currentUserId)
      await cacheThemeProductIds(
        currentUserId,
        store.map((item) => item.productId),
      ).catch(() => undefined);
    onPointBalanceChange(wallet.pointBalance);
  };
  useEffect(() => {
    if (currentUserId)
      void readCachedThemeProductIds(currentUserId)
        .then((productIds) =>
          setStoreItems((current) =>
            current.length
              ? current
              : productIds.map((productId) => ({
                  productId,
                  type: "app_theme",
                  expiresAt: null,
                })),
          ),
        )
        .catch(() => undefined);
    void reload().catch(() => undefined);
  }, [currentUserId]);
  const buyStoreItem = async (productId: string, selectedTheme?: AppTheme) => {
    if (busy) return;
    setBusy(productId);
    try {
      await purchaseStoreProduct(productId);
      if (selectedTheme) selectAppTheme(selectedTheme, currentUserId);
      await reload();
      Alert.alert("구매 완료", selectedTheme ? "테마가 적용되었습니다." : "광고 제거가 적용되었습니다.");
    } catch (error) {
      Alert.alert("구매 실패", serverErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };
  const restoreStoreItems = async () => {
    if (busy) return;
    setBusy("restore");
    try {
      const result = await restoreStorePurchases();
      if (result.pointBalance > 0) onPointBalanceChange(result.pointBalance);
      await reload();
      Alert.alert(
        "구매 복원",
        result.restored > 0
          ? "구매 내역을 복원했습니다."
          : "복원할 새 구매 내역이 없습니다.",
      );
    } catch (error) {
      Alert.alert("복원 실패", serverErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };
  const selectedTheme = APP_THEMES.find((item) => item.id === themeChoice) ?? APP_THEMES[0];
  const selectedThemeOwned =
    !selectedTheme.productId ||
    storeItems.some(
      (item) =>
        item.productId === selectedTheme.productId ||
        (selectedTheme.legacyProductIds ?? []).includes(item.productId),
    );
  const adFree = storeItems.find(
    (item) =>
      item.productId === STORE_PRODUCTS.adFreeMonthly &&
      (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
  );
  return (
    <SafeAreaView style={[s.safe, darkTheme && { backgroundColor: "#222222" }]}>
      <StatusBar style="dark" />
      <TopBar title="아이템샵" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          s.itemShopPage,
          darkTheme && { backgroundColor: "#222222" },
        ]}
      >
        <Text style={s.itemShopSectionTitle}>앱 테마</Text>
        <View style={s.itemShopThemeList}>
          {APP_THEMES.map((item) => {
            const free = !item.productId;
            const owned =
              free ||
              storeItems.some(
                (ownedItem) =>
                  ownedItem.productId === item.productId ||
                  (item.legacyProductIds ?? []).includes(ownedItem.productId),
              );
            const selected = themeChoice === item.id;
            return (
              <Pressable
                key={item.id}
                disabled={Boolean(busy)}
                onPress={() => setThemeChoice(item.id)}
                style={s.itemShopThemeCard}
              >
                <ExpoLinearGradient
                  colors={item.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    s.itemShopThemePreview,
                    item.id === "white" && s.itemShopThemePreviewWhite,
                  ]}
                >
                  <Image
                    source={require("./assets/mute-logo-white.png")}
                    resizeMode="contain"
                    style={[
                      s.itemShopThemeLogo,
                      item.id === "white" && s.itemShopThemeLogoDark,
                    ]}
                  />
                </ExpoLinearGradient>
                <View style={s.itemShopThemeCopy}>
                  <Text style={s.itemShopCardTitle}>{item.name}</Text>
                  <Text style={s.itemShopPrice}>
                    {free
                      ? "기본 제공"
                      : owned
                        ? "보유 중 · 영구 소장"
                        : `${(item.priceKrw ?? 3900).toLocaleString()}원 · 영구 소장`}
                  </Text>
                </View>
                <Pressable
                  disabled={Boolean(busy)}
                  onPress={() => setThemeChoice(item.id)}
                  style={[s.itemShopRadio, selected && { borderColor: item.accent }]}
                >
                  {selected && <View style={[s.itemShopRadioDot, { backgroundColor: item.accent }]} />}
                </Pressable>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          disabled={Boolean(busy)}
                onPress={() =>
                  selectedThemeOwned
                    ? selectAppTheme(selectedTheme, currentUserId)
                    : selectedTheme.productId
                      ? void buyStoreItem(selectedTheme.productId, selectedTheme)
                      : selectAppTheme(selectedTheme, currentUserId)
                }
          style={s.itemShopThemeBuy}
        >
          <LinearGradient colors={["#82B9C1", "#5DBB8C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.itemShopBuyGradient}>
            {busy === selectedTheme.productId ? (
              <ActivityIndicator size="small" color={primaryTextColor} />
            ) : (
              <Text style={[s.itemShopBuyText, { color: primaryTextColor }]}>
                {selectedThemeOwned
                  ? "적용하기"
                  : `${(selectedTheme.priceKrw ?? 3900).toLocaleString()}원 구매`}
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={s.itemShopSectionTitle}>광고 제거</Text>
        <View style={s.itemShopAdCard}>
          <MuteLogo symbolOnly compact />
          <View style={s.flex}>
            <Text style={s.itemShopCardTitle}>광고 없는 계정</Text>
            <Text style={s.itemShopPrice}>{adFree ? "이용 중" : "월 5,900원"}</Text>
          </View>
          <Pressable disabled={Boolean(busy) || Boolean(adFree)} onPress={() => void buyStoreItem(STORE_PRODUCTS.adFreeMonthly)} style={[s.itemShopAdBuy, adFree && s.disabled]}>
            <LinearGradient colors={["#82B9C1", "#5DBB8C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.itemShopBuyGradient}>
              {busy === STORE_PRODUCTS.adFreeMonthly ? (
                <ActivityIndicator size="small" color={primaryTextColor} />
              ) : (
                <Text style={[s.itemShopAdBuyText, { color: primaryTextColor }]}>{adFree ? "이용 중" : "구매하기"}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
        {!adFree && (
        <Pressable
          disabled={Boolean(busy)}
          onPress={() => void restoreStoreItems()}
          style={s.itemShopRestore}
        >
          {busy === "restore" ? (
            <ActivityIndicator size="small" color={colors.mint700} />
          ) : (
            <Text style={s.itemShopRestoreText}>구매 복원</Text>
          )}
        </Pressable>
        )}
      </ScrollView>
      <View
        style={[
          s.itemShopFooter,
          darkTheme && {
            backgroundColor: "#292929",
            borderTopColor: "#3C3C3C",
          },
        ]}
      >
        <View>
          <Text style={s.itemShopFooterLabel}>보유 포인트</Text>
          <Text style={s.itemShopFooterPoints}>{points.toLocaleString()} P</Text>
        </View>
        <Pressable onPress={onRecharge} style={s.itemShopRecharge}>
          <LinearGradient colors={["#82B9C1", "#5DBB8C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.itemShopRechargeGradient}>
            <Text style={[s.itemShopBuyText, { color: primaryTextColor }]}>충전하기</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Profile({
  points,
  currentUserId,
  now: parentNow,
  attendanceAvailableAt,
  rewardedAdAvailable,
  rewardLoading,
  onAttendance,
  onRewardedAd,
  onRanking,
  onSettings,
  onPointBalanceChange,
  onSubpageChange,
}: {
  points: number;
  currentUserId?: string;
  now: number;
  attendanceAvailableAt: number;
  rewardedAdAvailable: boolean;
  rewardLoading: "attendance" | "rewarded_ad" | null;
  onAttendance: () => void;
  onRewardedAd: () => void;
  onRanking: () => void;
  onSettings: () => void;
  onPointBalanceChange: (value: number) => void;
  onSubpageChange?: (open: boolean) => void;
}) {
  const theme = useAppTheme();
  const rewardTextColor = themeForeground(theme);
  const rewardActiveColors: [string, string] =
    theme.id === "dark" ? ["#3A3A3A", "#343434"] : ["#82B9C1", "#5DBB8C"];
  const rewardDisabledColors: [string, string] =
    theme.id === "dark" ? ["#2F2F2F", "#2A2A2A"] : ["#C9D8D5", "#BFCAC7"];
  const [shopOpen, setShopOpen] = useState(false);
  const [itemShopOpen, setItemShopOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState(0);
  const [chargeBusy, setChargeBusy] = useState(false);
  const [now, setNow] = useState(parentNow);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    onSubpageChange?.(logOpen || itemShopOpen);
    return () => onSubpageChange?.(false);
  }, [itemShopOpen, logOpen, onSubpageChange]);
  const openOperationsPolicy = () => {
    Linking.openURL(getOperationsPolicyUrl()).catch((error) =>
      Alert.alert("열기 실패", serverErrorMessage(error)),
    );
  };
  const rawAttendanceRemaining = Math.max(0, attendanceAvailableAt - now);
  const attendanceReady = rawAttendanceRemaining <= 500;
  const rewardedAdReady = rewardedAdAvailable || attendanceReady;
  const remaining = attendanceReady ? 0 : rawAttendanceRemaining;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const countdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const attendance = () => {
    if (rewardLoading) return;
    Alert.alert("출석 체크", "출석 체크 할까요?", [
      { text: "취소", style: "cancel" },
      { text: "출석하기", onPress: onAttendance },
    ]);
  };
  const chargeOptions = [
    { p: 5000, w: 1200, productId: STORE_PRODUCTS.point5000 },
    { p: 11000, w: 2500, productId: STORE_PRODUCTS.point11000 },
    { p: 28000, w: 5900, productId: STORE_PRODUCTS.point28000 },
    { p: 60000, w: 12000, productId: STORE_PRODUCTS.point60000 },
    { p: 200000, w: 37000, productId: STORE_PRODUCTS.point200000 },
    { p: 390000, w: 65000, productId: STORE_PRODUCTS.point390000 },
  ];
  if (logOpen)
    return (
      <PointLogScreen
        points={points}
        onBack={() => setLogOpen(false)}
      />
    );
  if (itemShopOpen)
    return (
      <ItemShopScreen
        points={points}
        currentUserId={currentUserId}
        onBack={() => setItemShopOpen(false)}
        onRecharge={() => {
          setItemShopOpen(false);
          setShopOpen(true);
        }}
        onPointBalanceChange={onPointBalanceChange}
      />
    );
  return (
    <View style={s.flex}>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.pointCard}>
          <View>
            <Text style={s.pointLabel}>보유 포인트</Text>
            <Text style={s.pointValue}>{points.toLocaleString()} P</Text>
          </View>
          <Pressable onPress={() => setShopOpen(true)} style={s.pointButton}>
            <RNText
              style={[
                s.pointButtonText,
                theme.id !== "white" && { color: theme.accent },
              ]}
            >
              충전하기
            </RNText>
          </Pressable>
        </View>
        <View style={s.profileMenuGroup}>
          <Pressable onPress={() => setLogOpen(true)} style={s.profileMenu}>
            <Ionicons
              name="wallet-outline"
              size={19}
              color={colors.textSubtle}
            />
            <Text style={s.menuTitle}>포인트 내역</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.gray300} />
          </Pressable>
          <Pressable onPress={() => setItemShopOpen(true)} style={s.profileMenu}>
            <Ionicons name="bag-handle-outline" size={19} color={colors.textSubtle} />
            <Text style={s.menuTitle}>아이템샵</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.gray300} />
          </Pressable>
          <Pressable onPress={onRanking} style={s.profileMenu}>
            <Ionicons
              name="trophy-outline"
              size={19}
              color={colors.textSubtle}
            />
            <Text style={s.menuTitle}>명예의 전당</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.gray300} />
          </Pressable>
          <Pressable onPress={onSettings} style={s.profileMenu}>
            <Ionicons
              name="settings-outline"
              size={19}
              color={colors.textSubtle}
            />
            <Text style={s.menuTitle}>설정</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.gray300} />
          </Pressable>
        </View>
        <View style={s.rewardSection}>
          <Pressable
            disabled={!attendanceReady || Boolean(rewardLoading)}
            onPress={attendance}
            style={[
              s.rewardButton,
              (!attendanceReady || Boolean(rewardLoading)) &&
                s.rewardButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                !attendanceReady || rewardLoading
                  ? rewardDisabledColors
                  : rewardActiveColors
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.rewardGradient}
            >
              <Text style={[s.rewardTitle, { color: rewardTextColor }]}>
                {!attendanceReady
                  ? `${countdown} 후 출석 체크`
                  : rewardLoading === "attendance"
                    ? "광고 로드 중"
                    : "출석 체크"}
              </Text>
              <Text style={[s.rewardPoints, { color: rewardTextColor }]}>20 P</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            disabled={!rewardedAdReady || Boolean(rewardLoading)}
            onPress={onRewardedAd}
            style={[
              s.rewardButton,
              (!rewardedAdReady || Boolean(rewardLoading)) &&
                s.rewardButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                rewardedAdReady && !rewardLoading
                  ? rewardActiveColors
                  : rewardDisabledColors
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.rewardGradient}
            >
              <Text style={[s.rewardTitle, { color: rewardTextColor }]}>
                {rewardLoading === "rewarded_ad"
                  ? "광고 로드 중"
                  : "광고 보고 포인트 더 받기"}
              </Text>
              <Text style={[s.rewardPoints, { color: rewardTextColor }]}>
                {rewardedAdReady ? "10 P" : "이번 보상 완료"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
      {rewardLoading && (
        <View pointerEvents="none" style={s.toast}>
          <Text style={s.toastText}>
            광고가 로드되는 중입니다. 잠시만 기다려주세요
          </Text>
        </View>
      )}
      {shopOpen && (
        <View style={s.chargeLayer}>
          <Pressable
            style={s.chargeDim}
            onPress={() => {
              if (!chargeBusy) setShopOpen(false);
            }}
          />
          <View style={s.chargeModal}>
            <Text style={s.chargeTitle}>포인트 충전</Text>
            {chargeOptions.map((option, index) => (
              <Pressable
                key={option.p}
                disabled={chargeBusy}
                onPress={() => setSelectedCharge(index)}
                style={s.chargeOption}
              >
                <View
                  style={[
                    s.chargeRadio,
                    selectedCharge === index && s.chargeRadioOn,
                  ]}
                />
                <View>
                  <Text style={s.chargePoint}>
                    {option.p.toLocaleString()}p
                  </Text>
                  <Text style={s.chargeWon}>{option.w.toLocaleString()}원</Text>
                </View>
              </Pressable>
            ))}
            <View style={s.chargeActions}>
              <Pressable
                disabled={chargeBusy}
                onPress={() => setShopOpen(false)}
                style={s.chargeAction}
              >
                <Text style={s.chargeCancel}>취소</Text>
              </Pressable>
              <Pressable
                disabled={chargeBusy}
                onPress={async () => {
                  const option = chargeOptions[selectedCharge];
                  if (!option || chargeBusy) return;
                  setChargeBusy(true);
                  try {
                    const result = await purchaseStoreProduct(option.productId);
                    onPointBalanceChange(result.pointBalance);
                    Alert.alert(
                      "구매 완료",
                      "충전 상품 결제 요청을 보냈습니다.",
                    );
                    setShopOpen(false);
                  } catch (error) {
                    Alert.alert("구매 실패", serverErrorMessage(error));
                  } finally {
                    setChargeBusy(false);
                  }
                }}
                style={s.chargeAction}
              >
                <Text
                  style={[
                    s.chargeBuy,
                    selectedCharge >= 0 && s.chargeBuyActive,
                  ]}
                >
                  {chargeBusy ? "처리 중" : "구매"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function StoreCard({
  icon,
  title,
  body,
  price,
}: {
  icon: IconName;
  title: string;
  body: string;
  price: string;
}) {
  const buy = async () => {
    const productId =
      title === "광고 없는 계정"
        ? STORE_PRODUCTS.adFreeMonthly
        : title === "커스텀 색상"
          ? STORE_PRODUCTS.customBubbleColor
          : null;
    if (!productId) {
      Alert.alert(
        title,
        "채팅방의 붓 아이콘에서 색상을 선택하고 구매할 수 있습니다.",
      );
      return;
    }
    try {
      if (productId === STORE_PRODUCTS.adFreeMonthly) {
        await purchaseStoreProduct(productId);
      } else {
        await purchaseProduct(productId);
      }
      Alert.alert("구매 완료", "상품이 계정에 적용되었습니다.");
    } catch (error) {
      Alert.alert("구매 준비 필요", serverErrorMessage(error));
    }
  };
  return (
    <Pressable onPress={buy} style={s.storeCard}>
      <View style={s.storeIcon}>
        <Ionicons name={icon} size={23} color={colors.mint700} />
      </View>
      <View style={s.flex}>
        <Text style={s.storeTitle}>{title}</Text>
        <Text style={s.storeBody}>{body}</Text>
      </View>
      <Text style={s.storePrice}>{price}</Text>
    </Pressable>
  );
}

function EditRoom({
  room,
  onBack,
  onUpdated,
}: {
  room: Room;
  onBack: () => void;
  onUpdated: (room: Room) => void;
}) {
  const initialType: "member" | "concept" | "region" | "adult" = room.isAdult
    ? "adult"
    : room.region
      ? "region"
      : room.category === "concept"
        ? "concept"
        : "member";
  const [name, setName] = useState(room.name ?? "");
  const [description, setDescription] = useState(room.description ?? "");
  const [roomType, setRoomType] = useState(initialType);
  const [region, setRegion] = useState(room.region ?? "");
  const currentMemberCount = Math.max(1, Number(room.memberCount) || 1);
  const [maxMembers, setMaxMembers] = useState(
    Math.min(80, Math.max(currentMemberCount, Number(room.maxMembers) || 5)),
  );
  const [coverAsset, setCoverAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const nameInputRef = useRef<React.ElementRef<typeof RNTextInput> | null>(null);
  const descriptionInputRef = useRef<React.ElementRef<typeof RNTextInput> | null>(null);
  const regionInputRef = useRef<React.ElementRef<typeof RNTextInput> | null>(null);
  const maxMembersInputRef = useRef<React.ElementRef<typeof RNTextInput> | null>(null);
  const appTheme = useAppTheme();
  const blurRoomEditInputs = useCallback(() => {
    nameInputRef.current?.blur();
    descriptionInputRef.current?.blur();
    regionInputRef.current?.blur();
    maxMembersInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);
  const goBackSafely = useCallback(() => {
    blurRoomEditInputs();
    if (Platform.OS === "ios") setTimeout(onBack, 80);
    else onBack();
  }, [blurRoomEditInputs, onBack]);
  const setCapacity = (value: number) =>
    setMaxMembers(
      Math.min(80, Math.max(currentMemberCount, value || currentMemberCount)),
    );
  const pickCover = async () => {
    try {
      const source = await promptImageSource({
        allowDelete: Boolean(coverAsset || room.coverUri),
      });
      if (!source) return;
      if (source === "remove") {
        setCoverAsset(null);
        setCoverRemoved(true);
        return;
      }
      const asset = await pickSingleImage({
        source,
        aspect: [1, 1],
        quality: 0.78,
      });
      if (asset) {
        setCoverAsset(asset);
        setCoverRemoved(false);
      }
    } catch (error) {
      Alert.alert("대표 이미지 선택 실패", serverErrorMessage(error));
    }
  };
  const disabled =
    saving ||
    !name.trim() ||
    !description.trim() ||
    !Number.isFinite(maxMembers) ||
    maxMembers < currentMemberCount ||
    maxMembers > 80;
  const save = async () => {
    if (disabled || savingRef.current) return;
    savingRef.current = true;
    blurRoomEditInputs();
    setSaving(true);
    try {
      await updateRoom({
        roomId: room.id,
        name: name.trim(),
        description: description.trim(),
        category: roomType,
        maxMembers,
        region: roomType === "region" ? region.trim() : undefined,
      });
      let coverUri = room.coverUri;
      if (coverRemoved) {
        await clearRoomCover(room.id);
        coverUri = undefined;
      }
      if (coverAsset) {
        const resized = await resizeLocalImage(coverAsset.uri, 720, 0.72);
        const bytes = await (await fetch(resized.uri)).arrayBuffer();
        const upload = await uploadValidatedImage({
          uri: resized.uri,
          mimeType: "image/jpeg",
          fileSize: bytes.byteLength,
          width: resized.width,
          height: resized.height,
          purpose: "room-cover",
          roomId: room.id,
        });
        await setRoomCover(room.id, upload.uploadId);
        coverUri = resized.uri;
      }
      const nextTags = [
        ...new Set([
          ...extractHashTags(description),
          room.isPrivate
            ? "비밀방"
            : roomType === "concept"
              ? "콘셉트"
              : roomType === "adult"
                ? "성인"
                : roomType === "region"
                  ? region.trim() || "지역별"
                  : "Member",
        ]),
      ];
      const savedRoom = await getRoomById(room.id).catch(() => null);
      const nextRoom: Room = savedRoom
        ? mapServerRoom(savedRoom)
        : {
            ...room,
            name: name.trim(),
            description: description.trim(),
            maxMembers,
            region: roomType === "region" ? region.trim() : undefined,
            category:
              roomType === "concept"
                ? "concept"
                : roomType === "member"
                  ? "member"
                  : "general",
            isAdult: roomType === "adult",
            isPrivate: room.isPrivate,
            coverUri,
            updatedAt: Date.now(),
            tags: nextTags,
          };
      const finish = () => onUpdated(nextRoom);
      if (Platform.OS === "ios") setTimeout(finish, 500);
      else finish();
    } catch (error) {
      Alert.alert("방 수정 실패", serverErrorMessage(error));
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" hidden={false} />
      <TopBar title="방 편집하기" onBack={goBackSafely} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.form}
        >
          <Pressable
            accessibilityLabel="대표 이미지 선택"
            onPress={pickCover}
            style={s.uploadRound}
          >
            {!coverRemoved && (coverAsset?.uri || room.coverUri) ? (
              <Image
                source={{ uri: coverAsset?.uri ?? room.coverUri }}
                style={s.uploadRoundImage}
              />
            ) : (
              <Ionicons
                name="camera-outline"
                size={28}
                color={colors.mint700}
              />
            )}
          </Pressable>
          <LimitedField
            inputRef={nameInputRef}
            label="방 이름"
            value={name}
            onChange={(value) => setName(value.slice(0, 13))}
            placeholder="방제를 입력해주세요."
            limit={13}
          />
          <LimitedField
            inputRef={descriptionInputRef}
            label="방 설명"
            value={description}
            onChange={(value) => setDescription(value.slice(0, 120))}
            placeholder="방 설명을 입력해주세요."
            limit={120}
            multiline
          />
          <View style={s.field}>
            <Text style={s.fieldLabel}>분류</Text>
            <View style={s.radioList}>
              {(
                [
                   ["member", "Member", false, undefined],
                   ["concept", "콘셉트", false, undefined],
                   ["region", "지역별", false, undefined],
                   [
                      "adult",
                      Platform.OS === "ios" ? "인증 필요" : "성인",
                      Platform.OS === "ios",
                      "현재 iOS에서 지원되지 않는 기능입니다.",
                   ],
                 ] as const
              ).map(([value, label, typeDisabled, disabledReason]) => (
                <Pressable
                    key={value}
                    disabled={typeDisabled}
                    onPress={() => setRoomType(value)}
                    style={[s.radioRow, typeDisabled && s.radioDisabled]}
                 >
                  <View
                    style={[
                      s.radioCircle,
                      roomType === value && s.radioCircleActive,
                    ]}
                  >
                    {roomType === value && <View style={s.radioDot} />}
                  </View>
                  <Text
                    style={[s.radioText, typeDisabled && s.radioTextDisabled]}
                  >
                    {label}
                  </Text>
                  {typeDisabled && disabledReason ? (
                    <Text style={s.radioReason}>{disabledReason}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
            {roomType === "region" && (
              <View style={s.regionFieldWrap}>
                <View style={s.inlineLabelRow}>
                  <Text style={s.fieldLabel}>지역</Text>
                  <Text style={s.inlineOptionalLabel}>(선택사항)</Text>
                </View>
                <TextInput
                  ref={regionInputRef}
                  value={region}
                  maxLength={20}
                  onChangeText={setRegion}
                  placeholder="ex. 경기 남부, 서울"
                  placeholderTextColor={colors.textMuted}
                  style={s.input}
                />
              </View>
            )}
          </View>
          <View style={s.field}>
            <View style={s.capacityLine}>
              <Text style={s.fieldLabel}>최대 인원</Text>
              <Text style={s.capacityHintInline}>
                (현재 {room.memberCount}명, 최대 80명)
              </Text>
            </View>
            <View style={s.stepper}>
              <Pressable
                allowRapidPress
                onPress={() => setCapacity(maxMembers - 1)}
                style={s.stepperButton}
              >
                <Ionicons name="remove" size={20} color={colors.textSubtle} />
              </Pressable>
              <TextInput
                ref={maxMembersInputRef}
                keyboardType="number-pad"
                value={`${maxMembers}`}
                onChangeText={(value) =>
                  setCapacity(Number(value.replace(/[^0-9]/g, "")))
                }
                style={s.stepperInput}
              />
              <Text style={s.stepperUnit}>명</Text>
              <Pressable
                allowRapidPress
                onPress={() => setCapacity(maxMembers + 1)}
                style={s.stepperButton}
              >
                <Ionicons name="add" size={20} color={colors.textSubtle} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <View style={[s.sticky, appTheme.id === "dark" && s.stickyDark]}>
          <Pressable
            disabled={disabled}
            onPress={save}
            style={[s.primary, disabled && s.disabled]}
          >
            <LinearGradient
              colors={
                disabled
                  ? appTheme.id === "dark"
                    ? ["#3A3A3A", "#343434"]
                    : ["#C9D8D5", "#BFCAC7"]
                  : ["#82B9C1", "#5DBB8C"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {saving ? "수정 중..." : "수정하기"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CreateRoom({
  adultVerified,
  showAdultTab,
  onBack,
  onCreated,
}: {
  adultVerified: boolean;
  showAdultTab: boolean;
  onBack: () => void;
  onCreated: (room: Room) => void;
}) {
  const appTheme = useAppTheme();
  const disabledGradient: [string, string] =
    appTheme.id === "dark" ? ["#343434", "#303030"] : ["#C9D8D5", "#BFCAC7"];
  const activeGradient: [string, string] =
    appTheme.id === "dark" ? ["#3A3A3A", "#343434"] : ["#82B9C1", "#5DBB8C"];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileIntro, setProfileIntro] = useState("");
  const [region, setRegion] = useState("");
  const [profileAvatar, setProfileAvatar] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [maxMembers, setMaxMembers] = useState(1);
  const [roomType, setRoomType] = useState<
    "member" | "concept" | "region" | "adult"
  >("member");
  const [coverAsset, setCoverAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const coverUri = coverAsset?.uri ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [pin, setPin] = useState("");
  const formScrollRef = useRef<React.ElementRef<typeof RNScrollView> | null>(null);
  const regionFieldY = useRef(0);
  const capacityFieldY = useRef(0);
  const setCapacity = (value: number) =>
    setMaxMembers(Math.min(80, Math.max(1, value || 1)));
  const scrollCreateField = (y: number, anchorBottom = false) =>
    setTimeout(() => {
      if (anchorBottom) {
        formScrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      formScrollRef.current?.scrollTo({
        y: Math.max(0, y - 84),
        animated: true,
      });
    }, 140);
  const types: [typeof roomType, string, boolean, string?][] = [
    ["member", "Member", false],
    ["concept", "콘셉트", false],
    ["region", "지역별", false],
    [
      "adult",
      adultVerified ? "성인" : "인증 필요",
      !adultVerified,
      Platform.OS === "ios"
        ? "현재 iOS에서 지원되지 않는 기능입니다."
        : "성인 인증이 필요합니다.",
    ],
  ];
  const selectCover = async () => {
    const source = await promptImageSource({
      allowDelete: Boolean(coverAsset),
    });
    if (!source) return;
    if (source === "remove") {
      setCoverAsset(null);
      return;
    }
    const asset = await pickSingleImage({
      source,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (!asset) return;
    const isGif =
      asset.mimeType === "image/gif" ||
      asset.uri.toLowerCase().endsWith(".gif");
    if (isGif && (asset.fileSize ?? 0) > 10 * 1024 * 1024) {
      Alert.alert(
        "GIF 용량 초과",
        "방 대표 GIF는 10MB 이하만 사용할 수 있습니다.",
      );
      return;
    }
    setCoverAsset(asset);
  };
  const selectProfileAvatar = async () => {
    const source = await promptImageSource({
      allowDelete: Boolean(profileAvatar),
    });
    if (!source) return;
    if (source === "remove") {
      setProfileAvatar(null);
      return;
    }
    const asset = await pickSingleImage({
      source,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (asset) setProfileAvatar(asset);
  };
  const submit = async () => {
    setSubmitting(true);
    let createdRoomId: string | null = null;
    try {
      let avatarUploadId: string | undefined;
      if (isSupabaseConfigured && profileAvatar) {
        const resized = await ImageManipulator.manipulateAsync(
          profileAvatar.uri,
          [{ resize: { width: 720 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const bytes = await (await fetch(resized.uri)).arrayBuffer();
        const avatarUpload = await uploadValidatedImage({
          uri: resized.uri,
          mimeType: "image/jpeg",
          fileSize: bytes.byteLength,
          width: 720,
          height: 720,
          purpose: "profile-avatar",
        });
        avatarUploadId = avatarUpload.uploadId;
      }
      const input = {
        name: name.trim(),
        description: description.trim(),
        category: roomType,
        maxMembers,
        region: roomType === "region" ? region.trim() : undefined,
      };
      const id = isSupabaseConfigured
        ? await createRoom(input)
        : `demo-${Date.now()}`;
      createdRoomId = id;
      if (isSupabaseConfigured) {
        await setRoomOwnerProfile({
          roomId: id,
          displayName: profileName.trim(),
          introduction: profileIntro.trim(),
          avatarUploadId,
        });
        if (visibility === "private")
          await configureRoomAccess({ roomId: id, visibility, pin });
      }
      let finalCoverUri = coverAsset?.uri;
      if (isSupabaseConfigured && coverAsset) {
        const isGif =
          coverAsset.mimeType === "image/gif" ||
          coverAsset.uri.toLowerCase().endsWith(".gif");
        let uri = coverAsset.uri;
        const mimeType: "image/jpeg" | "image/gif" = isGif
          ? "image/gif"
          : "image/jpeg";
        let width = coverAsset.width ?? 1;
        let height = coverAsset.height ?? 1;
        if (!isGif) {
          const scale = Math.min(1, 720 / Math.max(1, width));
          const resized = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: Math.max(1, Math.round(width * scale)) } }],
            { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
          );
          uri = resized.uri;
          finalCoverUri = uri;
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }
        const bytes = await (await fetch(uri)).arrayBuffer();
        const upload = await uploadValidatedImage({
          uri,
          mimeType,
          fileSize: bytes.byteLength,
          width,
          height,
          purpose: "room-cover",
          roomId: id,
        });
        await setRoomCover(id, upload.uploadId);
      }
      const tags = [
        ...new Set([
          ...extractHashTags(input.description),
          visibility === "private"
            ? "비밀방"
            : roomType === "concept"
              ? "콘셉트"
              : roomType === "adult"
                ? "성인"
                : roomType === "region"
                  ? region.trim() || "지역별"
                  : "Member",
        ]),
      ];
      const created: Room = {
        id,
        name: input.name,
        description: input.description,
        tags,
        memberCount: 1,
        maxMembers,
        category:
          roomType === "concept"
            ? "concept"
            : roomType === "member"
              ? "member"
              : "general",
        topSpaceCount: 0,
        isAdult: roomType === "adult",
        isActive: true,
        emoji: "○",
        imageColor: "#E8ECEA",
        coverUri: finalCoverUri,
        region: roomType === "region" ? region.trim() : undefined,
      };
      onCreated(created);
    } catch (error) {
      if (isSupabaseConfigured && createdRoomId)
        await deleteRoom(createdRoomId).catch(() => undefined);
      Alert.alert("방 생성 실패", serverErrorMessage(error));
      setSubmitting(false);
    }
  };
  const invalidPin = visibility === "private" && pin.length !== 6;
  const disabled =
    !name.trim() ||
    !description.trim() ||
    !profileName.trim() ||
    !profileIntro.trim() ||
    submitting ||
    invalidPin;
  return (
    <SafeAreaView style={s.safe}>
      <EdgeBackLayer onBack={onBack} />
      <StatusBar style="light" />
      <TopBar title="방 생성하기" onBack={onBack} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={formScrollRef}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={s.form}
        >
          <Pressable
            accessibilityLabel="대표 이미지 선택"
            onPress={selectCover}
            style={s.uploadRound}
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={s.uploadRoundImage} />
            ) : (
              <Ionicons
                name="camera-outline"
                size={28}
                color={colors.mint700}
              />
            )}
          </Pressable>
          <LimitedField
            label="방 이름"
            value={name}
            onChange={(value) => setName(value.slice(0, 13))}
            placeholder="방제를 입력해주세요."
            limit={13}
          />
          <LimitedField
            label="방 설명"
            value={description}
            onChange={(value) => setDescription(value.slice(0, 120))}
            placeholder="방 설명을 입력해주세요."
            limit={120}
            multiline
          />
          <View style={s.ownerProfileBlock}>
            <Text style={s.ownerProfileTitle}>방에서 사용할 내 프로필</Text>
            <Pressable
              accessibilityLabel="방장 프로필 사진 선택"
              onPress={selectProfileAvatar}
              style={s.ownerProfileAvatar}
            >
              {profileAvatar ? (
                <Image
                  source={{ uri: profileAvatar.uri }}
                  style={s.joinAvatar}
                />
              ) : (
                <DefaultAvatar size={82} />
              )}
              <View style={s.editDot}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            </Pressable>
            <LimitedField
              label="이름"
              value={profileName}
              onChange={(value) => setProfileName(value.slice(0, 13))}
              placeholder="방에서 사용할 이름"
              limit={13}
            />
            <LimitedField
              label="자기 소개"
              value={profileIntro}
              onChange={(value) => setProfileIntro(value.slice(0, 60))}
              placeholder="자기 소개를 입력해주세요."
              limit={60}
              multiline
            />
          </View>
          <View style={s.field}>
            <Text style={s.fieldLabel}>공개 설정</Text>
            <View style={s.visibilityRows}>
              <Pressable
                onPress={() => {
                  setVisibility("public");
                  setPin("");
                }}
                style={[
                  s.visibilityCard,
                  visibility === "public" && s.visibilityCardActive,
                ]}
              >
                <Ionicons
                  name="earth-outline"
                  size={21}
                  color={colors.mint700}
                />
                <View>
                  <Text style={s.visibilityCardTitle}>공개방</Text>
                  <Text style={s.visibilityCardText}>홈과 검색에 표시</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setVisibility("private")}
                style={[
                  s.visibilityCard,
                  visibility === "private" && s.visibilityCardActive,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={21}
                  color={colors.mint700}
                />
                <View>
                  <Text style={s.visibilityCardTitle}>비밀방</Text>
                  <Text style={s.visibilityCardText}>PIN 6자리 필수</Text>
                </View>
              </Pressable>
            </View>
            {visibility === "private" && (
              <View style={s.pinFieldWrap}>
                <TextInput
                  value={pin}
                  onFocus={() =>
                    scrollCreateField(capacityFieldY.current, true)
                  }
                  onChangeText={(value) =>
                    setPin(value.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="number-pad"
                  secureTextEntry
                  placeholder="PIN 6자리"
                  placeholderTextColor={colors.textMuted}
                  style={s.input}
                />
                {invalidPin && (
                  <Text style={s.pinError}>
                    비밀방은 PIN 6자리를 반드시 설정해야 합니다.
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={s.field}>
            <Text style={s.fieldLabel}>분류</Text>
            <View style={s.radioList}>
              {types.map(([value, label, typeDisabled, disabledReason]) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    if (typeDisabled) {
                      Alert.alert("안내", disabledReason ?? "성인 인증 필요");
                      return;
                    }
                    setRoomType(value);
                  }}
                  style={[s.radioRow, typeDisabled && s.radioDisabled]}
                >
                  <View
                    style={[
                      s.radioCircle,
                      roomType === value && s.radioCircleActive,
                    ]}
                  >
                    {roomType === value && <View style={s.radioDot} />}
                  </View>
                  <Text
                    style={[s.radioText, typeDisabled && s.radioTextDisabled]}
                  >
                    {label}
                  </Text>
                  {typeDisabled && (
                    <Text style={s.radioReason}>
                      {disabledReason ?? "성인 인증 필요"}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
            {roomType === "region" && (
              <View
                onLayout={(event) => {
                  regionFieldY.current = event.nativeEvent.layout.y;
                }}
                style={s.regionFieldWrap}
              >
                <View style={s.fieldHead}>
                  <View style={s.inlineLabelRow}>
                    <Text style={s.fieldLabel}>지역</Text>
                    <Text style={s.inlineOptionalLabel}>(선택사항)</Text>
                  </View>
                  <Text style={s.fieldCounter}>{region.length}/20</Text>
                </View>
                <TextInput
                  value={region}
                  maxLength={20}
                  onChangeText={(value) => setRegion(value.slice(0, 20))}
                  placeholder="ex. 경기 남부, 서울"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    s.input,
                    Platform.OS === "web" &&
                      ({ outlineStyle: "none" } as object),
                  ]}
                />
              </View>
            )}
          </View>
          <View
            onLayout={(event) => {
              capacityFieldY.current = event.nativeEvent.layout.y;
            }}
            style={s.field}
          >
            <View style={s.capacityLine}>
              <Text style={s.fieldLabel}>최대 인원</Text>
              <Text style={s.capacityHintInline}>(최소 1명, 최대 80명)</Text>
            </View>
            <View style={s.stepper}>
              <Pressable
                allowRapidPress
                accessibilityLabel="인원 줄이기"
                onPress={() => setCapacity(maxMembers - 1)}
                style={s.stepperButton}
              >
                <Ionicons name="remove" size={20} color={colors.textSubtle} />
              </Pressable>
              <TextInput
                keyboardType="number-pad"
                value={`${maxMembers}`}
                onFocus={() => scrollCreateField(capacityFieldY.current, true)}
                onChangeText={(value) =>
                  setCapacity(Number(value.replace(/[^0-9]/g, "")))
                }
                style={[
                  s.stepperInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                ]}
              />
              <Text style={s.stepperUnit}>명</Text>
              <Pressable
                allowRapidPress
                accessibilityLabel="인원 늘리기"
                onPress={() => setCapacity(maxMembers + 1)}
                style={s.stepperButton}
              >
                <Ionicons name="add" size={20} color={colors.textSubtle} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <View style={[s.sticky, appTheme.id === "dark" && s.stickyDark]}>
          <Pressable
            disabled={disabled}
            onPress={submit}
            style={[s.primary, disabled && s.disabled]}
          >
            <LinearGradient
              colors={
                disabled ? disabledGradient : activeGradient
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {submitting ? "생성 중..." : "방 생성하기"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AdultVerificationScreen({
  verified,
  onBack,
  onRefresh,
}: {
  verified: boolean;
  onBack: () => void;
  onRefresh: () => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);
  const openPortal = async () => {
    setLoading(true);
    try {
      await Linking.openURL(getOperationsPolicyUrl());
    } catch (error) {
      Alert.alert("열기 실패", serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const refresh = async () => {
    setLoading(true);
    try {
      const done = await onRefresh();
      Alert.alert(
        "인증 상태",
        done
          ? "성인 인증이 완료되었습니다."
          : "아직 인증 완료 정보가 확인되지 않습니다.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <TopBar title="성인 인증" onBack={onBack} />
      <View style={s.verificationPage}>
        <View style={s.verificationIcon}>
          <Ionicons
            name={verified ? "shield-checkmark" : "shield-checkmark-outline"}
            size={34}
            color={colors.mint700}
          />
        </View>
        <Text style={s.verificationTitle}>
          {verified ? "성인 인증 완료" : "만 19세 이상 본인인증"}
        </Text>
        <Text style={s.verificationBody}>
          성인 탭은 웹 운영정책 페이지에서 로그인 후 성인 인증을 완료한 계정만
          이용할 수 있습니다. 주민등록번호는 앱과 서버에 저장하지 않고, 공급자
          결과만 서버에서 검증합니다.
        </Text>
        {!verified && (
          <Pressable
            disabled={loading}
            onPress={openPortal}
            style={[s.primary, loading && s.disabled]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading ? "여는 중..." : "운영정책 웹 열기"}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
        <Pressable
          disabled={loading}
          onPress={refresh}
          style={s.verificationRefresh}
        >
          <Text style={s.verificationRefreshText}>인증 상태 새로고침</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Settings({
  adultVerified,
  isSuperAdmin,
  onAdultVerification,
  onBack,
  onSignedOut,
}: {
  adultVerified: boolean;
  isSuperAdmin: boolean;
  onAdultVerification: () => void;
  onBack: () => void;
  onSignedOut: () => void;
}) {
  const [notifications, setNotificationsState] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [processingAccount, setProcessingAccount] = useState(false);
  const [lockSettingsOpen, setLockSettingsOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  useEffect(() => {
    getGlobalNotificationsEnabled()
      .then(setNotificationsState)
      .catch(() => undefined);
  }, []);
  const setNotifications = async (value: boolean) => {
    if (notificationSaving) return;
    const previous = notifications;
    setNotificationsState(value);
    setNotificationSaving(true);
    try {
      await setGlobalNotificationsEnabled(value);
    } catch (error) {
      setNotificationsState(previous);
      Alert.alert("알림 설정 실패", serverErrorMessage(error));
    } finally {
      setNotificationSaving(false);
    }
  };
  useEffect(() => {
    AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)
      .then((value) => setAppLockEnabled(value === "1"))
      .catch(() => undefined);
  }, [lockSettingsOpen]);
  const performLogout = async () => {
    if (processingAccount) return;
    setProcessingAccount(true);
    try {
      await signOut();
    } catch (error) {
      const message = serverErrorMessage(error);
      if (!/SecureStore|Invalid key/i.test(message)) {
        setProcessingAccount(false);
        Alert.alert("濡쒓렇?꾩썐 ?ㅽ뙣", message);
        return;
      }
    }
    try {
      await clearAppLockCredentials();
    } catch {
      // Local session has already been cleared; cleanup errors must not block logout.
    }
    try {
      onSignedOut();
    } catch (error) {
      const message = serverErrorMessage(error);
      if (/SecureStore|Invalid key|Keys must/i.test(message)) return;
      setProcessingAccount(false);
      Alert.alert("로그아웃 실패", serverErrorMessage(error));
    }
  };
  const logout = () =>
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", onPress: performLogout },
    ]);
  const performDelete = async () => {
    if (processingAccount) return;
    setProcessingAccount(true);
    try {
      await requestAccountDeletion();
      try {
        await signOut();
      } catch {}
      await clearAppLockCredentials();
      onSignedOut();
    } catch (error) {
      setProcessingAccount(false);
      Alert.alert("탈퇴 실패", serverErrorMessage(error));
    }
  };
  const deleteAccount = () => {
    if (isSuperAdmin) {
      Alert.alert("탈퇴 불가", "슈퍼관리자 계정은 탈퇴할 수 없습니다.");
      return;
    }
    Alert.alert(
      "계정 탈퇴",
      "정말 탈퇴하시겠습니까?\n탈퇴 후 3일 간 계정 생성이 불가합니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "탈퇴", style: "destructive", onPress: performDelete },
      ],
    );
  };
  const openUrl = (url: string) =>
    Linking.openURL(url).catch(() =>
      Alert.alert("열기 실패", "연결할 앱이나 브라우저를 확인해주세요."),
    );
  if (lockSettingsOpen)
    return (
      <AppLockSettings
        onBack={() => setLockSettingsOpen(false)}
        onChanged={setAppLockEnabled}
      />
    );
  if (passwordChangeOpen)
    return <PasswordChangeScreen onBack={() => setPasswordChangeOpen(false)} />;
  if (paymentHistoryOpen)
    return <PaymentHistoryScreen onBack={() => setPaymentHistoryOpen(false)} />;
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <TopBar title="설정" onBack={onBack} />
      <ScrollView contentContainerStyle={s.settings}>
        <Text style={s.groupLabel}>알림</Text>
        <View style={s.menuGroup}>
          <Menu
            icon="notifications-outline"
            title="전체 알림"
            trailing={
              <Switch
                style={s.smallSwitch}
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.gray200, true: colors.mint700 }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>
        <Text style={s.groupLabel}>보안</Text>
        <View style={s.menuGroup}>
          <Menu
            icon="lock-closed-outline"
            title="앱 잠금"
            value={appLockEnabled ? "사용 중" : "꺼짐"}
            onPress={() => setLockSettingsOpen(true)}
          />
        </View>
        <Text style={s.groupLabel}>계정 및 서비스</Text>
        <View style={s.menuGroup}>
          <Menu
            icon="call-outline"
            title="인증 전화번호"
            value="인증됨"
            onPress={() =>
              Alert.alert(
                "인증 전화번호",
                "보안을 위해 전화번호 전체는 표시하지 않습니다.",
              )
            }
          />
          <Menu
            icon="key-outline"
            title="비밀번호 변경"
            onPress={() => setPasswordChangeOpen(true)}
          />
          <Menu
            icon="card-outline"
            title="결제 내역"
            onPress={() => setPaymentHistoryOpen(true)}
          />
          <Menu
            icon="document-text-outline"
            title="개인정보 처리방침"
            onPress={() => openUrl(PRIVACY_POLICY_URL)}
          />
          <Menu
            icon="mail-outline"
            title="피드백 보내기"
            onPress={() =>
              openUrl(
                "mailto:muteappcontact@gmail.com?subject=Mute%20피드백",
              )
            }
          />
        </View>
        <View style={s.menuGroup}>
          <Menu
            icon="log-out-outline"
            title="로그아웃"
            danger
            onPress={logout}
          />
          <Menu
            icon="trash-outline"
            title="계정 탈퇴"
            value={isSuperAdmin ? "관리자 계정은 탈퇴 불가" : undefined}
            danger
            onPress={deleteAccount}
          />
        </View>
        <Text style={s.version}>Mute 0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PasswordChangeScreen({ onBack }: { onBack: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentError, setCurrentError] = useState("");
  const [saving, setSaving] = useState(false);
  const validNewPassword = newPassword.length >= 8;
  const passwordsMatch = !confirmPassword || newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    validNewPassword &&
    newPassword === confirmPassword &&
    !saving;
  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setCurrentError("");
    try {
      await changeCurrentUserPassword(currentPassword, newPassword);
      Alert.alert("변경 완료", "비밀번호가 변경되었습니다.", [
        { text: "확인", onPress: onBack },
      ]);
    } catch (error) {
      const message = serverErrorMessage(error);
      if (message.includes("현재 사용 중인 비밀번호")) setCurrentError(message);
      else Alert.alert("비밀번호 변경 실패", message);
    } finally {
      setSaving(false);
    }
  };
  const confirmSubmit = () =>
    Alert.alert(
      "비밀번호 변경",
      "비밀번호를 변경하시겠습니까?\n이 작업을 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "변경", onPress: submit },
      ],
    );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <TopBar title="비밀번호 변경" onBack={onBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.passwordChangePage}
        >
          <TextInput
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              if (currentError) setCurrentError("");
            }}
            secureTextEntry
            placeholder="현재 비밀번호"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />
          {currentError ? (
            <Text style={s.authPasswordMismatch}>{currentError}</Text>
          ) : null}
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="새 비밀번호"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />
          {newPassword.length > 0 && !validNewPassword ? (
            <Text style={s.authPasswordMismatch}>
              비밀번호는 8자 이상이어야 합니다.
            </Text>
          ) : null}
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="새 비밀번호 확인"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />
          {confirmPassword.length > 0 && !passwordsMatch ? (
            <Text style={s.authPasswordMismatch}>비밀번호가 일치하지 않습니다.</Text>
          ) : null}
          <Pressable
            disabled={!canSubmit}
            onPress={confirmSubmit}
            style={[s.primary, !canSubmit && s.disabled]}
          >
            <LinearGradient
              colors={canSubmit ? ["#82B9C1", "#5DBB8C"] : ["#C9D8D5", "#BFCAC7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={s.primaryText}>비밀번호 변경</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppLockSettings({
  onBack,
  onChanged,
}: {
  onBack: () => void;
  onChanged: (enabled: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [desiredEnabled, setDesiredEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState("");
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)
      .then((value) => {
        const next = value === "1";
        setEnabled(next);
        setDesiredEnabled(next);
        setUnlocked(true);
      })
      .catch(() => undefined);
  }, []);
  const verifyCurrent = async () => {
    const stored = await readAppLockPin();
    if (current !== stored) {
      setMessage("현재 PIN이 일치하지 않습니다.");
      return false;
    }
    setMessage("");
    setUnlocked(true);
    return true;
  };
  const save = async () => {
    if (enabled && !unlocked && !(await verifyCurrent())) return;
    if (pin.length !== 4 || pin !== confirm) {
      setMessage("4자리 PIN이 일치하지 않습니다.");
      return;
    }
    await writeAppLockPin(pin);
    await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, "1");
    setEnabled(true);
    setDesiredEnabled(true);
    setUnlocked(true);
    setCurrent("");
    setPin("");
    setConfirm("");
    setMessage("앱 잠금이 설정되었습니다.");
    onChanged(true);
    onBack();
  };
  const disable = async () => {
    if (!(await verifyCurrent())) return;
    await clearAppLockCredentials();
    setEnabled(false);
    setDesiredEnabled(false);
    setUnlocked(true);
    setCurrent("");
    setPin("");
    setConfirm("");
    setMessage("앱 잠금이 해제되었습니다.");
    onChanged(false);
  };
  const requestToggle = (value: boolean) => {
    setDesiredEnabled(value);
    setMessage("");
    setPin("");
    setConfirm("");
    if (!value && enabled) setUnlocked(false);
    if (value && !enabled) setUnlocked(true);
  };
  const needsCurrent = enabled && !desiredEnabled;
  const showNewPin = desiredEnabled && !enabled;
  if (recovering)
    return (
      <LockSettingsRecovery
        onBack={() => setRecovering(false)}
        onRecovered={async () => {
          await clearAppLockCredentials();
          setEnabled(false);
          setDesiredEnabled(false);
          setUnlocked(true);
          setRecovering(false);
          setMessage("앱 잠금이 해제되었습니다.");
          onChanged(false);
        }}
      />
    );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <TopBar title="앱 잠금" onBack={onBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.lockSettings}
        >
          <View style={s.lockToggleRow}>
            <View>
              <Text style={s.lockToggleTitle}>앱 잠금</Text>
              <Text style={s.lockToggleState}>
                {desiredEnabled ? "켜짐" : "꺼짐"}
              </Text>
            </View>
            <Switch
              style={s.smallSwitch}
              value={desiredEnabled}
              onValueChange={requestToggle}
              trackColor={{ false: colors.gray200, true: colors.mint700 }}
              thumbColor="#FFFFFF"
            />
          </View>
          {needsCurrent && (
            <>
              <PinField
                label="현재 PIN"
                value={current}
                onChange={setCurrent}
                placeholder="현재 4자리 PIN"
              />
              <Text style={s.lockDisableHint}>
                현재 비밀번호를 입력해야 앱 잠금을 풀 수 있습니다.
              </Text>
              <Pressable
                onPress={() => setRecovering(true)}
                style={s.lockForgotButton}
              >
                <Text style={s.lockForgotText}>비밀번호를 잊으셨습니까?</Text>
              </Pressable>
              <Pressable
                disabled={current.length !== 4}
                onPress={disable}
                style={[s.primary, current.length !== 4 && s.disabled]}
              >
                <LinearGradient
                  colors={["#82B9C1", "#5DBB8C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryGradient}
                >
                  <Text style={s.primaryText}>앱 잠금 해제하기</Text>
                </LinearGradient>
              </Pressable>
            </>
          )}
          {showNewPin && (
            <>
              <PinField
                label="새 PIN"
                value={pin}
                onChange={setPin}
                placeholder="숫자 4자리"
              />
              <PinField
                label="새 PIN 확인"
                value={confirm}
                onChange={setConfirm}
                placeholder="숫자 4자리 다시 입력"
              />
              <Pressable
                disabled={pin.length !== 4 || confirm.length !== 4}
                onPress={save}
                style={[
                  s.primary,
                  s.lockSubmitSpacer,
                  (pin.length !== 4 || confirm.length !== 4) && s.disabled,
                ]}
              >
                <LinearGradient
                  colors={["#82B9C1", "#5DBB8C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryGradient}
                >
                  <Text style={s.primaryText}>
                    {enabled ? "새 PIN 저장" : "앱 잠금 설정"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </>
          )}
          {message !== "" && (
            <Text
              style={message.includes("일치") ? s.lockError : s.lockSuccess}
            >
              {message}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LockSettingsRecovery({
  onBack,
  onRecovered,
}: {
  onBack: () => void;
  onRecovered: () => void | Promise<void>;
}) {
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = async () => {
    setLoading(true);
    setError("");
    try {
      setNormalized(await requestPasswordRecoveryOtp(phone));
      setSent(true);
    } catch (value) {
      setError(serverErrorMessage(value));
    } finally {
      setLoading(false);
    }
  };
  const verify = async () => {
    setLoading(true);
    setError("");
    try {
      await verifyPhoneOtp(normalized, otp);
      await onRecovered();
    } catch (value) {
      setError(serverErrorMessage(value));
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <TopBar title="앱 잠금 비밀번호 찾기" onBack={onBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.lockRecoveryPage}
        >
          <TextInput
            value={phone}
            editable={!sent}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="가입한 전화번호"
            placeholderTextColor={colors.textMuted}
            style={s.authInput}
          />
          {sent && (
            <TextInput
              autoFocus
              value={otp}
              onChangeText={(value) =>
                setOtp(value.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              placeholder="인증번호 6자리"
              placeholderTextColor={colors.textMuted}
              style={s.authInput}
            />
          )}
          <Pressable
            disabled={
              loading ||
              (sent ? otp.length !== 6 : !normalizeKoreanPhoneNumber(phone))
            }
            onPress={sent ? verify : request}
            style={[
              s.primary,
              (loading ||
                (sent
                  ? otp.length !== 6
                  : !normalizeKoreanPhoneNumber(phone))) &&
                s.disabled,
            ]}
          >
            <LinearGradient
              colors={["#82B9C1", "#5DBB8C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryGradient}
            >
              <Text style={s.primaryText}>
                {loading
                  ? "확인 중..."
                  : sent
                    ? "인증하고 잠금 해제"
                    : "인증번호 받기"}
              </Text>
            </LinearGradient>
          </Pressable>
          {error !== "" && <Text style={s.lockError}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BottomNav({
  selected,
  onSelect,
  docked = false,
}: {
  selected: BottomTab;
  onSelect: (v: BottomTab) => void;
  docked?: boolean;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const androidBottomInset = Platform.OS === "android" ? insets.bottom : 0;
  const items: [BottomTab, IconName, IconName, string][] = [
    ["myRooms", "chatbubbles-outline", "chatbubbles", "내 채팅"],
    ["discover", "home-outline", "home", "홈"],
    ["stories", "albums-outline", "albums", "스토리"],
    ["profile", "person-outline", "person", "내 정보"],
  ];
  return (
    <View
      style={[
        s.bottomNav,
        androidBottomInset
          ? {
              height: 112 + androidBottomInset,
              paddingBottom: 28 + androidBottomInset,
            }
          : null,
        docked && s.bottomNavDocked,
      ]}
    >
      {items.map(([key, icon, active, label]) => (
        <Pressable key={key} onPress={() => onSelect(key)} style={s.navItem}>
          <Ionicons
            name={selected === key ? active : icon}
            size={22}
            color={selected === key ? theme.accent : colors.textMuted}
          />
          <Text
            style={[
              s.navText,
              selected === key && s.navActive,
              selected === key && { color: theme.accent },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TopBar({
  title,
  subtitle,
  inlineCount,
  onBack,
  edgeBackEnabled = true,
  secondaryTrailing,
  onSecondaryTrailingPress,
  trailing,
  onTrailingPress,
}: {
  title: string;
  subtitle?: string;
  inlineCount?: number;
  onBack: () => void;
  edgeBackEnabled?: boolean;
  secondaryTrailing?: IconName;
  onSecondaryTrailingPress?: () => void;
  trailing?: IconName;
  onTrailingPress?: () => void;
}) {
  const theme = useAppTheme();
  const foreground = themeForeground(theme);
  return (
    <>
      {edgeBackEnabled && <EdgeBackLayer onBack={onBack} />}
      <LinearGradient
        colors={["#82B9C1", "#5DBB8C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.topBar, Platform.OS === "android" && s.androidHeaderInset58]}
      >
        <IconButton name="chevron-back" color={foreground} onPress={onBack} />
        <View style={s.topCenter}>
          <View style={s.topTitleLine}>
            <Text numberOfLines={1} style={[s.topTitle, { color: foreground }]}>
              {title}
            </Text>
            {inlineCount !== undefined && (
              <Text style={[s.topInlineCount, { color: foreground }]}>
                {inlineCount}명
              </Text>
            )}
          </View>
          {subtitle && <Text style={[s.topSub, { color: foreground }]}>{subtitle}</Text>}
        </View>
        <View style={s.topActions}>
          {secondaryTrailing && (
            <RNPressable
              hitSlop={16}
              accessibilityLabel={
                secondaryTrailing === "search" ? "채팅 검색" : secondaryTrailing
              }
              onPress={onSecondaryTrailingPress}
              style={s.topSide}
            >
              <Ionicons name={secondaryTrailing} size={21} color={foreground} />
            </RNPressable>
          )}
          <RNPressable
            hitSlop={16}
            accessibilityLabel={trailing}
            onPress={onTrailingPress}
            disabled={!onTrailingPress}
            style={s.topSide}
          >
            {trailing && <Ionicons name={trailing} size={22} color={foreground} />}
          </RNPressable>
        </View>
      </LinearGradient>
    </>
  );
}
function DefaultAvatar({
  size = 44,
  overlap = false,
}: {
  size?: number;
  overlap?: boolean;
}) {
  return (
    <Image
      accessibilityLabel="기본 프로필 이미지"
      source={require("./assets/default-profile.png")}
      style={[
        s.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: overlap ? -9 : 0,
        },
      ]}
    />
  );
}
function Avatar({
  uri,
  size = 44,
  overlap = false,
}: {
  uri?: string;
  size?: number;
  overlap?: boolean;
}) {
  if (!uri) return <DefaultAvatar size={size} overlap={overlap} />;
  return (
    <ExpoImage
      source={{ uri }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={100}
      style={[
        s.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: overlap ? -9 : 0,
        },
      ]}
    />
  );
}
function RoomImage({
  room,
  size,
  blurAdult = false,
}: {
  room?: Room;
  size: number;
  blurAdult?: boolean;
}) {
  return room?.coverUri ? (
    <View
      style={[
        s.roomImage,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        },
      ]}
    >
      <ExpoImage
        source={{ uri: room.coverUri }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={100}
        blurRadius={blurAdult ? 16 : 0}
        style={StyleSheet.absoluteFill}
      />
      {blurAdult && <View style={s.adultBlurMask} />}
    </View>
  ) : (
    <View
      style={[
        s.roomImage,
        { width: size, height: size, borderRadius: size / 2, overflow: "hidden" },
      ]}
    >
      <ExpoImage
        source={require("./assets/default-room.png")}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      {blurAdult && <View style={s.adultBlurMask} />}
    </View>
  );
}
function DefaultRoomCover({ room }: { room?: Room }) {
  return room?.coverUri ? (
    <ExpoImage
      source={{ uri: room.coverUri }}
      contentFit="cover"
      style={s.defaultCover}
    />
  ) : (
    <ExpoImage
      source={require("./assets/default-room-cover.png")}
      contentFit="cover"
      style={s.defaultCover}
    />
  );
}
function ImageGrid({
  uris,
  onReply,
  onPress,
  disabled = false,
}: {
  uris: string[];
  onReply?: () => void;
  onPress?: (uri: string, index: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[s.imageGrid, uris.length === 1 && s.imageGridSingle]}>
      {uris.map((uri, index) => (
        <Pressable
          key={`${uri}-${index}`}
          disabled={disabled}
          onPress={() => onPress?.(uri, index)}
          onLongPress={disabled ? undefined : onReply}
          style={[
            s.imageGridItem,
            uris.length === 1 && s.imageGridItemSingle,
            uris.length > 1 &&
              uris.length % 2 === 1 &&
              index === uris.length - 1 &&
              s.imageGridItemOddLast,
          ]}
        >
          <ExpoImage
            source={{ uri }}
            contentFit="cover"
            transition={120}
            style={s.imageGridImage}
          />
          {uri.toLowerCase().includes(".gif") && (
            <View style={s.gifBadge}>
              <Text style={s.gifBadgeText}>GIF</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}
function ChatImageEditor({
  assets,
  onBack,
  onSend,
}: {
  assets: ChatImageAsset[];
  onBack: () => void;
  onSend: (assets: ChatImageAsset[]) => void;
}) {
  const theme = useAppTheme();
  const [items, setItems] = useState<ChatImageAsset[]>(
    assets.map((asset) => ({
      ...asset,
      cropAspect: "original",
      cropOffset: { x: 1, y: 1 },
      cropPosition: { x: 0, y: 0 },
      cropScale: 1,
      cropFreeRatio: (asset.width || 4) / (asset.height || 3),
      cropRotation: 0,
    })),
  );
  const [selected, setSelected] = useState(0);
  const cropWindowStart = useRef({ widthFactor: 1, heightFactor: 1 });
  const cropBoxWidthFactor = useSharedValue(1);
  const cropBoxHeightFactor = useSharedValue(1);
  const cropStartWidthFactor = useSharedValue(1);
  const cropStartHeightFactor = useSharedValue(1);
  const cropTranslateX = useSharedValue(0);
  const cropTranslateY = useSharedValue(0);
  const cropStartTranslateX = useSharedValue(0);
  const cropStartTranslateY = useSharedValue(0);
  useEffect(() => {
    if (!items.length) onBack();
  }, [items.length, onBack]);
  const updateSelected = (patch: Partial<ChatImageAsset>) =>
    setItems((values) =>
      values.map((asset, index) =>
        index === selected ? { ...asset, ...patch } : asset,
      ),
    );
  const remove = (index: number) =>
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      if (!next.length) {
        requestAnimationFrame(onBack);
        return next;
      }
      setSelected((value) => Math.max(0, Math.min(value, next.length - 1)));
      return next;
    });
  const current = items[selected];
  const rotateSelected = (direction: -1 | 1) => {
    if (!current) return;
    updateSelected({
      cropRotation: (((current.cropRotation ?? 0) + direction * 90) % 360 + 360) % 360,
      cropOffset: { x: 0, y: 0 },
      cropPosition: { x: 0, y: 0 },
    });
  };
  const ratios: { label: string; value: ChatImageAsset["cropAspect"] }[] = [
    { label: "원본", value: "original" },
    { label: "자유롭게", value: "free" },
    { label: "1:1", value: [1, 1] },
    { label: "4:3", value: [4, 3] },
    { label: "3:4", value: [3, 4] },
    { label: "16:9", value: [16, 9] },
  ];
  const ratioKey = (value: ChatImageAsset["cropAspect"]) =>
    value === "original" || value === "free" || !value
      ? (value ?? "original")
      : `${value[0]}:${value[1]}`;
  const cropRatio = current
    ? current.cropAspect === "original" ||
      current.cropAspect === "free" ||
      !current.cropAspect
      ? current.cropAspect === "free"
        ? Math.max(0.45, Math.min(2.4, current.cropFreeRatio ?? (current.width || 4) / (current.height || 3)))
        : (current.width || 4) / (current.height || 3)
      : current.cropAspect[0] / current.cropAspect[1]
    : 4 / 3;
  const viewport = Dimensions.get("window");
  const maxPreviewWidth = viewport.width - 36;
  const previewWidth = maxPreviewWidth;
  const previewHeight = Math.max(260, Math.min(430, viewport.height - 430));
  const previewScale = current?.cropScale ?? 1;
  const previewRotation = current?.cropRotation ?? 0;
  const sourceWidth = Math.max(1, current?.width ?? 4);
  const sourceHeight = Math.max(1, current?.height ?? 3);
  const rotationSwapsAxes = Math.abs(previewRotation % 180) === 90;
  const rotatedSourceWidth = rotationSwapsAxes ? sourceHeight : sourceWidth;
  const rotatedSourceHeight = rotationSwapsAxes ? sourceWidth : sourceHeight;
  const containedScale = Math.min(
    previewWidth / rotatedSourceWidth,
    previewHeight / rotatedSourceHeight,
  );
  const displayedImageWidth = rotatedSourceWidth * containedScale;
  const displayedImageHeight = rotatedSourceHeight * containedScale;
  const renderedImageWidth = rotationSwapsAxes
    ? displayedImageHeight
    : displayedImageWidth;
  const renderedImageHeight = rotationSwapsAxes
    ? displayedImageWidth
    : displayedImageHeight;
  const cropWindowRatio = cropRatio;
  const cropMaxWidth =
    displayedImageWidth / displayedImageHeight > cropWindowRatio
      ? displayedImageHeight * cropWindowRatio
      : displayedImageWidth;
  const cropMaxHeight = cropMaxWidth / cropWindowRatio;
  const cropFreeWidthFactor = Math.max(
    0.22,
    Math.min(1, current?.cropOffset?.x ?? 1),
  );
  const cropFreeHeightFactor = Math.max(
    0.22,
    Math.min(1, current?.cropOffset?.y ?? 1),
  );
  const cropFocusWidth =
    current?.cropAspect === "free"
      ? cropMaxWidth * cropFreeWidthFactor
      : cropMaxWidth / previewScale;
  const cropFocusHeight =
    current?.cropAspect === "free"
      ? cropMaxHeight * cropFreeHeightFactor
      : cropMaxHeight / previewScale;
  useEffect(() => {
    cropBoxWidthFactor.value = Math.max(0.22, Math.min(1, cropFocusWidth / cropMaxWidth));
    cropBoxHeightFactor.value = Math.max(0.22, Math.min(1, cropFocusHeight / cropMaxHeight));
    const maxTranslateX = Math.max(0, (displayedImageWidth - cropFocusWidth) / 2);
    const maxTranslateY = Math.max(0, (displayedImageHeight - cropFocusHeight) / 2);
    cropTranslateX.value =
      Math.max(-1, Math.min(1, current?.cropPosition?.x ?? 0)) * maxTranslateX;
    cropTranslateY.value =
      Math.max(-1, Math.min(1, current?.cropPosition?.y ?? 0)) * maxTranslateY;
  }, [
    cropBoxHeightFactor,
    cropBoxWidthFactor,
    cropFocusHeight,
    cropFocusWidth,
    cropMaxHeight,
    cropMaxWidth,
    displayedImageHeight,
    displayedImageWidth,
    selected,
  ]);
  const commitCropFactors = (widthFactor: number, heightFactor: number) => {
    if (!current || !current.cropAspect || current.cropAspect === "original")
      return;
    if (current.cropAspect === "free") {
      updateSelected({
        cropOffset: { x: widthFactor, y: heightFactor },
        cropFreeRatio: widthFactor / heightFactor,
        cropScale: 1 / Math.min(widthFactor, heightFactor),
      });
      return;
    }
    const uniformFactor = Math.max(0.25, Math.min(widthFactor, heightFactor));
    updateSelected({ cropScale: 1 / uniformFactor });
  };
  const createCropHandleGesture = (
    horizontal: -1 | 1,
    vertical: -1 | 1,
  ) => Gesture.Pan()
    .onBegin(() => {
      cropStartWidthFactor.value = cropBoxWidthFactor.value;
      cropStartHeightFactor.value = cropBoxHeightFactor.value;
    })
    .onUpdate((event) => {
      const widthDelta = (event.translationX * horizontal) / cropMaxWidth;
      const heightDelta = (event.translationY * vertical) / cropMaxHeight;
      if (current?.cropAspect === "free") {
        cropBoxWidthFactor.value = Math.max(
          0.22,
          Math.min(1, cropStartWidthFactor.value + widthDelta),
        );
        cropBoxHeightFactor.value = Math.max(
          0.22,
          Math.min(1, cropStartHeightFactor.value + heightDelta),
        );
        return;
      }
      const uniformFactor = Math.max(
        0.25,
        Math.min(
          1,
          Math.min(
            cropStartWidthFactor.value + widthDelta,
            cropStartHeightFactor.value + heightDelta,
          ),
        ),
      );
      cropBoxWidthFactor.value = uniformFactor;
      cropBoxHeightFactor.value = uniformFactor;
    })
    .onEnd(() => {
      runOnJS(commitCropFactors)(
        cropBoxWidthFactor.value,
        cropBoxHeightFactor.value,
      );
    });
  const cropHandles = useMemo(
    () => ({
      topLeft: createCropHandleGesture(-1, -1),
      topRight: createCropHandleGesture(1, -1),
      bottomLeft: createCropHandleGesture(-1, 1),
      bottomRight: createCropHandleGesture(1, 1),
    }),
    [current?.cropAspect, cropMaxWidth, cropMaxHeight],
  );
  const commitCropPosition = (
    translateX: number,
    translateY: number,
    widthFactor: number,
    heightFactor: number,
  ) => {
    const width = cropMaxWidth * widthFactor;
    const height = cropMaxHeight * heightFactor;
    const maxX = Math.max(0, (displayedImageWidth - width) / 2);
    const maxY = Math.max(0, (displayedImageHeight - height) / 2);
    updateSelected({
      cropPosition: {
        x: maxX > 0 ? Math.max(-1, Math.min(1, translateX / maxX)) : 0,
        y: maxY > 0 ? Math.max(-1, Math.min(1, translateY / maxY)) : 0,
      },
    });
  };
  const cropMoveGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(3)
        .onBegin(() => {
          cropStartTranslateX.value = cropTranslateX.value;
          cropStartTranslateY.value = cropTranslateY.value;
        })
        .onUpdate((event) => {
          const width = cropMaxWidth * cropBoxWidthFactor.value;
          const height = cropMaxHeight * cropBoxHeightFactor.value;
          const maxX = Math.max(0, (displayedImageWidth - width) / 2);
          const maxY = Math.max(0, (displayedImageHeight - height) / 2);
          cropTranslateX.value = Math.max(
            -maxX,
            Math.min(maxX, cropStartTranslateX.value + event.translationX),
          );
          cropTranslateY.value = Math.max(
            -maxY,
            Math.min(maxY, cropStartTranslateY.value + event.translationY),
          );
        })
        .onEnd(() => {
          runOnJS(commitCropPosition)(
            cropTranslateX.value,
            cropTranslateY.value,
            cropBoxWidthFactor.value,
            cropBoxHeightFactor.value,
          );
        }),
    [cropMaxHeight, cropMaxWidth, displayedImageHeight, displayedImageWidth],
  );
  const cropFocusAnimatedStyle = useAnimatedStyle(() => {
    const width = cropMaxWidth * cropBoxWidthFactor.value;
    const height = cropMaxHeight * cropBoxHeightFactor.value;
    const maxX = Math.max(0, (displayedImageWidth - width) / 2);
    const maxY = Math.max(0, (displayedImageHeight - height) / 2);
    const translateX = Math.max(-maxX, Math.min(maxX, cropTranslateX.value));
    const translateY = Math.max(-maxY, Math.min(maxY, cropTranslateY.value));
    return {
      width,
      height,
      left: (previewWidth - width) / 2 + translateX,
      top: (previewHeight - height) / 2 + translateY,
    };
  });
  return (
    <SafeAreaView style={s.imageEditorScreen}>
      <StatusBar style="light" />
      <TopBar
        title="사진 편집"
        onBack={onBack}
        edgeBackEnabled={false}
      />
      <ScrollView
        style={s.imageEditorBody}
        contentContainerStyle={s.imageEditorBodyContent}
        showsVerticalScrollIndicator={false}
      >
        {current ? (
          <View
            style={[
              s.imageEditorPreviewWrap,
              { width: previewWidth, height: previewHeight },
            ]}
          >
            <ExpoImage
              source={{ uri: current.uri }}
              contentFit="contain"
              style={[
                s.imageEditorPreview,
                {
                  width: renderedImageWidth,
                  height: renderedImageHeight,
                  left: (previewWidth - renderedImageWidth) / 2,
                  top: (previewHeight - renderedImageHeight) / 2,
                  transform: [
                    { rotate: `${previewRotation}deg` },
                  ],
                },
              ]}
            />
            {current.cropAspect &&
              current.cropAspect !== "original" && (
                <Reanimated.View
                  pointerEvents="box-none"
                  style={[
                    s.imageCropFocus,
                    cropFocusAnimatedStyle,
                  ]}
                >
                  <GestureDetector gesture={cropMoveGesture}>
                    <Reanimated.View style={s.imageCropMoveSurface} />
                  </GestureDetector>
                  <View pointerEvents="none" style={s.imageCropGridLineVertical} />
                  <View pointerEvents="none" style={[s.imageCropGridLineVertical, { left: "66.66%" }]} />
                  <View pointerEvents="none" style={s.imageCropGridLineHorizontal} />
                  <View pointerEvents="none" style={[s.imageCropGridLineHorizontal, { top: "66.66%" }]} />
                  <GestureDetector gesture={cropHandles.topLeft}>
                    <Reanimated.View
                      style={[s.imageCropResizeHandle, { backgroundColor: theme.accent }, s.imageCropHandleTopLeft]}
                    />
                  </GestureDetector>
                  <GestureDetector gesture={cropHandles.topRight}>
                    <Reanimated.View
                      style={[s.imageCropResizeHandle, { backgroundColor: theme.accent }, s.imageCropHandleTopRight]}
                    />
                  </GestureDetector>
                  <GestureDetector gesture={cropHandles.bottomLeft}>
                    <Reanimated.View
                      style={[s.imageCropResizeHandle, { backgroundColor: theme.accent }, s.imageCropHandleBottomLeft]}
                    />
                  </GestureDetector>
                  <GestureDetector gesture={cropHandles.bottomRight}>
                    <Reanimated.View
                      style={[s.imageCropResizeHandle, { backgroundColor: theme.accent }, s.imageCropHandleBottomRight]}
                    />
                  </GestureDetector>
                </Reanimated.View>
              )}
          </View>
        ) : (
          <View />
        )}
      </ScrollView>
      <View style={s.imageEditorFooter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.imageEditorThumbs}
        >
          {items.map((asset, index) => (
            <Pressable
              key={`${asset.uri}-${index}`}
              onPress={() => setSelected(index)}
              style={[
                s.imageEditorThumbWrap,
                index === selected && s.imageEditorThumbActive,
              ]}
            >
              <ExpoImage
                source={{ uri: asset.uri }}
                contentFit="cover"
                style={s.imageEditorThumb}
              />
              <Text style={s.imageEditorOrder}>{index + 1}</Text>
              <RNPressable
                hitSlop={12}
                onPress={() => remove(index)}
                style={s.imageEditorThumbRemove}
              >
                <Ionicons name="close" size={13} color="#FFF" />
              </RNPressable>
            </Pressable>
          ))}
        </ScrollView>
        {current && (
          <View style={s.imageRatioRow}>
            {ratios.map((ratio) => (
              <Pressable
                key={ratio.label}
                onPress={() =>
                  updateSelected({
                    cropAspect: ratio.value,
                    cropOffset: { x: 1, y: 1 },
                    cropPosition: { x: 0, y: 0 },
                    cropScale: 1,
                    cropFreeRatio:
                      ratio.value === "free"
                        ? current.cropFreeRatio ?? (current.width || 4) / (current.height || 3)
                        : current.cropFreeRatio,
                  })
                }
                style={[
                  s.imageRatioOption,
                  ratioKey(current.cropAspect) === ratioKey(ratio.value) &&
                    s.imageRatioOptionActive,
                ]}
              >
                <Text
                  style={[
                    s.imageRatioText,
                    ratioKey(current.cropAspect) === ratioKey(ratio.value) &&
                      s.imageRatioTextActive,
                  ]}
                >
                  {ratio.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.imageEditorToolbar}>
          <RNPressable onPress={onBack} style={s.imageEditorToolSide}>
            <Text style={s.imageEditorCancel}>취소</Text>
          </RNPressable>
          <RNPressable onPress={() => rotateSelected(-1)} style={s.imageEditorToolButton}>
            <Ionicons name="return-up-back" size={25} color="rgba(255,255,255,.9)" />
          </RNPressable>
          <RNPressable
            onPress={() =>
              updateSelected({
                cropAspect: current?.cropAspect === "original" ? [1, 1] : "original",
                cropOffset: { x: 1, y: 1 },
                cropPosition: { x: 0, y: 0 },
                cropScale: 1,
              })
            }
            style={s.imageEditorToolButton}
          >
            <Ionicons name="crop" size={26} color="#FFF" />
          </RNPressable>
          <RNPressable onPress={() => rotateSelected(1)} style={s.imageEditorToolButton}>
            <Ionicons name="return-up-forward" size={25} color="rgba(255,255,255,.9)" />
          </RNPressable>
          <RNPressable
            disabled={!items.length}
            onPress={() => onSend(items)}
            style={s.imageEditorToolSide}
          >
            <Text style={[s.imageEditorDone, !items.length && s.disabledSoft]}>완료</Text>
          </RNPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
function ChatDeliveryMeta({
  item,
  showTime,
  onRetry,
  onDelete,
}: {
  item: Extract<ChatMessage, { kind: "text" | "image" | "secret" }>;
  showTime: boolean;
  onRetry: () => void;
  onDelete: () => void;
}) {
  if (item.delivery === "sending")
    return (
      <View style={s.deliveryMeta}>
        <ActivityIndicator size="small" color={colors.mint700} />
        {item.kind === "image" && item.uploadProgressLabel ? (
          <Text style={s.deliveryProgress}>
            {item.uploadProgressLabel}
          </Text>
        ) : null}
      </View>
    );
  if (item.delivery === "failed")
    return (
      <View style={s.deliveryFailed}>
        <Pressable onPress={onRetry}>
          <Text style={s.deliveryRetry}>재전송</Text>
        </Pressable>
        <Text style={s.deliveryDivider}>/</Text>
        <Pressable onPress={onDelete}>
          <Text style={s.deliveryDelete}>삭제</Text>
        </Pressable>
      </View>
    );
  return showTime ? (
    <Text numberOfLines={1} style={[s.time, s.tightTime]}>
      {item.time}
    </Text>
  ) : null;
}
function MuteLogo({
  variant = "color",
  compact = false,
}: {
  symbolOnly?: boolean;
  variant?: "white" | "color";
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const darkLogoOnWhite = variant === "white" && theme.id === "white";
  return (
    <View
      accessibilityLabel="뮤트"
      style={[s.muteLogo, compact && s.muteLogoCompact]}
    >
      <Image
        source={
          variant === "white"
            ? require("./assets/mute-logo-white.png")
            : require("./assets/mute-logo-color.png")
        }
        resizeMode="contain"
        style={[
          s.muteLogoSymbol,
          compact && s.muteLogoSymbolCompact,
          darkLogoOnWhite && { tintColor: "#222222" },
        ]}
      />
    </View>
  );
}
function SectionLabel({
  title,
  action,
  onAction,
  compact = false,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={s.sectionLabel}>
      <Text style={[s.sectionTitle, compact && s.sectionTitleCompact]}>
        {title}
      </Text>
      {action && (
        <Pressable onPress={onAction} style={s.sectionActionButton}>
          <Text style={s.sectionAction}>{action}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.mint700} />
        </Pressable>
      )}
    </View>
  );
}
function NotificationBadge({
  inline = false,
  count = 3,
  dot = false,
}: {
  inline?: boolean;
  count?: number;
  dot?: boolean;
}) {
  const label = count > 99 ? "99+" : `${count}`;
  return (
    <View
      style={[
        s.notificationBadge,
        inline && s.notificationBadgeInline,
        dot && s.notificationBadgeDot,
      ]}
    >
      {!dot && <RNText style={s.notificationBadgeText}>{label}</RNText>}
    </View>
  );
}
function ComposerPanel({
  tool,
  onCamera,
  onGallery,
  onTopSpace,
  onPromotion,
  onNewStory,
  onComingSoon,
  showPromotion,
  bubbleColor,
  textColor,
  backgroundColor,
  bubbleProductId,
  textProductId,
  backgroundProductId,
  onBubbleColor,
  onTextColor,
  onBackgroundColor,
  onCustomColor,
  entitlements,
  onEntitlementsChange,
  promotionRemainingMs,
}: {
  tool: ComposerTool;
  onCamera: () => void;
  onGallery: () => void;
  onTopSpace: () => void;
  onPromotion: () => void;
  onNewStory: () => void;
  onComingSoon: (label: string) => void;
  showPromotion: boolean;
  secretDraft: string;
  onSecretDraft: (value: string) => void;
  onSendSecret: () => void;
  bubbleColor: string;
  textColor: string;
  backgroundColor: string;
  bubbleProductId?: string;
  textProductId?: string;
  backgroundProductId?: string;
  onBubbleColor: (value: string,productId?:string) => void;
  onTextColor: (value: string,productId?:string) => void;
  onBackgroundColor: (value: string,productId?:string) => void;
  onCustomColor: (target: "bubble" | "text" | "background") => void;
  entitlements:ChatEntitlement[];
  onEntitlementsChange:(items:ChatEntitlement[])=>void;
  promotionRemainingMs:number;
}) {
  if (!tool || tool === "secret") return null;
  const appTheme = useAppTheme();
  const darkChatItemsEnabled = appTheme.id === "dark";
  const customBackgroundItems = customPaletteProducts(entitlements, "background");
  const customBubbleItems = customPaletteProducts(entitlements, "bubble");
  const customTextItems = customPaletteProducts(entitlements, "text");
  const canAddCustomBackground = customBackgroundItems.length < 10;
  const canAddCustomBubble = customBubbleItems.length < 10;
  const canAddCustomText = customTextItems.length < 10;
  const backgroundColors = [
    "#FFFFFF",
    "#F2F7F4",
    "#EDF3F7",
    "#F8F1F4",
    "#EEEAE3",
    ...(darkChatItemsEnabled
      ? ["#222222", "#2B2B2B", "#30343A", "#302A30"]
      : []),
  ];
  const backgroundPalette = withCustomPaletteColor(
    backgroundColors.map((color) => ({
      color,
      name: "배경",
      price: 0,
    })),
    customBackgroundItems,
  );
  const bubblePalette = withCustomPaletteColor(
    darkChatItemsEnabled
      ? [
          ...BUBBLE_COLOR_PRODUCTS,
          { color: "#303030", name: "다크 말풍선", price: 0 },
        ]
      : BUBBLE_COLOR_PRODUCTS,
    customBubbleItems,
  );
  const textPalette = withCustomPaletteColor(
    darkChatItemsEnabled
      ? [
          ...TEXT_COLOR_PRODUCTS,
          { color: "#F2F2F2", name: "다크 텍스트", price: 0 },
        ]
      : TEXT_COLOR_PRODUCTS,
    customTextItems,
  );
  return (
    <View style={[s.composerPanel, { height: tool === "media" ? 360 : 260 }]}>
      {tool === "media" ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.toolMenu}
        >
          <View style={s.toolGrid}>
            <ToolAction
              icon="camera-outline"
              label="카메라"
              onPress={onCamera}
            />
            <ToolAction
              icon="images-outline"
              label="갤러리"
              onPress={onGallery}
            />
        </View>
          <View style={[s.toolDivider, appTheme.id === "dark" && s.toolDividerDark]} />
          <View style={s.toolGrid}>
            {showPromotion && (
              <ToolAction icon="megaphone-outline" label="프로모션" countdownMs={promotionRemainingMs} onPress={onPromotion}/>
            )}
            <ToolAction
              icon="rocket-outline"
              label="탑스페이스"
              onPress={onTopSpace}
            />
          </View>
          <View style={[s.toolDivider, appTheme.id === "dark" && s.toolDividerDark]} />
          <View style={s.toolGrid}>
            <ToolAction
              icon="create-outline"
              label="새 스토리"
              onPress={onNewStory}
            />
          </View>
          <View style={[s.toolDivider, appTheme.id === "dark" && s.toolDividerDark]} />
          <View style={s.toolGrid}>
            <ToolAction
              icon="podium-outline"
              label="랭킹"
              onPress={() => onComingSoon("랭킹")}
            />
            <ToolAction
              icon="shuffle-outline"
              label="제비뽑기"
              onPress={() => onComingSoon("제비뽑기")}
            />
            <ToolAction
              icon="people-circle-outline"
              label="마피아 게임"
              onPress={() => onComingSoon("마피아 게임")}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.styleTools}>
          <ColorPicker
            label="채팅 배경"
            values={backgroundPalette}
            selected={backgroundColor}
            selectedProductId={backgroundProductId}
            defaultColor="#FFFFFF"
            onSelect={onBackgroundColor}
            entitlements={entitlements}
            onEntitlementsChange={onEntitlementsChange}
            onCustomColor={canAddCustomBackground ? () => onCustomColor("background") : undefined}
          />
          <ColorPicker
            label="말풍선 색상"
            values={bubblePalette}
            selected={bubbleColor}
            selectedProductId={bubbleProductId}
            defaultColor={appTheme.id === "dark" ? "#303030" : "#F5F5F5"}
            onSelect={onBubbleColor}
            onCustomColor={canAddCustomBubble ? () => onCustomColor("bubble") : undefined}
            entitlements={entitlements}
            onEntitlementsChange={onEntitlementsChange}
          />
          <ColorPicker
            label="텍스트 색상"
            values={textPalette}
            selected={textColor}
            selectedProductId={textProductId}
            defaultColor={appTheme.id === "dark" ? "#F2F2F2" : "#1C1C1C"}
            onSelect={onTextColor}
            onCustomColor={canAddCustomText ? () => onCustomColor("text") : undefined}
            entitlements={entitlements}
            onEntitlementsChange={onEntitlementsChange}
          />
        </ScrollView>
      )}
    </View>
  );
}
function SystemMessage({
  event,
  text,
}: {
  event: "join" | "heart" | "point" | "leave" | "room" | "kick";
  text: string;
}) {
  const appTheme = useAppTheme();
  const darkNotice = appTheme.id === "dark";
  const icon =
    event === "heart"
      ? "heart"
      : event === "point"
        ? "cash-outline"
        : event === "join"
          ? "person-add"
          : event === "room"
            ? "information-circle-outline"
            : event === "kick"
              ? "ban-outline"
              : "exit-outline";
  return (
    <View style={s.systemRow}>
      <View style={[s.systemLine, darkNotice && s.systemLineDark]} />
      <View style={s.systemContent}>
        {event === "point" ? (
          <RNIonicons name={icon} size={15} color={FIXED_POINT_COLOR} />
        ) : (
          <Ionicons
            name={icon}
            size={15}
            color={event === "heart" ? colors.pink600 : colors.textMuted}
          />
        )}
        <LinkedText style={[s.systemText, darkNotice && s.systemTextDark]}>{text}</LinkedText>
      </View>
      <View style={[s.systemLine, darkNotice && s.systemLineDark]} />
    </View>
  );
}
function MemberActionSheet({
  member,
  avatarUri,
  selfOnly = false,
  readOnly = false,
  canModerate=false,
  isMuted=false,
  secretOpen,
  onClose,
  onHeart,
  onPoint = () => undefined,
  onSecret,
  onProfile,
  onReport,
  secretDraft,
  onSecretDraft,
  onSendSecret,
  onMute,
  onUnmute,
}: {
  member: string | null;
  avatarUri?: string;
  selfOnly?: boolean;
  readOnly?: boolean;
  canModerate?:boolean;
  isMuted?:boolean;
  secretOpen: boolean;
  onClose: () => void;
  onHeart: () => void;
  onPoint?: () => void;
  onSecret: () => void;
  onProfile: () => void;
  onReport: () => void;
  secretDraft: string;
  onSecretDraft: (value: string) => void;
  onSendSecret: () => void;
  onMute:()=>void;
  onUnmute:()=>void;
}) {
  if (!member) return null;
  const actions: [IconName, string, () => void, boolean][] = selfOnly
    ? []
    : readOnly
      ? [["warning-outline", "신고하기", onReport, true]]
      : [
          ["heart", "하트 보내기", onHeart, true],
          ["cash-outline", "포인트 보내기", onPoint, false],
          ["mail-outline", "비밀 쪽지", onSecret, false],
          ...(canModerate?[["volume-mute-outline" as IconName,isMuted?"채팅 금지 해제":"채팅 금지",isMuted?onUnmute:onMute,false] as [IconName,string,()=>void,boolean]]:[]),
          ["warning-outline", "신고하기", onReport, true],
        ];
  return (
    <View style={s.sheetLayer}>
      <Pressable
        accessibilityLabel="멤버 메뉴 닫기"
        onPress={onClose}
        style={s.sheetDim}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={s.sheetKeyboard}
      >
        <View style={s.memberSheet}>
          <View style={s.sheetHandle} />
          <Pressable
            onPress={onProfile}
            style={[s.sheetProfile, selfOnly && s.sheetProfileSelf]}
          >
            <Avatar uri={avatarUri} size={58} />
            <Text style={s.sheetName}>{member}</Text>
          </Pressable>
          {selfOnly && !secretOpen ? (
            <Pressable onPress={onProfile} style={s.selfProfileEditAction}>
              <View style={s.memberActionIcon}>
                <Ionicons
                  name="create-outline"
                  size={23}
                  color={colors.mint700}
                />
              </View>
              <Text style={s.memberActionText}>프로필 편집</Text>
            </Pressable>
          ) : null}
          {secretOpen ? (
            <View style={s.secretComposer}>
              <Text style={s.secretTitle}>
                <Ionicons name="lock-closed" size={13} /> {member}님에게 비밀
                쪽지
              </Text>
              <TextInput
                autoFocus
                value={secretDraft}
                onChangeText={onSecretDraft}
                placeholder="쪽지 내용을 입력해주세요."
                placeholderTextColor={colors.textMuted}
                multiline
                style={[
                  s.secretInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                ]}
              />
              <Pressable
                disabled={!secretDraft.trim()}
                onPress={onSendSecret}
                style={[s.secretSend, !secretDraft.trim() && s.disabled]}
              >
                <LinearGradient
                  colors={
                    secretDraft.trim()
                      ? ["#82B9C1", "#5DBB8C"]
                      : ["#C9D8D5", "#BFCAC7"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.fullGradient}
                >
                  <Text style={s.primaryText}>비밀 쪽지 보내기</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <View style={s.memberActions}>
              {actions.map(([icon, label, onPress, pink]) => (
                <Pressable key={label} onPress={onPress} style={s.memberAction}>
                  {icon === "cash-outline" || icon === "mail-outline" ? (
                    <RNView
                      style={[
                        s.memberActionIcon,
                        { backgroundColor: FIXED_POINT_SOFT },
                      ]}
                    >
                      <RNIonicons
                        name={icon}
                        size={23}
                        color={FIXED_POINT_COLOR}
                      />
                    </RNView>
                  ) : (
                    <View style={[s.memberActionIcon, pink && s.heartAction]}>
                      <Ionicons
                        name={icon}
                        size={23}
                        color={pink ? colors.pink600 : colors.mint700}
                      />
                    </View>
                  )}
                  <Text style={s.memberActionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
function ToolAction({
  icon,
  label,
  onPress,
  countdownMs=0,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  countdownMs?:number;
}) {
  const seconds=Math.max(0,Math.ceil(countdownMs/1000));
  const countdown=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  return (
    <Pressable onPress={onPress} style={s.toolAction}>
      <View style={s.toolIcon}>
        {seconds>0?<Text style={s.toolCountdown}>{countdown}</Text>:<Ionicons name={icon} size={23} color={colors.mint700} />}
      </View>
      <Text style={s.toolLabel}>{label}</Text>
    </Pressable>
  );
}
function ColorPicker({
  label,
  values,
  selected,
  selectedProductId,
  defaultColor,
  onSelect,
  onCustomColor,
  entitlements,
  onEntitlementsChange,
}: {
  label: string;
  values: ColorProduct[];
  selected: string;
  selectedProductId?: string;
  defaultColor: string;
  onSelect: (value: string, productId?: string) => void;
  onCustomColor?: () => void;
  entitlements: ChatEntitlement[];
  onEntitlementsChange: (items: ChatEntitlement[]) => void;
}) {
  const customEnabled = Boolean(onCustomColor);
  const deleteCustom = (item: ColorProduct) => {
    const productId = item.productId;
    if (!productId || !isCustomChatProductId(productId)) return;
    Alert.alert(
      item.name,
      `${item.name} 색상을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await expireMyChatEntitlement(productId);
              const refreshed = await listActiveChatEntitlements();
              onEntitlementsChange(refreshed);
              if (selectedProductId === productId) {
                onSelect(defaultColor, undefined);
              }
            } catch (error) {
              Alert.alert("삭제 실패", serverErrorMessage(error));
            }
          },
        },
      ],
    );
  };
  const choose = (item: ColorProduct) => {
    if (item.price === 0) {
      onSelect(item.color, undefined);
      return;
    }
    const productId = item.productId;
    if (!productId) {
      Alert.alert("구매 실패", "상품 ID가 연결되지 않았습니다.");
      return;
    }
    const active = entitlements.find(
      (entitlement) => entitlement.productId === productId,
    );
    if (active) {
      Alert.alert(
        item.name,
        `${formatEntitlementRemaining(active.expiresAt)} 남았습니다.`,
        [
          { text: "취소", style: "cancel" },
          { text: "적용", onPress: () => onSelect(item.color, productId) },
        ],
      );
      return;
    }
    Alert.alert(
      item.name,
      `${item.price.toLocaleString()}포인트로 구매하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "구매하기",
          onPress: async () => {
            try {
              await purchaseProduct(productId);
              const refreshed = await listActiveChatEntitlements();
              onEntitlementsChange(refreshed);
              onSelect(item.color, productId);
              Alert.alert("구매 완료", "7일 동안 모든 채팅방에서 사용할 수 있습니다.");
            } catch (error) {
              Alert.alert("구매 실패", serverErrorMessage(error));
            }
          },
        },
      ],
    );
  };
  return (
    <View style={s.colorLine}>
      <View style={s.colorLabelLine}>
        <Text style={s.colorLabel}>{label}</Text>
      </View>
      <View style={s.colorOptions}>
        {values.map((item) => {
          const isSelected = item.productId
            ? selectedProductId === item.productId
            : !selectedProductId &&
              selected.toUpperCase() === item.color.toUpperCase();
          return (
            <Pressable
              accessibilityLabel={`${item.name} ${item.price}포인트`}
              key={`${label}-${item.productId ?? item.color}`}
              onPress={() => choose(item)}
              onLongPress={() => deleteCustom(item)}
              style={[
                s.colorDot,
                { backgroundColor: item.color },
                isSelected && s.colorDotActive,
              ]}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={item.color === "#FFFFFF" ? "#1C1C1C" : "#FFF"}
                />
              )}
            </Pressable>
          );
        })}
        {customEnabled && (
          <Pressable
            accessibilityLabel={`${label} 커스텀 색상`}
            onPress={onCustomColor}
            style={[s.colorDot, s.customColorDot]}
          >
            <Ionicons name="add" size={15} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function CustomColorScreen({
  target,
  productId,
  initialColor,
  onBack,
  onComplete,
  entitlements,
  onEntitlementsChange,
}: {
  target: "bubble" | "text" | "background";
  productId: string;
  initialColor: string;
  onBack: () => void;
  onComplete: (color: string,productId:string) => void;
  entitlements:ChatEntitlement[];
  onEntitlementsChange: (items: ChatEntitlement[]) => void;
}) {
  const [selection, setSelection] = useState(initialColor);
  const [purchasing, setPurchasing] = useState(false);
  const complete = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const active=entitlements.some((item)=>item.productId===productId);
      if (!active) await purchaseProduct(productId);
      await setCustomChatEntitlementValue(productId, selection);
      const refreshed = await listActiveChatEntitlements();
      onEntitlementsChange(refreshed);
      onComplete(selection,productId);
      Alert.alert(active?"적용 완료":"구매 완료", active?"선택한 색상이 적용되었습니다.":"7일 동안 모든 채팅방에서 사용할 수 있습니다.");
    } catch (error) {
      Alert.alert("구매 실패", serverErrorMessage(error));
    } finally {
      setPurchasing(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <TopBar title="커스텀 색상 선택" onBack={onBack} />
      <ScrollView contentContainerStyle={s.customColorPage}>
        <ExternalColorPicker
          value={selection}
          thumbShape="ring"
          onChangeJS={(value) => setSelection(value.hex)}
          onCompleteJS={(value) => setSelection(value.hex)}
          style={s.customPickerRoot}
        >
          <View style={s.customPickerTopRow}>
            <Panel3 style={s.customPickerWheelLarge} />
            <View
              style={[
                s.customPickerPreviewBarLarge,
                { backgroundColor: selection },
              ]}
            />
          </View>
          <BrightnessSlider style={s.customPickerSlider} />
          <InputWidget
            defaultFormat="RGB"
            formats={["RGB", "HEX"]}
            disableAlphaChannel
            containerStyle={s.customInputWidget}
            inputStyle={s.customInput}
            inputTitleStyle={s.customInputTitle}
            iconColor={colors.textSubtle}
          />
        </ExternalColorPicker>
        <View style={[s.customColorPreview,target==="background"&&{backgroundColor:selection}]}>
          <Text
            style={[
              s.customColorPreviewText,
              target === "text" && { color: selection },
            ]}
          >
            미리보기
          </Text>
          {target==="background"?<><View style={[s.customColorPreviewBubble,{alignSelf:"flex-start"}]}><Text style={s.messageText}>상대방의 메시지 미리보기</Text></View><View style={[s.customColorPreviewBubble,{alignSelf:"flex-end"}]}><Text style={s.messageText}>내 메시지 미리보기</Text></View></>:<View
            style={[
              s.customColorPreviewBubble,
              target === "bubble" && { backgroundColor: selection },
            ]}
          >
            <Text
              style={[s.messageText, target === "text" && { color: selection }]}
            >
              선택한 색상이 이렇게 보여요.
            </Text>
          </View>}
        </View>
        <Pressable
          disabled={purchasing}
          onPress={complete}
          style={[s.primary, purchasing && s.disabled]}
        >
          <LinearGradient
            colors={["#82B9C1", "#5DBB8C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.primaryGradient}
          >
            <Text style={s.primaryText}>
              {purchasing ? "구매 중..." : "3,200P 구매하고 적용"}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
function TopSpaceSheet({
  open,
  room,
  points,
  result,
  loading,
  onClose,
  onBoost,
}: {
  open: boolean;
  room: Room;
  points: number;
  expiresAt?: number;
  remaining: string;
  result: "success" | "shortage" | null;
  loading?: boolean;
  onClose: () => void;
  onBoost: (option: TopSpacePackage) => Promise<void>;
}) {
  const [selected, setSelected] = useState(TOP_SPACE_PACKAGES[0]);
  if (!open) return null;
  return (
    <View style={s.sheetLayer}>
      <Pressable
        accessibilityLabel="탑스페이스 닫기"
        onPress={loading ? undefined : onClose}
        style={s.sheetDim}
      />
      <View style={s.topSpaceSheet}>
        <View style={s.sheetHandle} />
        <View style={[s.topSpaceTitleLine, s.topSpaceTitleLineRelaxed]}>
          <View style={s.topSpaceIcon}>
            <Ionicons name="rocket" size={25} color={colors.mint700} />
          </View>
        </View>
        <View style={[s.packageGrid, s.topSpacePackageRelaxed]}>
          {TOP_SPACE_PACKAGES.map((option) => (
            <Pressable
              accessibilityLabel={`${option.boosts.toLocaleString()}회, ${option.points} 포인트`}
              key={option.points}
              disabled={loading}
              onPress={() => setSelected(option)}
              style={[
                s.packageOption,
                selected.points === option.points && s.packageOptionActive,
              ]}
            >
              <Text
                style={[
                  s.packagePoints,
                  selected.points === option.points && s.packageTextActive,
                ]}
              >
                {option.boosts.toLocaleString()}회
              </Text>
            </Pressable>
          ))}
        </View>
        {result && (
          <Text
            style={[s.topSpaceResult, result === "shortage" && s.topSpaceError]}
          >
            {result === "success"
              ? "탑스페이스에 올렸습니다."
              : "포인트가 부족합니다."}
          </Text>
        )}
        <Pressable
          disabled={loading || points < selected.points}
          onPress={() =>
            Alert.alert(
              "탑스페이스",
              `${selected.points.toLocaleString()}P를 사용하여 탑스페이스를 올리겠습니까?`,
              [
                { text: "취소", style: "cancel" },
                { text: "올리기", onPress: () => onBoost(selected) },
              ],
            )
          }
          style={[
            s.topSpaceButton,
            s.topSpaceButtonRelaxed,
            (loading || points < selected.points) && s.disabled,
          ]}
        >
          <LinearGradient
            colors={
              !loading && points >= selected.points
                ? ["#82B9C1", "#5DBB8C"]
                : ["#C9D8D5", "#BFCAC7"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.topSpaceButtonGradient}
          >
            <Text style={s.primaryText}>
              {selected.points.toLocaleString()}P로 1회 올리기
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
function ChatDrawer({
  open,
  roomId,
  profile,
  isOwner,
  isStaff,
  isSuperAdmin,
  readOnly,
  onClose,
  onProfileEdit,
  onApplications,
  onStories,
  onOpenMembers,
  onBlocked,
  onEditRoom,
  onRoomSettings,
  onDelete,
  onLeave,
}: {
  open: boolean;
  roomId: string;
  profile?: RoomMember;
  isOwner: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  readOnly: boolean;
  onClose: () => void;
  onProfileEdit: () => void;
  onApplications: () => void;
  onStories: () => void;
  onOpenMembers: () => void;
  onBlocked: () => void;
  onEditRoom: () => void;
  onRoomSettings: () => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  const slide = useRef(new Animated.Value(340)).current;
  const [visible, setVisible] = useState(open);
  const visibleRef = useRef(open);
  const openedAtRef = useRef(0);
  const [notifications, setNotifications] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const requestClose = () => {
    if (Date.now() - openedAtRef.current < 180) return;
    Keyboard.dismiss();
    onClose();
  };
  useEffect(() => {
    if (open && isUuid(roomId))
      getRoomNotificationsEnabled(roomId)
        .then(setNotifications)
        .catch(() => undefined);
  }, [open, roomId]);
  const toggleNotifications = async (value: boolean) => {
    if (notificationSaving) return;
    const previous = notifications;
    setNotifications(value);
    setNotificationSaving(true);
    try {
      if (isUuid(roomId)) await setRoomNotificationsEnabled(roomId, value);
    } catch (error) {
      setNotifications(previous);
      Alert.alert("알림 설정 실패", serverErrorMessage(error));
    } finally {
      setNotificationSaving(false);
    }
  };
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      visibleRef.current = true;
      setVisible(true);
      slide.setValue(340);
      Animated.timing(slide, {
        toValue: 0,
        duration: 230,
        useNativeDriver: true,
      }).start();
    } else if (visibleRef.current) {
      Animated.timing(slide, {
        toValue: 340,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        visibleRef.current = false;
        setVisible(false);
      });
    }
  }, [open, slide]);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) =>
          slide.setValue(Math.max(0, gesture.dx)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 55) {
            requestClose();
            return;
          }
          Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [slide],
  );
  const dimOpacity = slide.interpolate({
    inputRange: [0, 340],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  if (!visible) return null;
  return (
    <View style={s.drawerLayer}>
      <Pressable
        accessibilityLabel="채팅 메뉴 닫기"
        onPress={requestClose}
        style={s.drawerDimHit}
      >
        <Animated.View
          pointerEvents="none"
          style={[s.drawerDim, { opacity: dimOpacity }]}
        />
      </Pressable>
      <Animated.View
        {...swipe.panHandlers}
        style={themedStyle(
          [
            s.chatDrawer,
            s.drawerNarrow,
            { transform: [{ translateX: slide }] },
          ],
          "view",
        )}
      >
        <ScrollView
          contentContainerStyle={[s.chatDrawerMenu, s.drawerMenuUnified]}
          showsVerticalScrollIndicator={false}
        >
          {!readOnly && (
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                onProfileEdit();
              }}
              style={[s.drawerProfile, s.drawerProfileUnified]}
            >
              <View style={s.drawerAvatar}>
                <Avatar uri={profile?.avatarUri} size={72} />
                <View style={s.editDot}>
                  <Ionicons name="pencil" size={12} color="#FFF" />
                </View>
              </View>
              <Text style={s.drawerProfileName}>
                {profile?.name ?? "프로필 불러오는 중"}
              </Text>
              <Text numberOfLines={2} style={s.drawerProfileIntro}>
                {profile?.intro ?? ""}
              </Text>
            </Pressable>
          )}
          <DrawerMenu
            icon="notifications-outline"
            title="알림 설정"
            trailing={
              <Switch
                disabled={notificationSaving}
                style={s.smallSwitch}
                value={notifications}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.gray200, true: colors.mint700 }}
                thumbColor="#FFFFFF"
              />
            }
          />
          {(isStaff || isSuperAdmin) && (
            <DrawerMenu
              icon="person-add-outline"
              title="가입 신청 목록"
              onPress={onApplications}
            />
          )}
          <DrawerMenu
            icon="people-outline"
            title="멤버 관리"
            onPress={onOpenMembers}
          />
          <DrawerMenu
            icon="albums-outline"
            title="방 소개 및 스토리 보기"
            onPress={onStories}
          />
          {(isStaff || isSuperAdmin) && (
            <DrawerMenu
              icon="create-outline"
              title="방 편집하기"
              onPress={onEditRoom}
            />
          )}
          {(isOwner || isSuperAdmin) && (
            <DrawerMenu
              icon="lock-closed-outline"
              title="방 공개 설정"
              onPress={onRoomSettings}
            />
          )}
          {(isStaff || isSuperAdmin) && (
            <DrawerMenu
              icon="ban-outline"
              title="차단 멤버 목록"
              onPress={onBlocked}
            />
          )}
          <Pressable
            onPress={isOwner || isSuperAdmin ? onDelete : onLeave}
            style={s.deleteRoomLink}
          >
            <Text style={s.deleteRoomText}>
              {isOwner || isSuperAdmin ? "방 삭제하기" : "방 나가기"}
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
function DrawerMenu({
  icon,
  title,
  onPress,
  trailing,
}: {
  icon: IconName;
  title: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !trailing}
      style={({ pressed }) => [s.drawerMenu, pressed && s.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.textSubtle} />
      <Text style={s.drawerMenuText}>{title}</Text>
      <View style={s.menuTrailing}>
        {trailing ?? (
          <Ionicons name="chevron-forward" size={17} color={colors.gray300} />
        )}
      </View>
    </Pressable>
  );
}
function mapServerNotice(row: ServerNotice): Notice {
  const type = String(row.data?.type ?? row.eventType);
  const roomId =
    typeof row.data?.roomId === "string" ? row.data.roomId : undefined;
  const storyId =
    typeof row.data?.storyId === "string" ? row.data.storyId : undefined;
  return {
    id: row.id,
    icon:
      type === "join_request"
        ? "person-add-outline"
        : type === "join_approved"
          ? "checkmark-circle-outline"
          : type === "join_rejected"
            ? "close-circle-outline"
        : type === "story" || type === "story_comment"
          ? "reader-outline"
          : type === "secret_message"
            ? "mail-outline"
            : "chatbubble-outline",
    title: row.title,
    body: row.body,
    time: formatStoryTime(row.createdAt),
    read: Boolean(row.readAt),
    roomId,
    storyId,
    destination:
      type === "join_request"
        ? "applications"
        : type === "story" || type === "story_comment"
          ? "stories"
        : type === "join_rejected"
          ? "detail"
          : "chat",
  };
}

function NotificationDrawer({
  open,
  onClose,
  onUnreadChange,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onUnreadChange: (value: boolean) => void;
  onNavigate: (notice: Notice) => void;
}) {
  const slide = useRef(new Animated.Value(340)).current;
  const [visible, setVisible] = useState(open);
  const openedAtRef = useRef(0);
  const [confirmAll, setConfirmAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const requestClose = () => {
    if (Date.now() - openedAtRef.current < 180) return;
    onClose();
  };
  useEffect(
    () => onUnreadChange(notices.some((notice) => !notice.read)),
    [notices, onUnreadChange],
  );
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    listNotificationInbox()
      .then((rows) => {
        if (active) setNotices(rows.map(mapServerNotice));
      })
      .catch(() => {
        if (active) setNotices([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      setVisible(true);
      slide.setValue(340);
      Animated.timing(slide, {
        toValue: 0,
        duration: 230,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      Animated.timing(slide, {
        toValue: 340,
        duration: 190,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [open, slide, visible]);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) =>
          slide.setValue(Math.max(0, gesture.dx)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 55) {
            requestClose();
            return;
          }
          Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [slide],
  );
  const dimOpacity = slide.interpolate({
    inputRange: [0, 340],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  if (!visible) return null;
  const markNoticeRead = (notice: Notice) => {
    markNotificationRead(notice.id).catch(() => undefined);
    setNotices((items) =>
      items.map((item) =>
        item.id === notice.id ? { ...item, read: true } : item,
      ),
    );
  };
  const openNotice = (notice: Notice) => {
    markNoticeRead(notice);
    onClose();
    onNavigate(notice);
  };
  const markAllRead = () => {
    markAllNotificationsRead().catch(() => undefined);
    setNotices((items) => items.map((item) => ({ ...item, read: true })));
    setConfirmAll(false);
  };
  return (
    <View style={s.drawerLayer}>
      <Pressable
        accessibilityLabel="알림 닫기"
        onPress={requestClose}
        style={s.drawerDimHit}
      >
        <Animated.View
          pointerEvents="none"
          style={[s.drawerDim, { opacity: dimOpacity }]}
        />
      </Pressable>
      <Animated.View
        {...swipe.panHandlers}
        style={themedStyle(
          [
            s.chatDrawer,
            s.drawerNarrow,
            s.notificationDrawer,
            { transform: [{ translateX: slide }] },
          ],
          "view",
        )}
      >
        <View style={s.drawerHead}>
          <Text style={s.drawerTitle}>알림</Text>
          <Pressable
            hitSlop={12}
            accessibilityLabel="알림 닫기"
            onPress={requestClose}
            style={s.iconButton}
          >
            <Ionicons name="close" size={24} color={colors.textSubtle} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={s.notificationDrawerContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            disabled={!notices.length}
            onPress={() => setConfirmAll(true)}
          >
            <Text style={s.readAll}>모두 읽음</Text>
          </Pressable>
          {loading ? (
            <View style={s.centerState}>
              <ActivityIndicator color={colors.mint700} />
              <Text style={s.centerStateText}>알림을 불러오고 있어요.</Text>
            </View>
          ) : notices.length ? (
            notices.map((notice) => (
              <Pressable
                key={notice.id}
                onPress={() => openNotice(notice)}
                style={[s.drawerNotice, notice.read && s.drawerNoticeRead]}
              >
                <View style={[s.notifIcon, notice.read && s.notifIconRead]}>
                  <Ionicons
                    name={notice.icon}
                    size={20}
                    color={notice.read ? colors.gray300 : colors.mint700}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={[s.notifTitle, notice.read && s.notifTitleRead]}>
                    {notice.title}
                  </Text>
                  <Text style={s.notifBody}>{notice.body}</Text>
                  <Text style={s.notifTime}>{notice.time}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Empty
              title="알림이 없어요"
              body="새 메시지와 가입 신청 알림이 이곳에 표시됩니다."
            />
          )}
        </ScrollView>
        {confirmAll && (
          <View style={s.confirmLayer}>
            <View style={s.confirmCard}>
              <Text style={s.confirmTitle}>모두 읽음 처리하시겠습니까?</Text>
              <View style={s.confirmActions}>
                <Pressable
                  onPress={() => setConfirmAll(false)}
                  style={s.confirmCancel}
                >
                  <Text style={s.confirmCancelText}>아니요</Text>
                </Pressable>
                <Pressable onPress={markAllRead} style={s.confirmAccept}>
                  <LinearGradient
                    colors={["#82B9C1", "#5DBB8C"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.confirmAcceptGradient}
                  >
                    <Text style={s.primaryText}>예</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
function IconButton({
  name,
  color,
  onPress,
  size = 23,
}: {
  name: IconName;
  color: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={name === "search" ? "검색" : name}
      onPress={onPress}
      style={size < 23 ? s.headerIconButton : s.iconButton}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}
function IconCircle({
  name,
  onPress,
  active = false,
}: {
  name: IconName;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      hitSlop={10}
      accessibilityLabel={name}
      onPress={onPress}
      style={[s.iconCircle, active && s.iconCircleActive]}
    >
      <Ionicons
        name={name}
        size={22}
        color={active ? colors.mint700 : colors.textSubtle}
      />
    </Pressable>
  );
}
function Badge({ text, pink }: { text: string; pink?: boolean }) {
  return <RNText style={[s.badge, pink && s.badgePink]}>{text}</RNText>;
}
function Count({ value }: { value: number }) {
  return <Text style={s.count}>{value}</Text>;
}
function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{title}</Text>
        {action && <Text style={s.cardAction}>{action}</Text>}
      </View>
      {children}
    </View>
  );
}
function Menu({
  icon,
  title,
  value,
  trailing,
  danger,
  onPress,
}: {
  icon: IconName;
  title: string;
  value?: string;
  trailing?: React.ReactNode;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !trailing}
      style={s.menu}
    >
      <Ionicons
        name={icon}
        size={19}
        color={danger ? colors.pink600 : colors.textSubtle}
      />
      <Text style={[s.menuTitle, danger && s.danger]}>{title}</Text>
      <View style={s.menuTrailing}>
        {value ? (
          <Text numberOfLines={1} style={s.menuValue}>
            {value}
          </Text>
        ) : (
          (trailing ?? (
            <Ionicons name="chevron-forward" size={17} color={colors.gray300} />
          ))
        )}
      </View>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[s.input, multiline && s.textarea]}
      />
    </View>
  );
}
function PinField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={[s.field, s.pinField]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={s.input}
      />
    </View>
  );
}
function LimitedField({
  inputRef,
  label,
  value,
  onChange,
  placeholder,
  limit,
  multiline,
}: {
  inputRef?: React.Ref<React.ElementRef<typeof RNTextInput>>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  limit: number;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldHead}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={s.fieldCounter}>
          {value.length}/{limit}
        </Text>
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        maxLength={limit}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          s.input,
          multiline && s.textarea,
          Platform.OS === "web" && ({ outlineStyle: "none" } as object),
        ]}
      />
    </View>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name="chatbubbles-outline" size={42} color={colors.gray300} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  notificationDrawer: { paddingTop: 82 },
  notificationDrawerContent: { flexGrow: 1, paddingBottom: 36 },
  ownerProfileBlock: {
    marginTop: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.gray050,
  },
  ownerProfileTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSubtle,
  },
  ownerProfileAvatar: {
    position: "relative",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 2,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 30,
  },
  centerStateText: { color: colors.textMuted, fontSize: 11 },
  rewardSection: { gap: 12, marginTop: 18 },
  rewardButton: {
    height: 72,
    borderRadius: 24,
    overflow: "hidden",
    ...shadows.soft,
  },
  rewardButtonDisabled: { opacity: 0.72 },
  rewardGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  rewardTitle: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  rewardPoints: { color: "rgba(255,255,255,.86)", fontSize: 11, marginTop: 5 },
  storePage: { padding: 18, gap: 11 },
  storeCard: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  storeTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  storeBody: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  storePrice: { color: colors.mint700, fontSize: 11, fontWeight: "800" },
  verificationPage: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  verificationIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  verificationTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
  },
  verificationBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 26,
  },
  verificationRefresh: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 10,
  },
  verificationRefreshText: {
    color: colors.mint700,
    fontSize: 12,
    fontWeight: "700",
  },
  readOnlyBanner: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.mint050,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  readOnlyText: { color: colors.mint700, fontSize: 10, fontWeight: "700" },
  storyInlineBack: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  storyInlineBackText: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
  },
  commentDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray050,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  lockScreen: {
    flex: 1,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  lockCard: { width: "100%", maxWidth: 360, alignItems: "center" },
  lockRecovery: {
    width: "100%",
    padding: 24,
    justifyContent: "center",
    gap: 14,
  },
  lockIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  lockDots: { flexDirection: "row", gap: 13, marginTop: 20, marginBottom: 10 },
  lockDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.gray200,
  },
  lockDotFilled: { backgroundColor: colors.mint700 },
  numberPad: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
  },
  numberKey: {
    width: "33.333%",
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  numberKeyText: { color: colors.text, fontSize: 27, fontWeight: "400" },
  lockToggleRow: {
    minHeight: 68,
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  pinField: { marginBottom: 12 },
  lockToggleTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  lockToggleState: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  lockTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 18,
  },
  lockBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  lockInput: {
    width: 150,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.gray050,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    color: colors.text,
  },
  lockError: {
    color: colors.pink600,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 14,
  },
  lockSuccess: {
    color: colors.mint700,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 14,
  },
  lockSettings: { padding: 20, paddingBottom: 40 },
  lockSubmitSpacer: { marginTop: 10 },
  lockInfoCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "flex-start",
    marginBottom: 18,
    ...shadows.tiny,
  },
  lockInfoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },
  lockInfoBody: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  lockSettingHint: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 12,
  },
  muteLogoCompact: { height: 20 },
  muteLogoSymbolCompact: { width: 21, height: 15 },
  mainHeaderLogoWrap: {
    paddingLeft: 18,
    marginRight: 12,
    justifyContent: "center",
  },
  joinAvatar: { width: 82, height: 82, borderRadius: 41 },
  memberRoleAction: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberRoleActionText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  pinnedLabel: {
    color: colors.mint700,
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 5,
  },
  topActions: { flexDirection: "row", alignItems: "center" },
  chatSearchBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chatSearchInput: {
    flex: 1,
    height: 38,
    color: colors.text,
    fontSize: 13,
    textAlign: "left",
    letterSpacing: 0,
  },
  chatSearchButtonWrap: {
    height: 32,
    width: 42,
    borderRadius: 16,
    overflow: "hidden",
  },
  chatSearchButton: {
    height: 32,
    width: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint700,
  },
  chatSearchButtonWhite: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatSearchButtonDisabled: { opacity: 0.55 },
  chatSearchButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  chatSearchCount: { color: colors.mint700, fontSize: 11, fontWeight: "700" },
  chatSearchNav: {
    width: 30,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  searchMessageActive: {
    backgroundColor: "rgba(93,187,140,.12)",
    borderRadius: 14,
  },
  searchBubbleActive: {
    backgroundColor: "rgba(93,187,140,.18)",
    borderColor: "rgba(93,187,140,.45)",
    borderWidth: 1,
  },
  privateRoomLock: { marginRight: 1 },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.mint600,
    paddingLeft: 8,
    marginBottom: 7,
    maxWidth: 210,
  },
  replyQuoteName: { color: colors.mint700, fontSize: 10, fontWeight: "800" },
  replyQuoteText: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  replyComposer: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  replyComposerName: { color: colors.mint700, fontSize: 11, fontWeight: "800" },
  replyComposerText: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  sheetKeyboard: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  pointSendSheet: {
    marginHorizontal: 18,
    marginBottom: 24 + IOS_BOTTOM_SAFE_PADDING,
    borderRadius: 24,
    backgroundColor: "#FFF",
    padding: 18,
    ...shadows.floating,
  },
  pointSendTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  pointSendBody: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  pointSendInput: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.gray050,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
  },
  profileSecretInput: {
    height: 112,
    paddingTop: 14,
    textAlignVertical: "top",
    fontWeight: "500",
  },
  pointSendActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  pointSendCancel: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray050,
  },
  pointSendCancelText: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "800",
  },
  pointSendButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    overflow: "hidden",
  },
  pointSendGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  expandMessage: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
  },
  imageGrid: {
    width: CHAT_IMAGE_GRID_WIDTH,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  imageGridSingle: { width: CHAT_IMAGE_GRID_WIDTH },
  imageGridItem: {
    width: CHAT_IMAGE_GRID_CELL,
    height: CHAT_IMAGE_GRID_CELL,
    overflow: "hidden",
    backgroundColor: colors.gray100,
  },
  imageGridItemSingle: {
    width: CHAT_IMAGE_GRID_WIDTH,
    height: CHAT_IMAGE_GRID_WIDTH,
  },
  imageGridItemOddLast: {
    width: CHAT_IMAGE_GRID_WIDTH,
    height: Math.floor(CHAT_IMAGE_GRID_WIDTH / 2),
  },
  imageGridImage: { width: "100%", height: "100%", resizeMode: "cover" },
  gifBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,.58)",
  },
  gifBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  storyVisibility: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 8,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  storyVisibilityLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    marginRight: "auto",
  },
  visibilityOption: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gray050,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visibilityOptionActive: {
    backgroundColor: colors.mint050,
    borderColor: colors.mint300,
  },
  visibilityText: { color: colors.textSubtle, fontSize: 10, fontWeight: "700" },
  publicStoryList: { paddingBottom: 100, backgroundColor: "#FFF" },
  publicStoryListDark: { backgroundColor: "#222222" },
  publicStoryLoadingMore: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  publicStoryHeader: {
    minHeight: 74,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  publicStoryHeaderText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  storySortRow: { flexDirection: "row", gap: 16, marginTop: 11 },
  storySortText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  storySortTextActive: { color: colors.mint700, fontWeight: "800" },
  publicStoryCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  publicStoryPressed: { backgroundColor: colors.gray050 },
  publicStoryMain: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  publicStoryCopy: { flex: 1, minWidth: 0 },
  publicStoryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  publicStoryAuthor: { flexDirection: "row", alignItems: "center", gap: 9 },
  publicStoryAuthorName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  publicStoryMeta: { color: colors.mint700, fontSize: 9 },
  publicStoryMetaGreen: { color: colors.mint700 },
  publicStoryMetaDark: { color: "#A0A0A0" },
  publicStoryBody: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  publicStoryStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
  },
  publicStoryStat: { color: colors.textMuted, fontSize: 9 },
  publicStoryThumbnail: {
    width: 82,
    height: 82,
    borderRadius: 13,
    backgroundColor: colors.gray100,
  },
  publicStoryComment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gray050,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 13,
  },
  publicStoryCommentName: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  publicStoryCommentBody: { flex: 1, color: colors.textMuted, fontSize: 10 },
  topPlaceholder: {
    borderRadius: 18,
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  topPlaceholderText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  departedMember: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF",
    marginBottom: 8,
  },
  blockButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockButtonActive: {
    backgroundColor: colors.mint050,
    borderColor: colors.mint300,
  },
  blockButtonText: { color: colors.pink600, fontSize: 10, fontWeight: "700" },
  blockButtonTextActive: { color: colors.mint700 },
  memberDiscipline: { flexDirection: "row", gap: 8, marginTop: 12 },
  kickButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
  },
  kickButtonText: { color: colors.textSubtle, fontSize: 12, fontWeight: "700" },
  banButton: {
    flex: 1.6,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pink050,
  },
  banButtonText: { color: colors.pink600, fontSize: 12, fontWeight: "800" },
  visibilityRows: { flexDirection: "row", gap: 10 },
  accessSettings: { padding: 20, gap: 18 },
  accessTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  accessBody: { color: colors.textSubtle, fontSize: 12, lineHeight: 19 },
  visibilityCard: {
    flex: 1,
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  visibilityCardActive: {
    borderColor: colors.mint600,
    backgroundColor: colors.mint050,
  },
  visibilityCardTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  visibilityCardText: { color: colors.textMuted, fontSize: 9, marginTop: 3 },
  pinError: { color: colors.pink600, fontSize: 10, marginTop: 6 },
  authScreen: {
    flex: 1,
    backgroundColor: "#FFF",
    justifyContent: "flex-start",
  },
  authSplash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  authSplashText: {
    color: "rgba(255,255,255,.86)",
    fontSize: 13,
    fontWeight: "600",
  },
  authHeader: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    backgroundColor: "#FFF",
  },
  authHeaderBack: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  authHeaderTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  authCard: {
    marginHorizontal: 24,
    paddingHorizontal: 0,
    paddingVertical: 24,
    backgroundColor: "#FFF",
    gap: 14,
  },
  authLoginCard: { paddingTop: 62 },
  authTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  authBody: { color: colors.textSubtle, fontSize: 13, lineHeight: 20 },
  authInput: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.gray050,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 17,
    letterSpacing: 0,
    textAlign: "left",
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingTop: 12,
    paddingBottom: 160,
  },
  authPhoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  authPhoneInput: { flex: 1, minWidth: 0 },
  authInputVerified: {
    color: colors.textMuted,
    backgroundColor: colors.gray100,
  },
  authVerifyButton: {
    height: 52,
    minWidth: 82,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.mint050,
    borderWidth: 1,
    borderColor: colors.mint600,
    alignItems: "center",
    justifyContent: "center",
  },
  authVerifyButtonDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  authVerifyText: { color: colors.mint700, fontSize: 12, fontWeight: "800" },
  authVerifyTextDisabled: { color: colors.textMuted },
  authSignupReveal: { overflow: "hidden", gap: 12 },
  authPinHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  authPinLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: "700" },
  authPinLine: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authPinInput: { flex: 1, minWidth: 0, letterSpacing: 5 },
  authPinButton: {
    height: 52,
    minWidth: 62,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.mint050,
    borderWidth: 1,
    borderColor: colors.mint600,
    alignItems: "center",
    justifyContent: "center",
  },
  authVerifying: { flexDirection: "row", alignItems: "center", gap: 6 },
  authOtpError: {
    color: colors.pink600,
    fontSize: 10,
    fontWeight: "700",
    marginTop: -6,
    marginLeft: 4,
  },
  authTimer: { color: colors.mint700, fontSize: 12, fontWeight: "800" },
  authTimerExpired: { color: colors.pink600 },
  authPasswordHint: { color: colors.mint700, fontSize: 10, marginTop: -5 },
  authPasswordMismatch: { color: colors.pink600 },
  signupConsentGroup: {
    gap: 10,
    marginTop: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.gray050,
  },
  signupConsentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 28,
  },
  signupConsentBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  signupConsentBoxChecked: {
    borderColor: colors.mint700,
    backgroundColor: colors.mint700,
  },
  signupConsentText: { flex: 1, color: colors.text, fontSize: 12 },
  signupConsentNote: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    paddingLeft: 29,
    marginTop: -4,
  },
  signupPolicyLink: { paddingLeft: 29, marginTop: -7 },
  signupPolicyLinkText: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    textDecorationLine: "underline",
  },
  authInlineNotice: {
    color: colors.mint700,
    fontSize: 10,
    fontWeight: "700",
    marginTop: -8,
    marginLeft: 4,
  },
  authBack: { height: 40, alignItems: "center", justifyContent: "center" },
  authBackText: { color: colors.mint700, fontSize: 12, fontWeight: "700" },
  safe: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  flex: { flex: 1, minWidth: 0 },
  androidHeaderInset56: {
    marginTop: ANDROID_STATUS_BAR_HEIGHT,
  },
  androidHeaderInset58: {
    marginTop: ANDROID_STATUS_BAR_HEIGHT,
  },
  mainHeader: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,.25)",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  searchArea: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FFF",
  },
  muteLogo: { height: 44, flexDirection: "row", alignItems: "center", gap: 9 },
  muteLogoSymbol: { width: 38, height: 28 },
  splashLogoWrap: { transform: [{ scale: 0.42 }] },
  muteLogoMark: { width: 50, height: 36 },
  muteName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 17,
    letterSpacing: -0.3,
  },
  muteEnglish: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  muteNameWhite: { color: "#FFF" },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 9,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
    textAlign: "left",
    letterSpacing: 0,
  },
  persistentHomeIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  persistentHomeBar: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
  },
  tabs: {
    height: 48,
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: colors.mint700, fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.mint600,
  },
  list: { paddingBottom: 100 },
  sectionLabel: {
    height: 44,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "500" },
  sectionTitleCompact: { fontSize: 11, fontWeight: "600", letterSpacing: 0.05 },
  sectionActionButton: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  sectionAction: { color: colors.mint700, fontSize: 11, fontWeight: "500" },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  listTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  listSub: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  count: {
    color: colors.mint700,
    backgroundColor: colors.mint050,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    lineHeight: 28,
    fontSize: 11,
    fontWeight: "700",
  },
  roomRow: {
    height: 92,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.gray050 },
  roomImage: {
    backgroundColor: "#F0F1F1",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  roomInfo: { flex: 1, paddingHorizontal: 13, paddingVertical: 11 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  roomName: {
    maxWidth: "65%",
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  roomDesc: { color: colors.textSubtle, fontSize: 12, marginTop: 4 },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 7,
  },
  metaGroup: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { color: colors.textMuted, fontSize: 10 },
  topSpaceRemaining: { color: colors.mint700, fontWeight: "700" },
  topSpaceGaugeTrack: {
    width: 72,
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.gray100,
  },
  topSpaceGaugeFill: { height: "100%", borderRadius: 4 },
  joined: { color: colors.mint700, fontSize: 10, fontWeight: "700" },
  hash: { color: colors.textMuted, fontSize: 10 },
  badge: {
    color: colors.mint700,
    backgroundColor: colors.mint050,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: "hidden",
    fontSize: 9,
    fontWeight: "700",
  },
  badgePink: { color: colors.pink600, backgroundColor: colors.pink050 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 176,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint600,
    ...shadows.floating,
  },
  fabNoAd: {
    bottom: 126,
  },
  mainBannerDock: {
    width: "100%",
    height: 50,
    minHeight: 50,
    backgroundColor: "#FFF",
  },
  mainBannerDockDark: {
    backgroundColor: "#222222",
  },
  mainBottomDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 162,
    zIndex: 30,
  },
  mainBottomDockNoAd: {
    height: 112,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 112,
    paddingBottom: 28,
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadows.nav,
  },
  bottomNavDocked: {
    position: "relative",
    bottom: undefined,
    left: undefined,
    right: undefined,
    width: "100%",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 14,
    gap: 3,
  },
  navText: { color: colors.textMuted, fontSize: 10 },
  navActive: { color: colors.mint700, fontWeight: "700" },
  topBar: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  topCenter: { flex: 1, alignItems: "center" },
  topTitleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  topTitle: { color: "#FFF", fontSize: 16, fontWeight: "700", maxWidth: 220 },
  topInlineCount: {
    color: "rgba(255,255,255,.88)",
    fontSize: 11,
    fontWeight: "600",
  },
  topSub: { color: "rgba(255,255,255,.82)", fontSize: 10, marginTop: 2 },
  topSide: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  olderMessagesLoader: { marginVertical: 12 },
  profileTabs: {
    height: 45,
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  profileTab: { flex: 1, alignItems: "center", justifyContent: "center" },
  profileTabText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  profileTabActive: { color: colors.mint700, fontWeight: "700" },
  profileTabLine: {
    position: "absolute",
    bottom: 0,
    width: 45,
    height: 2,
    backgroundColor: colors.mint600,
  },
  spaceProfile: { paddingBottom: 116, backgroundColor: "#FFF" },
  defaultCover: {
    height: 230,
    backgroundColor: "#DADDDC",
    alignItems: "center",
    justifyContent: "center",
  },
  coverMeta: {
    alignSelf: "center",
    marginTop: -15,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(45,48,47,.76)",
  },
  coverMetaText: { color: "#FFF", fontSize: 10 },
  spaceIntro: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  spaceEyebrow: {
    color: colors.mint700,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  spaceTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 7,
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
    marginBottom: 14,
  },
  detailMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailMetaText: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  gradientTags: {
    color: colors.mint700,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 11,
  },
  spaceBody: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  memberSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 23,
    paddingBottom: 12,
  },
  memberSectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  memberSectionCount: {
    color: colors.mint700,
    fontSize: 11,
    fontWeight: "800",
  },
  hostBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  hostAvatar: { position: "relative" },
  hostCopy: { flex: 1, marginLeft: 15 },
  hostNameLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  crown: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint600,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  hostName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  hostIntro: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },
  memberPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  memberPreviewItem: { width: 54, alignItems: "center" },
  memberMore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  memberMoreText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  gridName: { color: colors.textSubtle, fontSize: 10, marginTop: 6 },
  detailSticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: "rgba(255,255,255,.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailStickyDark: {
    backgroundColor: "rgba(34,34,34,.98)",
    borderTopColor: "#2D2D2D",
  },
  detailJoinButton: {
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    ...shadows.soft,
  },
  detailJoinGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pendingButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  pendingText: { color: colors.textSubtle, fontSize: 12, fontWeight: "700" },
  joinForm: { padding: 20, paddingBottom: 110 },
  joinProfile: {
    alignSelf: "center",
    position: "relative",
    marginTop: 8,
    marginBottom: 8,
  },
  editDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint600,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  counter: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "right",
    marginTop: 5,
  },
  detailScroll: { padding: 20, paddingBottom: 130 },
  hero: { alignItems: "center", paddingVertical: 12 },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 14,
  },
  heroMeta: { color: colors.textMuted, fontSize: 11, marginTop: 5 },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  tag: {
    color: colors.mint700,
    backgroundColor: colors.mint050,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 11,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 20,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  cardAction: { color: colors.mint700, fontSize: 11, fontWeight: "600" },
  body: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 5,
  },
  avatarRow: { flexDirection: "row" },
  avatar: {
    flexShrink: 0,
    backgroundColor: "#E7E9E8",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
  },
  avatarMore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: -9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  avatarMoreText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  notice: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: colors.mint050,
    padding: 15,
    borderRadius: 13,
    marginTop: 14,
  },
  noticeTitle: { color: colors.mint800, fontSize: 12, fontWeight: "700" },
  noticeText: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    paddingHorizontal: 20,
    backgroundColor: "#F7F7F7",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stickyDark: {
    backgroundColor: "rgba(34,34,34,.98)",
    borderTopColor: "#343434",
  },
  primary: {
    height: 50,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: colors.mint600,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fullGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { backgroundColor: colors.gray200, opacity: 0.55 },
  primaryText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  hint: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
  },
  chatTabs: {
    height: 44,
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chatTab: { flex: 1, alignItems: "center", justifyContent: "center" },
  chatTabText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chatTabActive: { color: colors.mint700, fontWeight: "700" },
  chatIndicator: {
    position: "absolute",
    bottom: 0,
    width: 38,
    height: 2,
    backgroundColor: colors.mint600,
  },
  messages: { padding: 20, paddingBottom: 8, maxWidth: "100%" },
  date: {
    alignSelf: "center",
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 15,
  },
  system: {
    alignSelf: "center",
    maxWidth: "90%",
    color: colors.textMuted,
    fontSize: 10,
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    marginBottom: 22,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 17,
    maxWidth: "100%",
    minWidth: 0,
  },
  mineRow: { justifyContent: "flex-end" },
  messageBlock: { maxWidth: "76%", minWidth: 0, flexShrink: 1, marginLeft: 8 },
  mineMessageBlock: {
    maxWidth: "76%",
    minWidth: 0,
    flexShrink: 1,
    marginLeft: 0,
    marginRight: 8,
    alignItems: "flex-end",
  },
  sender: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 5,
  },
  mineSender: { textAlign: "right" },
  bubbleLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
  },
  mineBubbleLine: { justifyContent: "flex-end" },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
  },
  imageBubble: { padding: 0, overflow: "hidden" },
  mineBubble: { backgroundColor: "#F5F5F5", borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: "#F5F5F5", borderBottomLeftRadius: 4 },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  deletedMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  deletedMessageText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  mineText: { color: colors.text },
  chatImage: { width: 140, height: 140, borderRadius: 12, resizeMode: "cover" },
  time: {
    minWidth: 50,
    maxWidth: 58,
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 2,
    flexShrink: 0,
    textAlign: "center",
  },
  composerPanel: {
    overflow: "hidden",
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    zIndex: 6,
    elevation: 6,
  },
  toolMenu: {
    paddingHorizontal: 15,
    paddingTop: 22,
    paddingBottom: 12,
    gap: 10,
  },
  toolGrid: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    paddingVertical: 2,
  },
  toolDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 0,
  },
  toolDividerDark: { backgroundColor: "#303030" },
  toolAction: { width: 60, alignItems: "center", gap: 5 },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  styleTools: { paddingHorizontal: 18, paddingVertical: 14, gap: 15 },
  colorLine: { gap: 8 },
  colorLabelLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  colorLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: "700" },
  customColorLink: { color: colors.mint700, fontSize: 10, fontWeight: "800" },
  colorOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorDotActive: { borderWidth: 2, borderColor: colors.mint700 },
  composer: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: { backgroundColor: colors.mint050 },
  composerInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray050,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 13,
    textAlign: "left",
    letterSpacing: 0,
  },
  send: { width: 36, height: 36, borderRadius: 18, overflow: "hidden" },
  sendGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  panel: { padding: 20, paddingBottom: 40 },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  panelTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  writeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.mint600,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  writeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  story: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  storyTop: { flexDirection: "row", justifyContent: "space-between" },
  storyTime: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
  },
  storyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  storyBody: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  storyMeta: { color: colors.textMuted, fontSize: 10, marginTop: 13 },
  myProfile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.mint050,
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
  },
  memberPanel: { padding: 16, paddingBottom: 40 },
  memberLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginHorizontal: 4,
    marginBottom: 10,
  },
  memberCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  memberCardBody: { flex: 1, marginLeft: 16 },
  memberTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  memberName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  memberIntro: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  permissionTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 9,
  },
  permissionTag: {
    color: colors.mint700,
    backgroundColor: colors.mint050,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 9,
    fontWeight: "700",
  },
  page: { padding: 20, paddingBottom: 100 },
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  notificationBadge: {
    position: "absolute",
    right: 3,
    top: 3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3D5A",
    borderWidth: 0,
  },
  notificationBadgeInline: {
    position: "relative",
    right: 0,
    top: 0,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 0,
  },
  notificationBadgeText: { color: "#FFF", fontSize: 8, fontWeight: "800" },
  drawerLayer: { ...StyleSheet.absoluteFill, zIndex: 50, flexDirection: "row" },
  drawerDimHit: { flex: 1 },
  drawerDim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(20,23,22,.28)",
  },
  drawer: {
    width: "84%",
    maxWidth: 340,
    backgroundColor: "#FFF",
    ...shadows.floating,
  },
  chatDrawer: {
    width: "87%",
    maxWidth: 340,
    backgroundColor: "#FFF",
    ...shadows.floating,
  },
  drawerProfile: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 92,
    paddingBottom: 34,
    borderBottomWidth: 8,
    borderBottomColor: colors.gray050,
  },
  drawerAvatar: { position: "relative" },
  drawerProfileName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 11,
  },
  drawerProfileIntro: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },
  chatDrawerMenu: { paddingHorizontal: 15, paddingTop: 84, paddingBottom: 34 },
  drawerMenu: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  drawerMenuText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  drawerHead: {
    height: 58,
    paddingLeft: 20,
    paddingRight: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  drawerTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  readAll: {
    alignSelf: "flex-end",
    color: colors.mint700,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  drawerNotice: {
    minHeight: 86,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  notification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  notifBody: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 15,
  },
  notifTime: { color: colors.textMuted, fontSize: 9, marginTop: 7 },
  profileHero: { alignItems: "center", paddingVertical: 15 },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
  },
  profilePhone: { color: colors.textMuted, fontSize: 11, marginTop: 5 },
  pointCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    padding: 18,
    marginTop: 10,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  pointLabel: { color: colors.textMuted, fontSize: 10 },
  pointValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "500",
    marginTop: 4,
  },
  pointButton: {
    backgroundColor: colors.mint050,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  pointButtonText: { color: colors.mint700, fontSize: 11, fontWeight: "700" },
  settingsLink: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderRadius: 13,
    paddingHorizontal: 15,
    marginTop: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  settingsText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  form: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 120 },
  upload: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray100,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.gray300,
  },
  uploadTitle: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  uploadHint: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  field: { marginTop: 20 },
  fieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 13,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 13,
  },
  textarea: { height: 105, paddingTop: 13, textAlignVertical: "top" },
  capacityRow: { flexDirection: "row", gap: 8 },
  capacity: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  capacityActive: {
    backgroundColor: colors.mint050,
    borderColor: colors.mint600,
  },
  capacityText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  capacityTextActive: { color: colors.mint700, fontWeight: "800" },
  fakeField: {
    height: 48,
    borderRadius: 13,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  fakeText: { color: colors.mint700, fontSize: 12 },
  settings: { padding: 20, paddingBottom: 40 },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 7,
    marginLeft: 3,
  },
  menuGroup: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  menu: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
  menuValue: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "right",
    maxWidth: 150,
  },
  smallSwitch: {
    alignSelf: "center",
    transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
  },
  danger: { color: colors.pink600 },
  version: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 18,
  },
  empty: { alignItems: "center", paddingVertical: 70 },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
  },
  emptyBody: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  searchHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchPageBox: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray050,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  searchResults: { paddingBottom: 40 },
  searchResultHead: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchResultTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  searchResultCount: { color: colors.mint700, fontSize: 12, fontWeight: "800" },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  continuousRow: { marginTop: -11 },
  avatarSpacer: { width: 46 },
  imagePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  secretContent: { maxWidth: 210 },
  secretLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 7,
  },
  secretLabelText: {
    color: colors.pink600,
    fontSize: 9,
    fontWeight: "700",
  },
  systemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
    marginBottom: 24,
  },
  systemLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  systemLineDark: {
    backgroundColor: "#2A2A2A",
  },
  systemContent: {
    maxWidth: "82%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  systemText: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 16,
  },
  systemTextDark: {
    color: "#686868",
  },
  sheetLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    justifyContent: "flex-end",
  },
  sheetDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(20,23,22,.3)",
  },
  memberSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28 + IOS_BOTTOM_SAFE_PADDING,
    ...shadows.floating,
  },
  privatePinSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    ...shadows.floating,
  },
  privatePinTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  privatePinBody: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  privatePinInput: { marginBottom: 14 },
  privatePinButton: { marginTop: 4 },
  coHostSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadows.floating,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray200,
    marginBottom: 18,
  },
  sheetProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  publicStoryCardDark: {
    backgroundColor: "#222222",
    borderBottomColor: "#333333",
  },
  sheetProfileSelf: {
    flexDirection: "column",
    justifyContent: "center",
    gap: 10,
  },
  sheetName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  sheetIntro: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  selfProfileEditAction: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 22,
    paddingBottom: 2,
  },
  memberActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    paddingTop: 20,
    rowGap: 18,
  },
  memberAction: { width: "25%", alignItems: "center", gap: 8 },
  memberActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  heartAction: { backgroundColor: colors.pink050 },
  memberActionText: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
  },
  secretComposer: { paddingTop: 18, paddingBottom: 8 },
  secretTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  secretInput: {
    minHeight: 104,
    borderRadius: 13,
    backgroundColor: colors.gray050,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: "top",
  },
  secretSend: {
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.mint600,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    overflow: "hidden",
  },
  coHostToggle: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  coHostToggleTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  coHostToggleText: { color: colors.textMuted, fontSize: 10, marginTop: 5 },
  permissionCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionCheckOn: { backgroundColor: colors.mint600 },
  permissionHint: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 8,
  },
  rankingList: { paddingBottom: 40 },
  rankingIntro: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: colors.gray050,
  },
  rankingIntroTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  rankingIntroText: { color: colors.textMuted, fontSize: 10, marginTop: 5 },
  rankingRow: {
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rankNumber: {
    width: 28,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginRight: 8,
  },
  rankNumberTop: { color: colors.mint700, fontSize: 18 },
  rankingBody: { flex: 1, marginLeft: 12 },
  rankingName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  rankingDesc: { color: colors.textMuted, fontSize: 10, marginTop: 5 },
  rankingCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.mint050,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  rankingCountText: { color: colors.mint700, fontSize: 10, fontWeight: "800" },
  topSpaceSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadows.floating,
  },
  topSpaceTitleLine: { flexDirection: "row", alignItems: "center", gap: 12 },
  topSpaceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  topSpaceTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  topSpaceBody: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  topSpaceStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.gray050,
    borderRadius: 15,
    paddingVertical: 13,
    marginTop: 16,
  },
  topSpaceStatLabel: {
    color: colors.textMuted,
    fontSize: 9,
    textAlign: "center",
  },
  topSpaceStatValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
  packageLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 17,
    marginBottom: 9,
  },
  packageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  packageOption: {
    width: "24%",
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: colors.gray050,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  packageOptionActive: {
    backgroundColor: colors.mint050,
    borderColor: colors.mint600,
  },
  packagePoints: { color: colors.textSubtle, fontSize: 11, fontWeight: "800" },
  packageDuration: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
  packageTextActive: { color: colors.mint700 },
  topSpaceResult: {
    color: colors.mint700,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 11,
  },
  topSpaceError: { color: colors.pink600 },
  topSpaceButton: {
    height: 48,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 13,
  },
  topSpaceButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    resizeMode: "cover",
  },
  uploadRound: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 10,
    ...shadows.tiny,
  },
  uploadRoundImage: { width: "100%", height: "100%", resizeMode: "cover" },
  detailMemberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingBottom: 26,
  },
  detailMemberItem: {
    width: "33.333%",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailMemberAvatar: { position: "relative" },
  detailMemberNameLine: { minHeight: 22, justifyContent: "center" },
  unreadMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
    marginBottom: 24,
    maxWidth: "100%",
  },
  unreadLine: { flex: 1, height: 1, backgroundColor: "#D7DDD9" },
  unreadText: { color: colors.textMuted, fontSize: 10, fontWeight: "400" },
  unreadLineDark: { backgroundColor: "#2A2A2A" },
  unreadTextDark: { color: "#686868" },
  storyAuthor: { flexDirection: "row", alignItems: "center", gap: 14 },
  storyAuthorName: { color: colors.text, fontSize: 12, fontWeight: "800" },
  storyComment: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: colors.gray050,
    borderRadius: 13,
    padding: 11,
    marginTop: 14,
  },
  storyCommentName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 4,
  },
  storyCommentTime: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "400",
  },
  storyCommentBody: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  storyFab: {
    position: "absolute",
    right: 20,
    bottom: 22,
    width: 52,
    height: 52,
    borderRadius: 26,
    ...shadows.floating,
  },
  memberManage: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  storyChatButton: {
    position: "absolute",
    left: 20,
    right: 84,
    bottom: 22,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.mint600,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.floating,
  },
  storyDetailHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  storyDetailHeaderTitle: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  storyHeaderRight: {
    minWidth: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  storyHeaderAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  storyMenuLayer: { ...StyleSheet.absoluteFill, zIndex: 70 },
  storyHeaderMenu: { position: "absolute", top: 58, right: 12, zIndex: 40 },
  storyHeaderMenuList: {
    minWidth: 144,
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.floating,
  },
  storyHeaderMenuRow: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  storyHeaderMenuText: { color: colors.text, fontSize: 12, fontWeight: "500" },
  storyDetail: { padding: 20, paddingBottom: 24 },
  storyDetailTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 25,
    marginBottom: 24,
  },
  storyLinkedRoom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFF",
    borderRadius: 15,
    padding: 11,
    marginTop: 18,
    marginBottom: 24,
  },
  storyLinkedLabel: { color: colors.textMuted, fontSize: 8 },
  storyLinkedName: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
  },
  storyDetailText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 25,
    marginTop: 10,
    marginBottom: 10,
  },
  storyDetailImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    marginBottom: 10,
  },
  storyFirstImage: { marginTop: 14 },
  commentSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 6,
  },
  commentCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  commentMetaLine: { flexDirection: "row", alignItems: "center", gap: 18 },
  storyDetailComment: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  commentComposerShell: {
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  commentComposer: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF",
  },
  commentInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray050,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 13,
  },
  commentSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.mint600,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  storyEditor: { padding: 20, paddingBottom: 24 },
  storyTitleInput: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 18,
  },
  storyEditorVisibility: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginBottom: 12,
  },
  storyTextBlockWrap: { position: "relative" },
  storyBlockInput: {
    minHeight: 44,
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: "top",
    paddingVertical: 8,
    paddingRight: 34,
  },
  storyTextRemove: {
    position: "absolute",
    right: 0,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray050,
  },
  storyEditorImageWrap: { position: "relative", marginVertical: 4 },
  storyEditorImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 15,
    backgroundColor: colors.gray100,
  },
  storyImageRemove: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  storyInsertRow: { flexDirection: "row", gap: 9, marginVertical: 18 },
  storyInsert: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    backgroundColor: colors.mint050,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  storyInsertText: { color: colors.mint700, fontSize: 12, fontWeight: "700" },
  storyEditorToolbar: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  storyToolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray050,
  },
  storyEditorCancel: {
    height: 38,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  storyEditorCancelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  storyEditorSubmit: {
    height: 38,
    minWidth: 82,
    borderRadius: 12,
    backgroundColor: colors.mint600,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memberProfilePage: { alignItems: "center", padding: 28 },
  memberProfileNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
  },
  memberProfileName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  memberProfileRoom: { color: colors.textMuted, fontSize: 10, marginTop: 7 },
  memberProfileCard: {
    alignSelf: "stretch",
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    marginTop: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  memberProfileLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  memberProfileIntro: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },
  overviewPage: { paddingBottom: 40 },
  overviewIntro: { padding: 20, backgroundColor: "#FFF" },
  overviewSection: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },
  overviewStory: {
    backgroundColor: "#FFF",
    borderRadius: 17,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  requestList: { padding: 16 },
  requestCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  requestBody: { flex: 1, marginLeft: 13 },
  requestActions: { flexDirection: "row", gap: 8, marginTop: 13 },
  rejectButton: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: { color: colors.textSubtle, fontSize: 12, fontWeight: "700" },
  approveButton: { flex: 1, height: 40, borderRadius: 11, overflow: "hidden" },
  approveGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  requestResult: {
    color: colors.mint700,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 12,
  },
  requestRejected: { color: colors.pink600 },
  fieldHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fieldCounter: { color: colors.textMuted, fontSize: 10 },
  radioList: {
    backgroundColor: "#FFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  radioRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  radioDisabled: { backgroundColor: colors.gray050 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: { borderColor: colors.mint600 },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mint600,
  },
  radioText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 10,
  },
  radioTextDisabled: { color: colors.textMuted },
  radioReason: { marginLeft: "auto", color: colors.textMuted, fontSize: 9 },
  stepper: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  stepperButton: {
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray050,
  },
  stepperInput: {
    width: 54,
    height: 50,
    textAlign: "right",
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 4,
  },
  stepperUnit: { color: colors.textSubtle, fontSize: 12, paddingRight: 8 },
  capacityHint: { color: colors.textMuted, fontSize: 9, marginTop: 7 },
  capacityLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 10,
  },
  capacityHintInline: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "400",
    lineHeight: 14,
  },
  deleteRoomLink: {
    alignSelf: "flex-end",
    marginTop: 20,
    marginRight: 10,
    padding: 8,
  },
  deleteRoomText: {
    color: colors.mint700,
    fontSize: 10,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  drawerNoticeRead: { backgroundColor: colors.gray050 },
  notifIconRead: { backgroundColor: colors.gray100 },
  notifTitleRead: { color: colors.textMuted },
  confirmLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(20,23,22,.24)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    ...shadows.floating,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  confirmActions: { flexDirection: "row", gap: 9, marginTop: 20 },
  confirmCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
  },
  confirmAccept: { flex: 1, height: 44, borderRadius: 12, overflow: "hidden" },
  confirmAcceptGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 90,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "rgba(35,39,37,.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    zIndex: 80,
  },
  toastText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  photoViewer: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,17,16,.82)",
  },
  photoViewerImage: {
    width: 280,
    height: 280,
    borderRadius: 22,
    resizeMode: "cover",
  },
  photoViewerClose: {
    position: "absolute",
    right: 22,
    top: 22,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerExpandedImage: { width: "100%", height: "100%" },
  photoViewerPage: {
    width: SCREEN_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.94)",
  },
  photoViewerPageImageWrap: { width: "92%", height: "82%" },
  photoViewerCloseLeft: {
    position: "absolute",
    left: 18,
    top: 56,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerMore: {
    position: "absolute",
    right: 18,
    top: 56,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerMenu: {
    position: "absolute",
    right: 18,
    top: 106,
    minWidth: 132,
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.floating,
  },
  photoViewerMenuItem: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  photoViewerMenuText: { color: colors.text, fontSize: 12, fontWeight: "500" },
  joinSubmitStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  joinSubmitStatusText: { color: colors.textMuted, fontSize: 11 },
  joinSubmitError: {
    color: colors.pink600,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 18,
  },
  joinSuccessToast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 92,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "rgba(35,39,37,.94)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    zIndex: 200,
    elevation: 20,
  },
  profileMenuGroup: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  profileMenu: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  menuTrailing: {
    marginLeft: "auto",
    alignSelf: "stretch",
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  defaultRoomImage: {
    backgroundColor: "#E9ECEA",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  adultBlurMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,.38)",
  },
  defaultRoomLogo: { opacity: 0.38 },
  defaultCoverLogo: { backgroundColor: "#ECEFED" },
  defaultCoverLogoImage: { width: 110, height: 82, opacity: 0.36 },
  storyLinkedRoomInline: {
    maxWidth: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  storyLinkedText: { flex: 1, minWidth: 0 },
  storyInlineHeart: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray050,
  },
  storyChatPreview: {
    alignSelf: "flex-start",
    maxWidth: "78%",
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 16,
    ...shadows.tiny,
  },
  storyChatPreviewMine: { alignSelf: "flex-end" },
  storyBubble: { minWidth: 210, overflow: "hidden" },
  storyChatPreviewImage: {
    height: 118,
    marginHorizontal: -13,
    marginTop: -9,
    marginBottom: 10,
    backgroundColor: colors.gray100,
  },
  storyChatPreviewHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  storyChatPreviewLabel: {
    flex: 1,
    color: colors.mint700,
    fontSize: 10,
    fontWeight: "800",
  },
  storyChatPreviewTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  storyChatPreviewBody: {
    color: colors.textSubtle,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  storyChatPreviewMore: {
    alignSelf: "flex-end",
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 8,
  },
  storyPreviewImage: {
    width: "100%",
    height: 150,
    borderRadius: 14,
    backgroundColor: colors.gray100,
    marginTop: 12,
  },
  pointLogOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 120,
    backgroundColor: "#FFF",
  },
  pointLogPage: { flex: 1, backgroundColor: "#FFF" },
  pointLogScroll: { paddingBottom: 28 },
  pointLogDate: {
    color: colors.textSubtle,
    fontSize: 15,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pointLogRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pointLogTime: { width: 64, color: colors.textSubtle, fontSize: 16 },
  pointLogTitle: { flex: 1, color: colors.text, fontSize: 15 },
  pointLogAmount: {
    minWidth: 72,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "500",
  },
  pointLogPlus: { color: "#1C1C1C" },
  pointLogMinus: { color: colors.pink600 },
  pointLogBalance: {
    width: 58,
    color: colors.textSubtle,
    fontSize: 15,
    textAlign: "right",
  },
  paymentHistoryRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  paymentHistoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint050,
  },
  paymentHistoryBody: { flex: 1, minWidth: 0 },
  paymentHistoryTitle: { color: colors.text, fontSize: 14, fontWeight: "500" },
  paymentHistorySubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  paymentHistoryAmount: {
    minWidth: 76,
    textAlign: "right",
    color: "#1C1C1C",
    fontSize: 14,
    fontWeight: "500",
  },
  hyperlink: {
    color: "#2878B8",
    textDecorationLine: "underline",
  },
  itemShopPage: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 130,
    backgroundColor: "#FFF",
  },
  itemShopSectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 14,
  },
  itemShopGrid: { flexDirection: "row", gap: 9, marginBottom: 24 },
  itemShopSmallCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 154,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFF",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 15,
  },
  itemShopCardTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 9,
  },
  itemShopPrice: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  itemShopBuy: { width: "100%", height: 34, borderRadius: 10, overflow: "hidden", marginTop: "auto" },
  itemShopBuyGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  itemShopBuyText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  itemShopThemeList: { gap: 9, marginBottom: 16 },
  itemShopThemeBuy: { height: 44, borderRadius: 13, overflow: "hidden", marginTop: 4, marginBottom: 28 },
  itemShopThemeCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFF",
  },
  itemShopThemePreview: { width: 84, height: 50, borderRadius: 10, alignItems: "flex-start", justifyContent: "center", paddingLeft: 8 },
  itemShopThemePreviewWhite: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  itemShopThemeLogo: { width: 20, height: 20 },
  itemShopThemeLogoDark: { tintColor: "#222222" },
  itemShopThemeCopy: { flex: 1, minWidth: 0 },
  itemShopRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.gray300, alignItems: "center", justifyContent: "center" },
  itemShopRadioDot: { width: 12, height: 12, borderRadius: 6 },
  itemShopAdCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "#FFF",
  },
  itemShopAdBuy: { minWidth: 84, height: 36, borderRadius: 10, overflow: "hidden", backgroundColor: colors.mint700, marginLeft: 4 },
  itemShopAdBuyText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  itemShopRestore: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: 10,
    marginBottom: 22,
  },
  itemShopRestoreText: { color: colors.mint700, fontSize: 11, fontWeight: "600" },
  itemShopFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 86 + IOS_BOTTOM_SAFE_PADDING,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 12 + IOS_BOTTOM_SAFE_PADDING,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemShopFooterLabel: { color: colors.textMuted, fontSize: 10 },
  itemShopFooterPoints: { color: colors.text, fontSize: 17, fontWeight: "600", marginTop: 2 },
  itemShopRecharge: { width: 112, height: 42, borderRadius: 13, overflow: "hidden" },
  itemShopRechargeGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  primaryWhiteGradient: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  chargeLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  chargeDim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,.48)" },
  chargeModal: {
    width: "80%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: "#FFF",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 22,
  },
  chargeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 18,
  },
  chargeOption: {
    height: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  chargeRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.textSubtle,
  },
  chargeRadioOn: {
    borderColor: colors.mint700,
    backgroundColor: colors.mint050,
  },
  chargePoint: { color: colors.text, fontSize: 17 },
  chargeWon: { color: colors.textSubtle, fontSize: 13, marginTop: 4 },
  chargeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 38,
    marginTop: 24,
  },
  chargeAction: { height: 40, justifyContent: "center" },
  chargeCancel: { color: colors.textSubtle, fontSize: 14 },
  chargeBuy: { color: colors.mint700, fontSize: 14 },
  chargeBuyActive: { color: colors.mint700 },
  accessSave: {
    height: 48,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  accessSaveGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSaveButton: {
    height: 50,
    borderRadius: 13,
    overflow: "hidden",
    marginTop: 16,
  },
  profileSaveGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileActionMenu: { position: "absolute", top: 58, right: 12, zIndex: 50 },
  profileActionList: {
    minWidth: 168,
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.floating,
  },
  profileActionRow: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  profileActionText: { color: colors.text, fontSize: 12, fontWeight: "500" },
  inlineLabelRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  inlineOptionalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "400",
    lineHeight: 14,
  },
  roomDetailMenu: { position: "absolute", top: 58, right: 12, zIndex: 50 },
  roomDetailTags: { marginTop: 12, marginBottom: 6, lineHeight: 19 },
  customColorDot: {
    backgroundColor: "#FFF",
    borderStyle: "dashed",
    borderColor: colors.gray300,
  },
  pinFieldWrap: { marginTop: 16 },
  regionFieldWrap: { marginTop: 16 },
  customColorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
  customPickerRoot: { gap: 12 },
  customPickerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  customPickerWheel: { width: 204, height: 204 },
  customPickerWheelLarge: { width: 260, height: 260 },
  customPickerPreviewBar: {
    width: 52,
    height: 204,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customPickerPreviewBarLarge: {
    width: 56,
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customPickerSlider: { borderRadius: 999, height: 16 },
  customInputWidget: { marginTop: 4 },
  customInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
  },
  customInputTitle: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "500",
  },
  customColorActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  customColorPage: { padding: 20, paddingBottom: 40, gap: 14 },
  customColorPageTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  customColorPageBody: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 8,
  },
  customColorPreview: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  customColorPreviewText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
  },
  customColorPreviewBubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  memberProfileAvatarLarge: { width: 96, height: 96, borderRadius: 48 },
  memberProfileEditCard: {
    alignSelf: "stretch",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.tiny,
  },
  profileEditShortcut: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  profileEditIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mint300,
  },
  profileEditShortcutText: {
    color: colors.mint700,
    fontSize: 10,
    fontWeight: "700",
  },
  memberProfileActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: 18,
    alignSelf: "stretch",
    marginTop: 24,
  },
  profileQuickAction: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  profileQuickActionDisabled: {
    opacity: 0.45,
  },
  profileQuickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mint050,
    alignItems: "center",
    justifyContent: "center",
  },
  profileQuickActionIconPink: {
    backgroundColor: colors.pink050,
  },
  profileQuickActionText: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
  },
  chatInitialLoader: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    zIndex: 12,
  },
  olderMessagesLoaderOverlay: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  newMessagePreview: {
    position: "absolute",
    left: 82,
    right: 62,
    bottom: 74,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,.78)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    zIndex: 30,
    ...shadows.tiny,
  },
  newMessagePreviewDark: {
    backgroundColor: "rgba(0,0,0,.72)",
    borderColor: "rgba(255,255,255,.08)",
  },
  newMessagePreviewName: {
    maxWidth: 86,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  newMessagePreviewText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "left",
  },
  newMessagePreviewTextDark: {
    color: "#F2F2F2",
  },
  scrollToBottomButton: {
    position: "absolute",
    right: 18,
    bottom: 78,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    zIndex: 29,
    ...shadows.tiny,
  },
  roomRowTop: { backgroundColor: "#F4FBF7" },
  topInlineLabel: {
    position: "absolute",
    left: 14,
    top: 8,
    color: colors.mint700,
    fontSize: 9,
    fontWeight: "700",
  },
  tightBubbleLine: { gap: 2 },
  tightTime: { minWidth: 42, maxWidth: 48 },
  deliveryMeta: {
    minWidth: 42,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 1,
  },
  deliveryProgress: { color: colors.textMuted, fontSize: 8, marginTop: 1 },
  deliveryFailed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingBottom: 4,
    marginTop: 6,
  },
  deliveryRetry: { color: colors.mint700, fontSize: 11, fontWeight: "600" },
  deliveryDivider: { color: colors.gray300, fontSize: 10 },
  deliveryDelete: { color: colors.pink600, fontSize: 11, fontWeight: "600" },
  imageEditorScreen: { flex: 1, backgroundColor: "#111" },
  imageEditorBody: { flex: 1 },
  imageEditorBodyContent: {
    padding: 18,
    alignItems: "center",
    paddingBottom: 18,
  },
  imageEditorPreviewWrap: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  imageEditorPreview: { position: "absolute" },
  imageCropFocus: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    borderStyle: "dashed",
  },
  imageCropMoveSurface: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
    backgroundColor: "rgba(255,255,255,0.001)",
  },
  imageCropResizeHandle: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#FFF",
    backgroundColor: "#8A8A8A",
    zIndex: 4,
  },
  imageCropHandleTopLeft: { left: -15, top: -15 },
  imageCropHandleTopRight: { right: -15, top: -15 },
  imageCropHandleBottomLeft: { left: -15, bottom: -15 },
  imageCropHandleBottomRight: { right: -15, bottom: -15 },
  imageCropGridLineVertical: {
    position: "absolute",
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,.72)",
  },
  imageCropGridLineHorizontal: {
    position: "absolute",
    top: "33.33%",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,.72)",
  },
  imageEditorRemove: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageEditorHint: {
    color: "rgba(255,255,255,.68)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  imageEditorPager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 12,
  },
  imageEditorPageButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.16)",
  },
  imageEditorPageText: {
    minWidth: 46,
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  disabledSoft: { opacity: 0.35 },
  imageEditorRemoveTextButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  imageEditorRemoveText: {
    color: "rgba(255,255,255,.72)",
    fontSize: 11,
    fontWeight: "500",
  },
  imageEditorThumbs: { gap: 14, paddingVertical: 10, paddingRight: 8 },
  imageEditorThumbWrap: {
    width: 94,
    height: 94,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  imageEditorThumbActive: { borderColor: colors.mint600 },
  imageEditorThumb: { width: "100%", height: "100%", borderRadius: 14 },
  imageEditorOrder: {
    position: "absolute",
    left: 4,
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,.62)",
    color: "#FFF",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
  },
  imageEditorThumbRemove: {
    position: "absolute",
    right: -5,
    top: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(28,28,28,.78)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,.45)",
  },
  imageEditorFooter: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    backgroundColor: "#111",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,.12)",
  },
  imageEditorToolbar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  imageEditorToolSide: {
    minWidth: 58,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  imageEditorToolButton: {
    width: 52,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  imageEditorCancel: { color: "#0A84FF", fontSize: 16, fontWeight: "500" },
  imageEditorDone: { color: "#FFD60A", fontSize: 16, fontWeight: "700" },
  globalBusyLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20000,
    elevation: 20000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28,28,28,.18)",
  },
  globalBusyCard: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    ...shadows.floating,
  },
  lockDisableHint: {
    color: colors.pink600,
    fontSize: 10,
    lineHeight: 15,
    marginTop: -4,
  },
  lockForgotButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    justifyContent: "center",
    marginTop: 2,
  },
  lockForgotText: { color: colors.mint700, fontSize: 11, fontWeight: "600" },
  lockRecoveryPage: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 42,
    gap: 14,
    backgroundColor: "#FFF",
  },
  passwordChangePage: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 34,
    gap: 12,
    backgroundColor: "#FFF",
  },
  pinnedIconImage: {
    width: 11,
    height: 11,
    marginHorizontal: 4,
    transform: [{ rotate: "-20deg" }],
  },
  notificationBadgeDot: {
    minWidth: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    paddingHorizontal: 0,
    right: 5,
    top: 5,
  },
  whitePage: { backgroundColor: "#FFF" },
  rankingPageDark: { backgroundColor: "#222222" },
  appLockOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    backgroundColor: "#FFF",
  },
  drawerNarrow: { width: "80%", maxWidth: 312 },
  drawerProfileUnified: {
    paddingBottom: 42,
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
  },
  drawerMenuUnified: { paddingTop: 34 },
  topSpaceTitleLineRelaxed: {
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 22,
  },
  topSpacePackageRelaxed: { rowGap: 10, marginBottom: 12 },
  topSpaceButtonRelaxed: { marginTop: 18 },
  imageRatioRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 0,
    flexWrap: "wrap",
  },
  imageRatioOption: {
    minWidth: 48,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  imageRatioOptionActive: {
    backgroundColor: colors.mint700,
    borderColor: colors.mint700,
  },
  imageRatioText: {
    color: "rgba(255,255,255,.72)",
    fontSize: 10,
    fontWeight: "600",
  },
  imageRatioTextActive: { color: "#FFF" },
  toolCountdown:{color:colors.mint700,fontSize:10,fontWeight:"700"},
  edgeBackLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 32,
    zIndex: 120,
  },
});
