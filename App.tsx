import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenCapture from 'expo-screen-capture';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import ExternalColorPicker, { BrightnessSlider, InputWidget, Panel3 } from 'reanimated-color-picker';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Switch, Text, TextInput, View, PanResponder, Keyboard,
} from 'react-native';
import { rooms, stories } from './src/mockData';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import {
  getCurrentSession,
  normalizeKoreanPhoneNumber,
  requestPasswordRecoveryOtp,
  requestSignUpPhoneOtp,
  resendPhoneOtp,
  signInWithAdminId,
  signInWithPhonePassword,
  signOut,
  signUpWithPhonePassword,
  updateCurrentUserPassword,
  verifyPhoneOtp,
} from './src/services/auth';
import { createRoom, decideRoomJoin, listMyActiveRoomIds, listPendingRoomJoinRequests, listRoomMembers, listRooms, requestRoomJoinWithAvatar, setRoomCover, setRoomOwnerProfile, ServerRoom, ServerRoomMember } from './src/services/rooms';
import { getVerificationStatus, startAdultVerification } from './src/services/verification';
import { registerPushDevice } from './src/services/notifications';
import { configureRoomAccess, kickOrBanRoomMember, listBlockedRoomMembers, setRoomMemberRole, setRoomPinned, transferRoomOwnership, unbanRoomMember, verifyRoomPin } from './src/services/roomFeatures';
import { listRecentSystemMessages, listRoomMessages, sendTextMessage, ServerRoomMessage } from './src/services/chat';
import { sendUploadedImages, uploadValidatedImage } from './src/services/media';
import { requestAccountDeletion, submitReport } from './src/services/safety';
import { addStoryComment, createStoryWithBlocks, deleteStory, deleteStoryComment, listStories, recordStoryView, ServerStory, StoryBlockInput, toggleStoryLike, updateStoryContent } from './src/services/stories';
import { claimPointReward, getMyWallet, showRewardedAd } from './src/services/monetization';
import { configurePurchases, purchaseProduct, STORE_PRODUCTS } from './src/services/purchases';
import { boostTopSpace, listTopSpaces } from './src/services/topSpace';
import { colors, radius, shadows, spacing } from './src/theme';
import { MainTab, Room } from './src/types';

type Screen = 'main' | 'search' | 'ranking' | 'detail' | 'apply' | 'chat' | 'settings' | 'adultVerification' | 'create';
type BottomTab = 'discover' | 'myRooms' | 'stories' | 'profile';
type IconName = keyof typeof Ionicons.glyphMap;
type ChatPanel = 'stories' | 'overview' | 'members' | 'blocked' | 'applications' | 'profile' | 'roomSettings' | null;
type ComposerTool = 'media' | 'style' | 'secret' | null;
const CHAT_COLLAPSE_CHAR_THRESHOLD = 140;
const CHAT_COLLAPSE_LINE_LIMIT = 4;
const DEMO_ROOM_ID = 'green-table';
type RoomMember = {userId?:string;name:string;intro:string;avatarUri?:string;owner?:boolean;mine?:boolean;coHost?:boolean;blocked?:boolean};
type TopSpacePackage = { points: number; seconds: number };
type ColorProduct = { color:string; name:string; price:number };
type Notice = {
  id:string;
  icon:IconName;
  title:string;
  body:string;
  time:string;
  read:boolean;
  roomId?:string;
  destination?:'chat'|'applications'|'promotion';
};
type StoryVisibility = 'room' | 'public';
type StoryBlock = {id:string;type:'text';text:string}|{id:string;type:'image';uri:string;uploadId?:string;storagePath?:string;mimeType?:string};
type StoryComment = {id:string;author:string;authorAvatarUri?:string;body:string;createdAt:string;mine?:boolean};
type StoryItem = {id:string;roomId:string;roomName:string;title:string;author:string;authorAvatarUri?:string;createdAt:string;visibility:StoryVisibility;blocks:StoryBlock[];comments:StoryComment[];views:number;hearts:number;liked?:boolean;mine?:boolean};
type ChatMessage =
  | { id: string; kind: 'text'; mine: boolean; name: string; avatarUri?:string; text: string; time: string; replyTo?:{id:string;name:string;text:string} }
  | { id: string; kind: 'image'; mine: boolean; name: string; avatarUri?:string; imageUris?: string[]; time: string; replyTo?:{id:string;name:string;text:string} }
  | { id: string; kind: 'story'; mine: boolean; name: string; avatarUri?:string; storyId:string; title:string; preview:string; time:string }
  | { id: string; kind: 'secret'; mine: boolean; name: string; avatarUri?:string; recipient: string; text: string; time: string; replyTo?:{id:string;name:string;text:string} }
  | { id: string; kind: 'system'; event: 'join' | 'heart' | 'point' | 'leave' | 'room' | 'kick'; text: string };

const categories: { key: MainTab; label: string }[] = [
  { key: 'promotion', label: '프로모션' }, { key: 'member', label: 'Member' },
  { key: 'concept', label: '콘셉트' }, { key: 'region', label: '지역별' }, { key: 'adult', label: '성인' },
];

const TOP_SPACE_PACKAGES: TopSpacePackage[] = [
  { points: 100, seconds: 20 },
  { points: 500, seconds: 80 },
  { points: 1000, seconds: 180 },
  { points: 2000, seconds: 280 },
  { points: 5000, seconds: 680 },
  { points: 10000, seconds: 1600 },
  { points: 30000, seconds: 4800 },
  { points: 50000, seconds: 8000 },
];

const BUBBLE_COLOR_PRODUCTS:ColorProduct[]=[
  {color:'#F5F5F5',name:'기본 회색',price:0},{color:'#EEF3F1',name:'안개',price:1200},{color:'#E7F1EC',name:'새벽 숲',price:1200},{color:'#E8EEF2',name:'잔잔한 파도',price:1200},
  {color:'#F2EDEF',name:'말린 장미',price:1500},{color:'#E9E5F0',name:'라일락',price:1500},{color:'#EAE7DF',name:'샌드',price:1500},{color:'#E1ECEA',name:'뮤트 민트',price:1800},
  {color:'#CADDD8',name:'세이지',price:1800},{color:'#C8D8DF',name:'블루 그레이',price:1800},{color:'#DBCED4',name:'더스티 핑크',price:2200},{color:'#CFC8DC',name:'모브',price:2200},
  {color:'#ABCBC1',name:'딥 세이지',price:2500},{color:'#A9BCC6',name:'스모키 블루',price:2500},{color:'#BCAEB6',name:'로즈 우드',price:2800},{color:'#819B92',name:'뮤트 포레스트',price:3200},
];
const TEXT_COLOR_PRODUCTS:ColorProduct[]=[
  {color:'#1C1C1C',name:'기본 블랙',price:0},{color:'#505754',name:'차콜',price:1200},{color:'#5B6661',name:'스톤',price:1200},{color:'#53636A',name:'블루 차콜',price:1200},
  {color:'#6B5B62',name:'로즈 차콜',price:1500},{color:'#625B70',name:'모브 잉크',price:1500},{color:'#70695A',name:'브라운 잉크',price:1500},{color:'#3F7663',name:'세이지 잉크',price:1800},
  {color:'#326E72',name:'딥 틸',price:1800},{color:'#46677A',name:'스모키 네이비',price:1800},{color:'#8C596A',name:'더스티 로즈',price:2200},{color:'#735D87',name:'뮤트 퍼플',price:2200},
  {color:'#2E7654',name:'포레스트',price:2500},{color:'#395B70',name:'딥 블루',price:2500},{color:'#8B4F61',name:'딥 로즈',price:2800},{color:'#FFFFFF',name:'화이트',price:3200},
];
const ROOM_MEMBERS: RoomMember[] = [
  {userId:'00000000-0000-4000-8000-000000000001',name:'초록윤',intro:'작은 모임과 편안한 대화를 좋아해요.',owner:true},
  {userId:'00000000-0000-4000-8000-000000000002',name:'한걸음',intro:'퇴근 후 산책과 커피를 좋아해요.',mine:true,coHost:true},
  {userId:'00000000-0000-4000-8000-000000000003',name:'느린준',intro:'천천히 친해지는 중이에요.',coHost:true},
  {userId:'00000000-0000-4000-8000-000000000004',name:'해질녘',intro:'사진과 조용한 대화를 좋아해요.'},
  {userId:'00000000-0000-4000-8000-000000000005',name:'솔바람',intro:'서울 곳곳을 탐색해요.',coHost:true},
  {userId:'00000000-0000-4000-8000-000000000006',name:'새벽빛',intro:'늦은 시간의 영화 이야기를 좋아해요.'},
  {userId:'00000000-0000-4000-8000-000000000007',name:'구름결',intro:'새로운 사람의 이야기를 듣고 싶어요.'},
  {userId:'00000000-0000-4000-8000-000000000008',name:'여름밤',intro:'음악과 산책을 함께 나눠요.'},
  {userId:'00000000-0000-4000-8000-000000000009',name:'달그림',intro:'그림과 창작 이야기를 좋아해요.'},
  ...Array.from({length:29},(_,index)=>({
    userId:`00000000-0000-4000-8000-${String(index+10).padStart(12,'0')}`,
    name:`멤버 ${String(index+10).padStart(2,'0')}`,
    intro:'이 방에서 사용하는 소개입니다.',
  })),
];

const ROOM_UPDATED_AT: Record<string,number> = {
  'green-table': Date.now()-72000,
  'weekend-photo': Date.now()-18*60000,
  'suwon-walk': Date.now()-74*60000,
  'late-cinema': Date.now()-3*60*60000,
  'concept-lab': Date.now()-35*60000,
  'midnight-radio': Date.now()-9*24*60*60000,
};

function membersForRoom(room:Room) {
  return Array.from({length:room.memberCount},(_,index)=>ROOM_MEMBERS[index]??{
    userId:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
    name:`멤버 ${String(index+1).padStart(2,'0')}`,
    intro:`${room.name}에서 사용하는 소개입니다.`,
  });
}

function mapRoomMembers(serverMembers: ServerRoomMember[], currentUserId?: string) {
  return serverMembers.map((member) => ({
    userId: member.userId,
    name: member.name,
    intro: member.intro,
    avatarUri: member.avatarUrl,
    owner: member.role === 'owner',
    mine: currentUserId ? member.userId === currentUserId : false,
    coHost: member.role === 'cohost',
  })) satisfies RoomMember[];
}

function formatRoomActivity(updatedAt:number,now:number,joined:boolean) {
  const seconds=Math.max(1,Math.floor((now-updatedAt)/1000));
  if(seconds<60)return `${seconds}초 전`;
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return `${minutes}분 전`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return joined?`${hours}시간 전`:(hours<2?`${hours}시간 전`:'');
  if(!joined)return '';
  const days=Math.floor(hours/24);
  if(days<=7)return `${days}일 전`;
  const date=new Date(updatedAt);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatStoryTime(value:string){
  const timestamp=new Date(value.replace(/\.\s?/g,'-').replace(/-$/,'')).getTime();
  if(!Number.isFinite(timestamp))return value;
  const minutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));
  if(minutes<1)return '방금';
  if(minutes<60)return `${minutes}분 전`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}시간 전`;
  const days=Math.floor(hours/24);
  return days<7?`${days}일 전`:new Date(timestamp).toLocaleDateString('ko-KR');
}

function formatChatClock(value:string){
  const timestamp=new Date(value).getTime();
  if(!Number.isFinite(timestamp))return '지금';
  return new Date(timestamp).toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'});
}

function replyLabel(name:string,myDisplayName:string){
  return name===myDisplayName?'나에게 답장':`${name}님에게 답장`;
}

function mapServerChatMessage(message: ServerRoomMessage, currentUserId?: string): ChatMessage {
  const mine = Boolean(currentUserId && message.userId === currentUserId);
  const replyTo = message.replyToBody
    ? {
        id: message.replyToMessageId ?? `reply-${message.id}`,
        name: message.replyToSenderName ?? '멤버',
        text: message.replyToBody,
      }
    : undefined;
  if (message.kind === 'image') {
    return {
      id: message.id,
      kind: 'image',
      mine,
      name: message.senderName ?? (mine ? '나' : '멤버'),
      avatarUri: message.senderAvatarUrl,
      imageUris: message.imageUris ?? [],
      time: formatChatClock(message.createdAt),
      replyTo,
    };
  }
  if (message.kind === 'secret') {
    return {
      id: message.id,
      kind: 'secret',
      mine,
      name: message.senderName ?? (mine ? '나' : '멤버'),
      avatarUri: message.senderAvatarUrl,
      recipient: message.recipientName ?? '멤버',
      text: message.body,
      time: formatChatClock(message.createdAt),
      replyTo,
    };
  }
  if (message.kind === 'system') {
    const event: Extract<ChatMessage, { kind: 'system' }>['event'] = message.body.includes('하트')
      ? 'heart'
      : message.body.includes('포인트')
        ? 'point'
        : message.body.includes('강퇴')
          ? 'kick'
          : message.body.includes('퇴장')
            ? 'leave'
            : message.body.includes('들어왔')
              ? 'join'
              : 'room';
    return { id: message.id, kind: 'system', event, text: message.body };
  }
  return {
    id: message.id,
    kind: 'text',
    mine,
    name: message.senderName ?? (mine ? '나' : '멤버'),
    avatarUri: message.senderAvatarUrl,
    text: message.body,
    time: formatChatClock(message.createdAt),
    replyTo,
  };
}

function formatTopSpaceRemaining(expiresAt: number | undefined, now: number) {
  if (!expiresAt || expiresAt <= now) return '노출 없음';
  const minutes = Math.max(1, Math.ceil((expiresAt - now) / 60000));
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.ceil(hours / 24)}일 남음`;
}

function isUuid(value:string|undefined){
  return Boolean(value&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function withTimeout<T>(promise:Promise<T>,milliseconds:number,message:string){
  return Promise.race([
    promise,
    new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error(message)),milliseconds)),
  ]);
}

const IOS_BOTTOM_SAFE_PADDING = Platform.OS === 'ios' ? 16 : 0;

async function promptImageSource() {
  return new Promise<'camera'|'gallery'|null>((resolve) => {
    let settled = false;
    const finish = (value:'camera'|'gallery'|null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert('사진 선택', undefined, [
      { text:'사진', onPress:()=>finish('gallery') },
      { text:'카메라', onPress:()=>finish('camera') },
      { text:'취소', style:'cancel', onPress:()=>finish(null) },
    ], { cancelable:true, onDismiss:()=>finish(null) });
  });
}

async function pickSingleImage({
  source,
  aspect = [1, 1],
  quality = 0.82,
}:{
  source:'camera'|'gallery';
  aspect?:[number,number];
  quality?:number;
}) {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes:['images'], allowsEditing:true, aspect, quality })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], allowsEditing:true, aspect, quality });
  if (result.canceled) return null;
  return result.assets[0];
}

function EdgeBackLayer({onBack}:{onBack?:()=>void}) {
  const responder = useMemo(() => !onBack ? null : PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      gestureState.x0 < 28 && gestureState.dx > 10 && Math.abs(gestureState.dy) < 18,
    onPanResponderRelease: (_event, gestureState) => {
      if (gestureState.dx > 70 && Math.abs(gestureState.dy) < 42) onBack();
    },
  }), [onBack]);
  if (!onBack || !responder) return null;
  return <View {...responder.panHandlers} style={s.edgeBackLayer} pointerEvents="box-only" />;
}

export default function App() {
  const demoMode = !isSupabaseConfigured;
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecoveryActive,setPasswordRecoveryActive]=useState(false);
  const [authReady, setAuthReady] = useState(demoMode || !isSupabaseConfigured);
  useEffect(() => {
    if (demoMode || !supabase) return;
    getCurrentSession()
      .then(setSession)
      .catch((error) => Alert.alert('로그인 확인 실패', error.message))
      .finally(() => setAuthReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [demoMode]);
  if (!authReady) return <SplashScreen />;
  if (!demoMode && isSupabaseConfigured && (!session||passwordRecoveryActive)) {
    return <PhoneAuthScreenV2 onRecoveryStateChange={setPasswordRecoveryActive}/>;
  }
  return <AuthenticatedApp session={session} onSignedOut={()=>{setPasswordRecoveryActive(false);setSession(null);}} />;
}

function AuthenticatedApp({session,onSignedOut}:{session:Session|null;onSignedOut:()=>void}) {
  const isSuperAdmin=Boolean(session?.user.app_metadata?.admin_role==='super_admin');
  const [screen, setScreen] = useState<Screen>('main');
  const [bottomTab, setBottomTab] = useState<BottomTab>('myRooms');
  const [category, setCategory] = useState<MainTab>('promotion');
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);
  const [roomData, setRoomData] = useState<Room[]>(rooms);
  const [joinedIds, setJoinedIds] = useState(['green-table', 'weekend-photo']);
  const [ownedRoomIds,setOwnedRoomIds]=useState(['green-table']);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [adminReadOnly,setAdminReadOnly]=useState(false);
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState(1240);
  const [attendanceAvailableAt,setAttendanceAvailableAt]=useState(Date.now());
  const [rewardedAdAvailable,setRewardedAdAvailable]=useState(true);
  const [boosts, setBoosts] = useState<Record<string,number>>({});
  const [promotionTimestamps,setPromotionTimestamps]=useState<Record<string,number>>({});
  const [topSpaceExpiresAt, setTopSpaceExpiresAt] = useState<Record<string,number>>({});
  const [topSpaceDurations,setTopSpaceDurations]=useState<Record<string,number>>({});
  const [now, setNow] = useState(Date.now());
  const [adultVerified, setAdultVerified] = useState(false);
  const [chatInitialPanel,setChatInitialPanel]=useState<ChatPanel>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(()=>{
    if(!isSupabaseConfigured)return;
    getMyWallet().then((wallet)=>{
      setPoints(wallet.pointBalance);
      setAttendanceAvailableAt(new Date(wallet.attendanceAvailableAt).getTime());
      setRewardedAdAvailable(wallet.rewardedAdAvailable);
    }).catch(()=>undefined);
  },[]);
  useEffect(()=>{
    if(!supabase||!isSupabaseConfigured)return;
    const client=supabase;
    const reload=()=>listTopSpaces().then((rows)=>{
      setTopSpaceExpiresAt(Object.fromEntries(rows.map((row)=>[row.room_id,new Date(row.expires_at).getTime()])));
      setTopSpaceDurations(Object.fromEntries(rows.map((row)=>[row.room_id,row.total_duration_seconds*1000])));
      setBoosts(Object.fromEntries(rows.map((row)=>[row.room_id,row.boost_count])));
    }).catch(()=>undefined);
    reload();
    const channel=client.channel('room-top-spaces')
      .on('postgres_changes',{event:'*',schema:'public',table:'room_top_spaces'},reload)
      .subscribe();
    return()=>{client.removeChannel(channel);};
  },[]);
  useEffect(() => {
    registerPushDevice().catch(() => undefined);
  }, []);
  useEffect(()=>{
    if(session?.user.id)configurePurchases(session.user.id).catch(()=>undefined);
  },[session?.user.id]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    Promise.all([listRooms(), listMyActiveRoomIds(), getVerificationStatus()])
      .then(([serverRooms, activeIds, verification]) => {
        const mapped = serverRooms.map(mapServerRoom);
        setRoomData(mapped.length ? mapped : rooms);
        setJoinedIds(activeIds);
        setAdultVerified(verification.adultVerified);
        if (mapped.length) setSelectedRoom(mapped[0]);
      })
      .catch((error) => Alert.alert('방 목록 불러오기 실패', serverErrorMessage(error)));
  }, []);
  useEffect(()=>{
    if(!isSupabaseConfigured)return;
    const timer=setInterval(()=>listMyActiveRoomIds().then(setJoinedIds).catch(()=>undefined),10000);
    return()=>clearInterval(timer);
  },[]);

  const adminReport=async(targetType:'room'|'user',targetId:string,label:string)=>{
    if(!isUuid(targetId)){Alert.alert('신고 불가','서버에 생성된 대상만 신고할 수 있습니다.');return;}
    try{
      await submitReport({targetType,targetId,reason:'other',detail:`관리자 신고: ${label}`});
      Alert.alert('신고 접수 완료','대상 ID가 운영 신고 큐에 저장되었습니다.');
    }catch(error){Alert.alert('신고 실패',serverErrorMessage(error));}
  };
  const openRoom = async (room: Room) => {
    setChatInitialPanel(null);
    setSelectedRoom(room);
    setAdminReadOnly(false);
    if(joinedIds.includes(room.id)){setScreen('chat');return;}
    if(isSuperAdmin){
      setAdminReadOnly(true);
      setScreen('detail');
      return;
    }
    setScreen('detail');
  };
  const openRoomDetail=(room:Room)=>{
    setSelectedRoom(room);
    setAdminReadOnly(Boolean(isSuperAdmin&&!joinedIds.includes(room.id)));
    setScreen('detail');
  };
  const openNotification=(notice:Notice)=>{
    if(notice.destination==='promotion'){
      setBottomTab('discover');
      setCategory('promotion');
      setScreen('main');
      return;
    }
    const room=roomData.find((item)=>item.id===notice.roomId);
    if(!room)return;
    setSelectedRoom(room);
    setAdminReadOnly(Boolean(isSuperAdmin&&!joinedIds.includes(room.id)));
    setChatInitialPanel(notice.destination==='applications'?'applications':null);
    setScreen(joinedIds.includes(room.id)?'chat':'detail');
  };
  const topSpaceCount=(room:Room)=>room.topSpaceCount+(boosts[room.id]??0);
  const promoteRoom=(room:Room)=>{
    const current=Date.now();
    const lastPromotedAt=promotionTimestamps[room.id]??0;
    const nextAvailableAt=lastPromotedAt+(15*60*1000);
    if(current<nextAvailableAt){
      return {ok:false as const, remainingMs:nextAvailableAt-current};
    }
    setPromotionTimestamps((value)=>({...value,[room.id]:current}));
    setRoomData((items)=>items.map((item)=>item.id===room.id?{...item,isPromoted:true,updatedAt:current}:item));
    return {ok:true as const, remainingMs:0};
  };
  const boostRoom=async(room:Room,option:TopSpacePackage)=>{
    if(points<option.points)return false;
    const purchasedAt=Date.now();
    if(isSupabaseConfigured&&isUuid(room.id)){
      try{
        const result=await boostTopSpace(room.id,option.points);
        setPoints(result.pointBalance);
        setTopSpaceExpiresAt((value)=>({...value,[room.id]:new Date(result.expiresAt).getTime()}));
        setTopSpaceDurations((value)=>({...value,[room.id]:result.totalDurationSeconds*1000}));
        setBoosts((value)=>({...value,[room.id]:(value[room.id]??0)+1}));
        return true;
      }catch(error){
        if(serverErrorMessage(error).includes('INSUFFICIENT_POINTS'))return false;
        throw error;
      }
    }
    const currentRemaining=Math.max(0,(topSpaceExpiresAt[room.id]??0)-purchasedAt);
    const addedDuration=option.seconds*1000;
    setPoints((value)=>value-option.points);
    setBoosts((value)=>({...value,[room.id]:(value[room.id]??0)+1}));
    setTopSpaceExpiresAt((value)=>({
      ...value,
      [room.id]:purchasedAt+currentRemaining+addedDuration,
    }));
    setTopSpaceDurations((value)=>({...value,[room.id]:currentRemaining+addedDuration}));
    setNow(purchasedAt);
    return true;
  };
  const claimReward=async(type:'attendance'|'rewarded_ad')=>{
    try{
      const ad=await showRewardedAd();
      if(!ad.completed)return;
      if(isSupabaseConfigured){
        const result=await claimPointReward(type,ad.rewardKey);
        setPoints(result.pointBalance);
        if(type==='attendance')setAttendanceAvailableAt(new Date(result.nextAvailableAt).getTime());
        Alert.alert('포인트 지급',`${result.awardedPoints}포인트를 받았습니다.`);
      }else{
        const reward=type==='attendance'?10:5;
        setPoints((value)=>value+reward);
        if(type==='attendance')setAttendanceAvailableAt(Date.now()+60*60*1000);
        Alert.alert('포인트 지급',`${reward}포인트를 받았습니다.`);
      }
    }catch(error){
      const message=serverErrorMessage(error);
      Alert.alert('보상 지급 실패',message.includes('REWARD_COOLDOWN')?'아직 출석 체크 시간이 아닙니다.':message.includes('DAILY_REWARD_LIMIT')?'오늘 받을 수 있는 광고 보상을 모두 받았습니다.':message);
    }
  };
  const effectiveAdminReadOnly=Boolean(adminReadOnly||(isSuperAdmin&&!joinedIds.includes(selectedRoom.id)));
  if (screen === 'search') return <SearchScreen roomData={roomData} query={query} setQuery={setQuery} joinedIds={joinedIds} onBack={() => setScreen('main')} openRoom={openRoom} />;
  if (screen === 'ranking') return <RankingScreen roomData={roomData} onBack={()=>setScreen('main')} openRoom={openRoom} countFor={topSpaceCount}/>;
  if (screen === 'detail') return <RoomDetail room={selectedRoom} joined={joinedIds.includes(selectedRoom.id)} adminReadOnly={effectiveAdminReadOnly} isSuperAdmin={isSuperAdmin} onAdminReportUser={(id,label)=>adminReport('user',id,label)} pending={pendingIds.includes(selectedRoom.id)} onBack={() => setScreen('main')} onApply={() => setScreen('apply')} onEnterChat={()=>setScreen('chat')} />;
  if (screen === 'apply') return <JoinApplication room={selectedRoom} onBack={() => setScreen('detail')} onCompleted={()=>setScreen('detail')} onSubmit={async (name, intro, avatarUploadId) => {
    if (isSupabaseConfigured) {
      await requestRoomJoinWithAvatar(selectedRoom.id, name, intro, avatarUploadId);
    }
    setPendingIds((ids) => [...new Set([...ids, selectedRoom.id])]);
    return `${selectedRoom.name}에 가입 신청을 보냈습니다.`;
  }} />;
  if (screen === 'chat') return <ChatRoom room={selectedRoom} readOnly={effectiveAdminReadOnly} isKnownOwner={ownedRoomIds.includes(selectedRoom.id)} isSuperAdmin={isSuperAdmin} onAdminReportUser={(id,label)=>adminReport('user',id,label)} initialPanel={chatInitialPanel} points={points} topSpaceExpiresAt={topSpaceExpiresAt[selectedRoom.id]} topSpaceRemaining={formatTopSpaceRemaining(topSpaceExpiresAt[selectedRoom.id],now)} onBoost={(option)=>boostRoom(selectedRoom,option)} onPromote={()=>promoteRoom(selectedRoom)} onBack={() => {setChatInitialPanel(null);setScreen('main');}} />;
  if (screen === 'settings') return <Settings adultVerified={adultVerified} isSuperAdmin={isSuperAdmin} onAdultVerification={()=>setScreen('adultVerification')} onBack={() => setScreen('main')} onSignedOut={onSignedOut} />;
  if (screen === 'adultVerification') return <AdultVerificationScreen verified={adultVerified} onBack={()=>setScreen('settings')} onRefresh={async()=>{const status=await getVerificationStatus();setAdultVerified(status.adultVerified);return status.adultVerified;}}/>;
  if (screen === 'create') return <CreateRoom adultVerified={adultVerified} onBack={() => setScreen('main')} onCreated={(room) => {
    setRoomData((items) => [room, ...items]);
    setJoinedIds((ids) => [...new Set([...ids, room.id])]);
    setOwnedRoomIds((ids)=>[...new Set([...ids,room.id])]);
    setSelectedRoom(room);
    setBottomTab('myRooms');
    setScreen('main');
  }} />;
  const activeTopSpaces=roomData
    .filter((room)=>(topSpaceExpiresAt[room.id]??0)>now)
    .sort((a,b)=>(topSpaceExpiresAt[b.id]??0)-(topSpaceExpiresAt[a.id]??0));
  return <MainScreen {...{ bottomTab, setBottomTab, category, setCategory, joinedIds, openRoom, activeTopSpaces, now, roomData, adultVerified, isSuperAdmin, points, attendanceAvailableAt, rewardedAdAvailable, promotionTimestamps }} onAttendance={()=>claimReward('attendance')} onRewardedAd={()=>claimReward('rewarded_ad')} openRoomDetail={openRoomDetail} onAdminReportRoom={(room)=>adminReport('room',room.id,room.name)} topSpaceProgress={(room)=>Math.max(0,Math.min(1,((topSpaceExpiresAt[room.id]??0)-now)/(topSpaceDurations[room.id]||1)))} onNotification={openNotification} onRanking={()=>setScreen('ranking')} onSearch={() => setScreen('search')} onSettings={() => setScreen('settings')} onCreate={() => setScreen('create')} />;
}

function mapServerRoom(room: ServerRoom): Room {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    tags: [room.region ?? (room.category === 'concept' ? '콘셉트' : room.category === 'adult' ? '성인' : 'Member')],
    memberCount: room.member_count ?? 1,
    maxMembers: room.max_members,
    region: room.region ?? undefined,
    category: room.category === 'concept' ? 'concept' : room.category === 'member' ? 'member' : 'general',
    topSpaceCount: 0,
    isAdult: room.category === 'adult',
    isPrivate: room.visibility === 'private',
    isActive: true,
    emoji: '○',
    imageColor: '#E8ECEA',
    coverUri: room.cover_url,
    updatedAt: new Date(room.updated_at).getTime(),
  };
}

function serverErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('RATE_LIMITED')) return '잠시 후 다시 시도해주세요.';
  if (message.includes('ALREADY_MEMBER')) return '이미 참여 중인 방입니다.';
  if (message.includes('ROOM_FULL')) return '방의 최대 인원에 도달했습니다.';
  if (message.includes('ROOM_CREATE_COOLDOWN')) return '방은 1분에 한 번만 만들 수 있습니다.';
  if (message.includes('ROOM_BANNED')) return '이 방에서 재가입이 제한된 계정입니다.';
  if (message.includes('ACCOUNT_REJOIN_COOLDOWN')) return '탈퇴 후 3일 동안 같은 전화번호로 가입할 수 없습니다.';
  if (message.includes('ADMIN_ACCOUNT_DELETION_FORBIDDEN')) return '슈퍼관리자 계정은 탈퇴할 수 없습니다.';
  if (message.includes('INVALID_PIN')) return 'PIN은 숫자 6자리로 입력해주세요.';
  if (message.includes('AUTH_REQUIRED') || message.includes('JWT')) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (message.includes('invalid input syntax for type uuid')) return '이 항목은 아직 데모 데이터입니다. 서버에 생성된 방에서 다시 시도해주세요.';
  return message;
}

function SplashScreen() {
  return <SafeAreaView style={s.authScreen}><LinearGradient colors={['#82B9C1','#5DBB8C']} style={s.authSplash}><MuteLogo variant="white"/></LinearGradient></SafeAreaView>;
}

function PhoneAuthScreen({onRecoveryStateChange}:{onRecoveryStateChange:(active:boolean)=>void}) {
  type AuthMode = 'login' | 'signup' | 'recovery';
  type AuthStep = 'form' | 'otp' | 'newPassword';
  const [mode,setMode]=useState<AuthMode>('login');
  const [step,setStep]=useState<AuthStep>('form');
  const [phone, setPhone] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [password,setPassword]=useState('');
  const [passwordConfirm,setPasswordConfirm]=useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown,setCooldown]=useState(0);
  useEffect(()=>{
    if(cooldown<=0)return;
    const timer=setInterval(()=>setCooldown((value)=>Math.max(0,value-1)),1000);
    return()=>clearInterval(timer);
  },[cooldown]);
  const validPhone=phone.replace(/\D/g,'').length>=10;
  const validPassword=password.length>=8;
  const resetFlow=(nextMode:AuthMode)=>{
    onRecoveryStateChange(false);
    setMode(nextMode);setStep('form');setCode('');setPassword('');setPasswordConfirm('');
  };
  const submitCredentials=async()=>{
    if(!validPhone||!validPassword)return;
    setLoading(true);
    try {
      if(mode==='login'){
        await signInWithPhonePassword(phone,password);
        return;
      }
      const result=await signUpWithPhonePassword(phone,password);
      setNormalizedPhone(result.phone);
      if(!result.session){setStep('otp');setCooldown(60);}
    } catch (error) {
      Alert.alert(mode==='login'?'로그인 실패':'가입 실패',mode==='login'?'전화번호 또는 비밀번호를 확인해주세요.':serverErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const requestRecovery=async()=>{
    if(!validPhone||cooldown>0)return;
    setLoading(true);
    try{setNormalizedPhone(await requestPasswordRecoveryOtp(phone));onRecoveryStateChange(true);setStep('otp');setCooldown(60);}
    catch{Alert.alert('인증번호 전송 실패','입력한 정보를 확인하거나 잠시 후 다시 시도해주세요.');}
    finally{setLoading(false);}
  };
  const resendCode=async()=>{
    if(cooldown>0||loading)return;
    setCode('');
    setLoading(true);
    try{
      if(mode==='signup')await resendPhoneOtp(normalizedPhone);
      else await requestPasswordRecoveryOtp(phone);
      setCooldown(60);
    }catch{Alert.alert('재전송 실패','잠시 후 다시 시도해주세요.');}
    finally{setLoading(false);}
  };
  const verifyCode=async()=>{
    if(code.length!==6)return;
    setLoading(true);
    try{await verifyPhoneOtp(normalizedPhone,code);if(mode==='recovery')setStep('newPassword');}
    catch{Alert.alert('본인인증 실패','인증번호를 확인해주세요.');}
    finally{setLoading(false);}
  };
  const changePassword=async()=>{
    if(!validPassword||password!==passwordConfirm)return;
    setLoading(true);
    try{await updateCurrentUserPassword(password);await signOut();onRecoveryStateChange(false);Alert.alert('변경 완료','새 비밀번호로 로그인해주세요.');}
    catch(error){Alert.alert('비밀번호 변경 실패',serverErrorMessage(error));}
    finally{setLoading(false);}
  };
  const title=mode==='login'?'로그인':mode==='signup'?'전화번호로 가입':'비밀번호 찾기';
  const body=mode==='login'?'전화번호와 비밀번호를 입력해주세요.':mode==='signup'?'가입할 때 한 번만 전화번호를 인증합니다.':'문자 인증 후 새 비밀번호를 설정합니다.';
  if(step==='otp')return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><View style={s.authCard}><MuteLogo/><Text style={s.authTitle}>인증번호 입력</Text><Text style={s.authBody}>문자로 받은 6자리 번호를 입력해주세요.</Text><TextInput autoFocus value={code} onChangeText={(value)=>setCode(value.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" placeholder="000000" placeholderTextColor={colors.textMuted} style={s.authInput}/><Pressable disabled={loading||code.length!==6} onPress={verifyCode} style={[s.primary,(loading||code.length!==6)&&s.disabled]}><Text style={s.primaryText}>{loading?'확인 중...':'인증 완료'}</Text></Pressable><Pressable disabled={cooldown>0||loading} onPress={resendCode} style={s.authBack}><Text style={s.authBackText}>{cooldown>0?`${cooldown}초 후 재전송`:'인증번호 다시 받기'}</Text></Pressable><Pressable onPress={()=>setStep('form')} style={s.authBack}><Text style={s.authBackText}>전화번호 다시 입력</Text></Pressable></View></SafeAreaView>;
  if(step==='newPassword')return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><View style={s.authCard}><MuteLogo/><Text style={s.authTitle}>새 비밀번호 설정</Text><Text style={s.authBody}>8자 이상의 새 비밀번호를 입력해주세요.</Text><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="새 비밀번호" placeholderTextColor={colors.textMuted} style={s.authInput}/><TextInput secureTextEntry value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="새 비밀번호 확인" placeholderTextColor={colors.textMuted} style={s.authInput}/><Pressable disabled={loading||!validPassword||password!==passwordConfirm} onPress={changePassword} style={[s.primary,(loading||!validPassword||password!==passwordConfirm)&&s.disabled]}><Text style={s.primaryText}>{loading?'변경 중...':'비밀번호 변경'}</Text></Pressable></View></SafeAreaView>;
  return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.authCard}><MuteLogo/><Text style={s.authTitle}>{title}</Text><Text style={s.authBody}>{body}</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="010-0000-0000" placeholderTextColor={colors.textMuted} style={s.authInput}/>{mode!=='recovery'&&<TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="비밀번호 8자 이상" placeholderTextColor={colors.textMuted} style={s.authInput}/>}<Pressable disabled={loading||!validPhone||(mode!=='recovery'&&!validPassword)} onPress={mode==='recovery'?requestRecovery:submitCredentials} style={[s.primary,(loading||!validPhone||(mode!=='recovery'&&!validPassword))&&s.disabled]}><Text style={s.primaryText}>{loading?'처리 중...':mode==='login'?'로그인':mode==='signup'?'가입 및 인증':'인증번호 받기'}</Text></Pressable>{mode==='login'?<View><Pressable onPress={()=>resetFlow('recovery')} style={s.authBack}><Text style={s.authBackText}>비밀번호를 잊으셨나요?</Text></Pressable><Pressable onPress={()=>resetFlow('signup')} style={s.authBack}><Text style={s.authBackText}>처음이신가요? 가입하기</Text></Pressable></View>:<Pressable onPress={()=>resetFlow('login')} style={s.authBack}><Text style={s.authBackText}>로그인으로 돌아가기</Text></Pressable>}</KeyboardAvoidingView></SafeAreaView>;
}

function PhoneAuthScreenV2({onRecoveryStateChange}:{onRecoveryStateChange:(active:boolean)=>void}) {
  type AuthMode = 'login' | 'signup' | 'recovery';
  type AuthStep = 'form' | 'otp' | 'newPassword';
  const [mode,setMode]=useState<AuthMode>('login');
  const [step,setStep]=useState<AuthStep>('form');
  const [phone,setPhone]=useState('');
  const [normalizedPhone,setNormalizedPhone]=useState('');
  const [password,setPassword]=useState('');
  const [passwordConfirm,setPasswordConfirm]=useState('');
  const [code,setCode]=useState('');
  const [loading,setLoading]=useState(false);
  const [cooldown,setCooldown]=useState(0);
  const [otpSeconds,setOtpSeconds]=useState(0);
  const [signupOtpRequested,setSignupOtpRequested]=useState(false);
  const [signupPhoneVerified,setSignupPhoneVerified]=useState(false);
  const [signupTemporaryPassword,setSignupTemporaryPassword]=useState('');
  const [signupPhoneNotice,setSignupPhoneNotice]=useState('');
  const [signupOtpStatus,setSignupOtpStatus]=useState<'idle'|'verifying'|'error'|'verified'>('idle');
  const [signupOtpError,setSignupOtpError]=useState('');
  const signupReveal=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(cooldown<=0&&otpSeconds<=0)return;
    const timer=setInterval(()=>{
      setCooldown((value)=>Math.max(0,value-1));
      setOtpSeconds((value)=>Math.max(0,value-1));
    },1000);
    return()=>clearInterval(timer);
  },[cooldown,otpSeconds]);

  const phoneDigits=phone.replace(/\D/g,'').slice(0,11);
  const validPhone=/^010\d{8}$/.test(phoneDigits);
  const validAdminId=/^[a-z][a-z0-9-]{2,31}$/.test(phone.trim().toLowerCase());
  const validLoginIdentifier=validPhone||validAdminId;
  const showPhoneFormatError=phoneDigits.length>0&&!validPhone;
  const validPassword=password.length>=8;
  const passwordsMatch=password===passwordConfirm&&passwordConfirm.length>0;
  const otpExpired=signupOtpRequested&&otpSeconds===0&&!signupPhoneVerified;
  const timerText=`${String(Math.floor(otpSeconds/60)).padStart(2,'0')}:${String(otpSeconds%60).padStart(2,'0')}`;
  const formatPhone=(value:string)=>{
    const digits=value.replace(/\D/g,'').slice(0,11);
    if(digits.length<=3)return digits;
    if(digits.length<=7)return `${digits.slice(0,3)}-${digits.slice(3)}`;
    return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  };
  const changePhone=(value:string)=>{
    setPhone(formatPhone(value));
    setSignupPhoneNotice('');
  };

  const resetFlow=(nextMode:AuthMode)=>{
    onRecoveryStateChange(false);
    setMode(nextMode);
    setStep('form');
    setPhone('');
    setNormalizedPhone('');
    setCode('');
    setPassword('');
    setPasswordConfirm('');
    setCooldown(0);
    setOtpSeconds(0);
    setSignupOtpRequested(false);
    setSignupPhoneVerified(false);
    setSignupTemporaryPassword('');
    setSignupPhoneNotice('');
    setSignupOtpStatus('idle');
    setSignupOtpError('');
    signupReveal.setValue(0);
  };

  const login=async()=>{
    if(!validLoginIdentifier||!validPassword)return;
    setLoading(true);
    try{
      if(validAdminId) await signInWithAdminId(phone,password);
      else await signInWithPhonePassword(phone,password);
    }catch{
      Alert.alert('로그인 실패','전화번호 또는 비밀번호를 확인해주세요.');
    }finally{
      setLoading(false);
    }
  };

  const requestSignupOtp=async()=>{
    if(!validPhone||loading)return;
    const normalized=normalizeKoreanPhoneNumber(phone);
    setNormalizedPhone(normalized);
    setCode('');
    setSignupPhoneVerified(false);
    setSignupPhoneNotice('');
    setSignupOtpStatus('idle');
    setSignupOtpError('');
    setOtpSeconds(300);
    setCooldown(60);
    setSignupOtpRequested(true);
    onRecoveryStateChange(true);
    Animated.timing(signupReveal,{toValue:1,duration:240,useNativeDriver:false}).start();
    setLoading(true);
    try{
      const result=await requestSignUpPhoneOtp(phone);
      if(result.session){
        await signOut();
        throw new Error('전화번호 확인 설정을 점검해주세요.');
      }
      setNormalizedPhone(result.phone);
      setSignupTemporaryPassword(result.temporaryPassword);
    }catch(error){
      const message=serverErrorMessage(error);
      if(/already|registered|exists|duplicate|가입된|존재/i.test(message)){
        setSignupPhoneNotice('이미 가입된 계정입니다.');
        setSignupOtpRequested(false);
        setOtpSeconds(0);
        setCooldown(0);
        onRecoveryStateChange(false);
        signupReveal.setValue(0);
      }else{
        setSignupPhoneNotice('문자가 오지 않으면 60초 후 다시 요청해주세요.');
      }
      return;
      onRecoveryStateChange(false);
      Alert.alert('인증번호 전송 실패',serverErrorMessage(error));
    }finally{
      setLoading(false);
    }
  };

  const requestRecovery=async()=>{
    if(!validPhone||cooldown>0)return;
    setLoading(true);
    try{
      setNormalizedPhone(await requestPasswordRecoveryOtp(phone));
      onRecoveryStateChange(true);
      setStep('otp');
      setOtpSeconds(300);
      setCooldown(60);
    }catch{
      Alert.alert('인증번호 전송 실패','입력한 정보를 확인하거나 잠시 후 다시 시도해주세요.');
    }finally{
      setLoading(false);
    }
  };

  const resendCode=async()=>{
    if(cooldown>0||loading)return;
    setCode('');
    setSignupOtpStatus('idle');
    setSignupOtpError('');
    setSignupPhoneVerified(false);
    setLoading(true);
    try{
      if(mode==='signup'){
        const result=await requestSignUpPhoneOtp(normalizedPhone,signupTemporaryPassword);
        setSignupTemporaryPassword(result.temporaryPassword);
      }
      else await requestPasswordRecoveryOtp(phone);
      setOtpSeconds(300);
      setCooldown(60);
    }catch{
      Alert.alert('재전송 실패','잠시 후 다시 시도해주세요.');
    }finally{
      setLoading(false);
    }
  };

  const verifySignupCode=async()=>{
    if(code.length!==6||otpExpired||signupOtpStatus==='verifying')return;
    setSignupOtpStatus('verifying');
    setSignupOtpError('');
    try{
      const verifiedSession=await verifyPhoneOtp(normalizedPhone,code);
      if(!verifiedSession)throw new Error('인증 세션을 생성하지 못했습니다.');
      setSignupPhoneVerified(true);
      setSignupOtpStatus('verified');
      setOtpSeconds(0);
    }catch(error){
      const message=serverErrorMessage(error);
      console.warn('Signup OTP verification failed', {
        message,
        secondsRemaining: otpSeconds,
      });
      setSignupOtpStatus('error');
      setSignupOtpError(
        otpSeconds<=0
          ? '인증번호가 만료되었습니다. 다시 요청해주세요.'
          : '인증번호가 일치하지 않습니다. 가장 최근에 받은 번호를 확인해주세요.',
      );
    }finally{
      setLoading(false);
    }
  };

  const verifyRecoveryCode=async()=>{
    if(code.length!==6||otpSeconds===0)return;
    setLoading(true);
    try{
      await verifyPhoneOtp(normalizedPhone,code);
      setStep('newPassword');
    }catch{
      Alert.alert('본인인증 실패','인증번호를 확인해주세요.');
    }finally{
      setLoading(false);
    }
  };

  const completeSignup=async()=>{
    if(!signupPhoneVerified||!validPassword||!passwordsMatch)return;
    setLoading(true);
    try{
      await updateCurrentUserPassword(password);
      await signOut();
      resetFlow('login');
      Alert.alert('회원가입 완료','설정한 전화번호와 비밀번호로 로그인해주세요.');
    }catch(error){
      Alert.alert('가입 실패',serverErrorMessage(error));
    }finally{
      setLoading(false);
    }
  };

  const changePassword=async()=>{
    if(!validPassword||!passwordsMatch)return;
    setLoading(true);
    try{
      await updateCurrentUserPassword(password);
      await signOut();
      onRecoveryStateChange(false);
      Alert.alert('변경 완료','새 비밀번호로 로그인해주세요.');
    }catch(error){
      Alert.alert('비밀번호 변경 실패',serverErrorMessage(error));
    }finally{
      setLoading(false);
    }
  };

  if(mode==='recovery'&&step==='otp'){
    return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><View style={s.authCard}><MuteLogo/><Text style={s.authTitle}>인증번호 입력</Text><Text style={s.authBody}>문자로 받은 6자리 번호를 5분 안에 입력해주세요.</Text><View style={s.authPinLine}><TextInput autoFocus value={code} onChangeText={(value)=>setCode(value.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" placeholder="000000" placeholderTextColor={colors.textMuted} style={[s.authInput,s.authPinInput]}/><Text style={s.authTimer}>{timerText}</Text></View><Pressable disabled={loading||code.length!==6||otpSeconds===0} onPress={verifyRecoveryCode} style={[s.primary,(loading||code.length!==6||otpSeconds===0)&&s.disabled]}><Text style={s.primaryText}>{loading?'확인 중...':'인증 완료'}</Text></Pressable><Pressable disabled={cooldown>0||loading} onPress={resendCode} style={s.authBack}><Text style={s.authBackText}>{cooldown>0?`${cooldown}초 후 재전송`:'인증번호 다시 받기'}</Text></Pressable><Pressable onPress={()=>setStep('form')} style={s.authBack}><Text style={s.authBackText}>전화번호 다시 입력</Text></Pressable></View></SafeAreaView>;
  }

  if(mode==='recovery'&&step==='newPassword'){
    return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><View style={s.authCard}><MuteLogo/><Text style={s.authTitle}>새 비밀번호 설정</Text><Text style={s.authBody}>8자 이상의 새 비밀번호를 입력해주세요.</Text><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="새 비밀번호" placeholderTextColor={colors.textMuted} style={s.authInput}/><TextInput secureTextEntry value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="새 비밀번호 확인" placeholderTextColor={colors.textMuted} style={s.authInput}/><Pressable disabled={loading||!validPassword||!passwordsMatch} onPress={changePassword} style={[s.primary,(loading||!validPassword||!passwordsMatch)&&s.disabled]}><Text style={s.primaryText}>{loading?'변경 중...':'비밀번호 변경'}</Text></Pressable></View></SafeAreaView>;
  }

  if(mode==='signup'){
    return (
      <SafeAreaView style={s.authScreen}>
        <StatusBar style="dark"/>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.authScroll}>
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.authCard}>
            <MuteLogo/>
            <Text style={s.authTitle}>전화번호로 가입</Text>
            <Text style={s.authBody}>전화번호를 인증한 뒤 비밀번호를 설정해주세요.</Text>
            <View style={s.authPhoneRow}>
              <TextInput
                editable={!signupOtpRequested&&!signupPhoneVerified}
                value={phone}
                onChangeText={changePhone}
                keyboardType="phone-pad"
                placeholder="010-0000-0000"
                placeholderTextColor={colors.textMuted}
                style={[s.authInput,s.authPhoneInput,(signupOtpRequested||signupPhoneVerified)&&s.authInputVerified]}
              />
              <Pressable
                disabled={loading||!validPhone||signupPhoneVerified||(signupOtpRequested&&cooldown>0)}
                onPress={signupOtpRequested?resendCode:requestSignupOtp}
                style={[s.authVerifyButton,(loading||!validPhone||signupPhoneVerified||(signupOtpRequested&&cooldown>0))&&s.authVerifyButtonDisabled]}
              >
                <Text style={[s.authVerifyText,(loading||!validPhone||signupPhoneVerified||(signupOtpRequested&&cooldown>0))&&s.authVerifyTextDisabled]}>
                  {signupPhoneVerified?'인증완료':signupOtpRequested?(cooldown>0?`${cooldown}초`:'재전송'):'인증하기'}
                </Text>
              </Pressable>
            </View>
            {showPhoneFormatError&&<Text style={s.authInlineNotice}>전화번호 형식이 일치하지 않습니다.</Text>}
            {signupPhoneNotice!==''&&<Text style={s.authInlineNotice}>{signupPhoneNotice}</Text>}
            {signupOtpRequested&&(
              <Animated.View style={[s.authSignupReveal,{opacity:signupReveal,maxHeight:signupReveal.interpolate({inputRange:[0,1],outputRange:[0,340]})}]}>
                <View style={s.authPinHeader}>
                  <Text style={s.authPinLabel}>{signupPhoneVerified?'전화번호 인증이 완료됐어요.':'문자로 받은 6자리 인증번호'}</Text>
                  {!signupPhoneVerified&&<Text style={[s.authTimer,otpExpired&&s.authTimerExpired]}>{otpExpired?'시간 만료':timerText}</Text>}
                </View>
                <View style={s.authPinLine}>
                  <TextInput autoFocus={!signupPhoneVerified} value={code} onChangeText={(value)=>{setCode(value.replace(/\D/g,'').slice(0,6));setSignupOtpStatus('idle');setSignupOtpError('');}} editable={!signupPhoneVerified&&!otpExpired&&signupOtpStatus!=='verifying'} keyboardType="number-pad" placeholder="000000" placeholderTextColor={colors.textMuted} style={[s.authInput,s.authPinInput,signupPhoneVerified&&s.authInputVerified]}/>
                  <Pressable disabled={code.length!==6||otpExpired||signupPhoneVerified||signupOtpStatus==='verifying'} onPress={verifySignupCode} style={[s.authPinButton,(code.length!==6||otpExpired||signupPhoneVerified||signupOtpStatus==='verifying')&&s.authVerifyButtonDisabled]}>
                    {signupOtpStatus==='verifying'
                      ? <View style={s.authVerifying}><ActivityIndicator size="small" color={colors.mint700}/><Text style={s.authVerifyText}>확인 중</Text></View>
                      : <Text style={[s.authVerifyText,(code.length!==6||otpExpired||signupPhoneVerified)&&s.authVerifyTextDisabled]}>{signupPhoneVerified?'인증완료':'확인'}</Text>}
                  </Pressable>
                </View>
                {signupOtpError!==''&&<Text style={s.authOtpError}>{signupOtpError}</Text>}
                {signupPhoneVerified&&(
                  <>
                    <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="비밀번호 8자 이상" placeholderTextColor={colors.textMuted} style={s.authInput}/>
                    <TextInput secureTextEntry value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="비밀번호 다시 입력" placeholderTextColor={colors.textMuted} style={s.authInput}/>
                    <Text style={[s.authPasswordHint,passwordConfirm.length>0&&!passwordsMatch&&s.authPasswordMismatch]}>{passwordConfirm.length===0?'영문, 숫자 등을 조합해 8자 이상 입력해주세요.':passwordsMatch?'비밀번호가 일치합니다.':'비밀번호가 일치하지 않습니다.'}</Text>
                    <Pressable disabled={loading||!validPassword||!passwordsMatch} onPress={completeSignup} style={[s.primary,(loading||!validPassword||!passwordsMatch)&&s.disabled]}>
                      <Text style={s.primaryText}>{loading?'가입 처리 중...':'회원가입 완료하기'}</Text>
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

  if(false&&mode==='signup'){
    return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.authScroll}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.authCard}><MuteLogo/><Text style={s.authTitle}>전화번호로 가입</Text><Text style={s.authBody}>전화번호 인증 후 비밀번호를 설정해주세요.</Text><View style={s.authPhoneRow}><TextInput editable={!signupPhoneVerified} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="010-0000-0000" placeholderTextColor={colors.textMuted} style={[s.authInput,s.authPhoneInput,signupPhoneVerified&&s.authInputVerified]}/><Pressable disabled={loading||!validPhone||signupPhoneVerified||(signupOtpRequested&&cooldown>0)} onPress={signupOtpRequested?resendCode:requestSignupOtp} style={[s.authVerifyButton,(loading||!validPhone||signupPhoneVerified||(signupOtpRequested&&cooldown>0))&&s.authVerifyButtonDisabled]}><Text style={[s.authVerifyText,(loading||!validPhone||signupPhoneVerified||(signupOtpRequested&&cooldown>0))&&s.authVerifyTextDisabled]}>{signupPhoneVerified?'인증완료':signupOtpRequested?(cooldown>0?`${cooldown}초`:'재전송'):'인증하기'}</Text></Pressable></View>{signupOtpRequested&&<Animated.View style={[s.authSignupReveal,{opacity:signupReveal,maxHeight:signupReveal.interpolate({inputRange:[0,1],outputRange:[0,310]})}]}><View style={s.authPinHeader}><Text style={s.authPinLabel}>{signupPhoneVerified?'전화번호 인증이 완료됐어요.':'문자로 받은 6자리 PIN'}</Text>{!signupPhoneVerified&&<Text style={[s.authTimer,otpExpired&&s.authTimerExpired]}>{otpExpired?'시간 만료':timerText}</Text>}</View>{!signupPhoneVerified&&<View style={s.authPinLine}><TextInput autoFocus value={code} onChangeText={(value)=>setCode(value.replace(/\D/g,'').slice(0,6))} editable={!otpExpired} keyboardType="number-pad" placeholder="000000" placeholderTextColor={colors.textMuted} style={[s.authInput,s.authPinInput]}/><Pressable disabled={loading||code.length!==6||otpExpired} onPress={verifySignupCode} style={[s.authPinButton,(loading||code.length!==6||otpExpired)&&s.authVerifyButtonDisabled]}><Text style={[s.authVerifyText,(loading||code.length!==6||otpExpired)&&s.authVerifyTextDisabled]}>확인</Text></Pressable></View>}{signupPhoneVerified&&<><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="비밀번호 8자 이상" placeholderTextColor={colors.textMuted} style={s.authInput}/><TextInput secureTextEntry value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="비밀번호 다시 입력" placeholderTextColor={colors.textMuted} style={s.authInput}/><Text style={[s.authPasswordHint,passwordConfirm.length>0&&!passwordsMatch&&s.authPasswordMismatch]}>{passwordConfirm.length===0?'영문, 숫자 등을 조합해 8자 이상 입력해주세요.':passwordsMatch?'비밀번호가 일치합니다.':'비밀번호가 일치하지 않습니다.'}</Text><Pressable disabled={loading||!validPassword||!passwordsMatch} onPress={completeSignup} style={[s.primary,(loading||!validPassword||!passwordsMatch)&&s.disabled]}><Text style={s.primaryText}>{loading?'가입 중...':'가입하기'}</Text></Pressable></>}</Animated.View>}<Pressable onPress={()=>resetFlow('login')} style={s.authBack}><Text style={s.authBackText}>로그인으로 돌아가기</Text></Pressable></KeyboardAvoidingView></ScrollView></SafeAreaView>;
  }

  return <SafeAreaView style={s.authScreen}><StatusBar style="dark"/><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.authCard}><MuteLogo symbolOnly/><Text style={s.authTitle}>{mode==='login'?'로그인':'비밀번호 찾기'}</Text><Text style={s.authBody}>{mode==='login'?'전화번호와 비밀번호를 입력해주세요.':'문자 인증 후 새 비밀번호를 설정합니다.'}</Text><TextInput autoCapitalize="none" value={phone} onChangeText={setPhone} keyboardType={mode==='login'?'default':'phone-pad'} placeholder="010-0000-0000" placeholderTextColor={colors.textMuted} style={s.authInput}/>{mode==='login'&&<TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="비밀번호 8자 이상" placeholderTextColor={colors.textMuted} style={s.authInput}/>}<Pressable disabled={loading||(mode==='login'?!validLoginIdentifier:!validPhone)||(mode==='login'&&!validPassword)} onPress={mode==='login'?login:requestRecovery} style={[s.primary,(loading||(mode==='login'?!validLoginIdentifier:!validPhone)||(mode==='login'&&!validPassword))&&s.disabled]}><Text style={s.primaryText}>{loading?'처리 중...':mode==='login'?'로그인':'인증번호 받기'}</Text></Pressable>{mode==='login'?<View><Pressable onPress={()=>resetFlow('recovery')} style={s.authBack}><Text style={s.authBackText}>비밀번호를 잊으셨나요?</Text></Pressable><Pressable onPress={()=>resetFlow('signup')} style={s.authBack}><Text style={s.authBackText}>처음이신가요? 가입하기</Text></Pressable></View>:<Pressable onPress={()=>resetFlow('login')} style={s.authBack}><Text style={s.authBackText}>로그인으로 돌아가기</Text></Pressable>}</KeyboardAvoidingView></SafeAreaView>;
}

function MainScreen({ bottomTab, setBottomTab, category, setCategory, joinedIds, activeTopSpaces, now, roomData, adultVerified, isSuperAdmin, points, attendanceAvailableAt, rewardedAdAvailable, promotionTimestamps, onAttendance, onRewardedAd, topSpaceProgress, openRoom, openRoomDetail, onAdminReportRoom, onNotification, onRanking, onSearch, onSettings, onCreate }: {
  bottomTab: BottomTab; setBottomTab: (v: BottomTab) => void; category: MainTab;
  setCategory: (v: MainTab) => void; joinedIds: string[]; activeTopSpaces: Room[]; now:number; roomData:Room[]; adultVerified:boolean;
  promotionTimestamps:Record<string,number>;
  isSuperAdmin:boolean; onAdminReportRoom:(room:Room)=>void;
  topSpaceProgress: (room:Room)=>number;
  openRoom: (room: Room) => void; openRoomDetail:(room:Room)=>void; onRanking:()=>void; onSearch: () => void;
  onNotification:(notice:Notice)=>void;
  onSettings: () => void; onCreate: () => void;
  points:number;attendanceAvailableAt:number;rewardedAdAvailable:boolean;onAttendance:()=>void;onRewardedAd:()=>void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasUnreadNotifications,setHasUnreadNotifications]=useState(true);
  const [toast,setToast]=useState('');
  const [pinnedRoomIds,setPinnedRoomIds]=useState<string[]>([]);
  const toggleRoomPin=async(room:Room)=>{
    const pinned=!pinnedRoomIds.includes(room.id);
    try{if(isSupabaseConfigured&&isUuid(room.id))await setRoomPinned(room.id,pinned);setPinnedRoomIds((ids)=>pinned?[...ids,room.id]:ids.filter((id)=>id!==room.id));}catch(error){Alert.alert('고정 설정 실패',serverErrorMessage(error));}
  };
  const filtered = useMemo(() => roomData.filter((room) => {
    const tabMatch = bottomTab === 'myRooms' ? joinedIds.includes(room.id)
      : category === 'promotion' ? (adultVerified||isSuperAdmin||!room.isAdult) && (Boolean(promotionTimestamps[room.id]) || room.isPromoted || room.isActive)
        : category === 'member' ? room.category === 'member'
          : category === 'concept' ? room.category === 'concept'
          : category === 'region' ? !!room.region : !!room.isAdult;
    return tabMatch;
  }).sort((a,b)=>{
    if(bottomTab==='myRooms'){
      const aPinned=pinnedRoomIds.includes(a.id); const bPinned=pinnedRoomIds.includes(b.id);
      if(aPinned!==bPinned)return aPinned?-1:1;
      return (b.updatedAt??ROOM_UPDATED_AT[b.id]??0)-(a.updatedAt??ROOM_UPDATED_AT[a.id]??0);
    }
    if(bottomTab==='discover'&&category==='promotion'){
      const aPromotion=promotionTimestamps[a.id]??0;
      const bPromotion=promotionTimestamps[b.id]??0;
      if(aPromotion!==bPromotion)return bPromotion-aPromotion;
    }
    if(bottomTab==='discover')return (b.updatedAt??ROOM_UPDATED_AT[b.id]??0)-(a.updatedAt??ROOM_UPDATED_AT[a.id]??0);
    return 0;
  }), [adultVerified, bottomTab, category, isSuperAdmin, joinedIds, pinnedRoomIds, promotionTimestamps, roomData]);
  const listMode = bottomTab === 'discover' || bottomTab === 'myRooms';
  const topRoom=bottomTab==='discover'
    ? activeTopSpaces.find((room)=>filtered.some((item)=>item.id===room.id))
    : undefined;

  return <SafeAreaView style={s.safe}>
    <StatusBar style="dark" />
    <LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.mainHeader}>
      <View style={s.mainHeaderLogoWrap}><MuteLogo symbolOnly variant="white" compact /></View>
      {bottomTab!=='profile'&&<View style={s.headerActions}>
        <IconButton name="search" color="#FFF" size={19} onPress={onSearch} />
        <Pressable onPress={() => setDrawerOpen(true)} style={s.headerIconButton}>
          <Ionicons name="notifications-outline" size={19} color="#FFF" />
          {hasUnreadNotifications&&<NotificationBadge />}
        </Pressable>
      </View>}
    </LinearGradient>
    {bottomTab === 'discover' && <View style={s.tabs}>{categories.map((item) => <Pressable key={item.key} onPress={() => {if(item.key==='adult'&&!adultVerified&&!isSuperAdmin){setToast('성인 인증 후 이용할 수 있는 탭입니다.');setTimeout(()=>setToast(''),2200);return;}setCategory(item.key);}} style={s.tab}><Text style={[s.tabText, category === item.key && s.tabTextActive]}>{item.label}</Text>{category === item.key && <View style={s.tabIndicator} />}</Pressable>)}</View>}
    {listMode && <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={s.list}
      ListHeaderComponent={bottomTab === 'myRooms'
        ? <View style={s.listHeader}><Text style={s.listTitle}>내 채팅</Text></View>
          : <View>
              <>
                <SectionLabel title="Top" action="랭킹" onAction={onRanking}/>
                {topRoom
                  ? <RoomRow room={topRoom} joined={joinedIds.includes(topRoom.id)} blurAdult={category==='adult'} onPress={() => openRoom(topRoom)} onDescriptionPress={()=>openRoomDetail(topRoom)} topSpaceProgress={topSpaceProgress(topRoom)} activityLabel={formatRoomActivity(topRoom.updatedAt??ROOM_UPDATED_AT[topRoom.id]??now,now,false)} topHighlight />
                  : null}
              </>
              <SectionLabel title="Hot"/>
            </View>}
      renderItem={({ item, index }) => bottomTab === 'discover' && item.id===topRoom?.id ? null : <RoomRow room={item} joined={joinedIds.includes(item.id)} blurAdult={bottomTab==='discover'&&(category==='adult'||(category==='promotion'&&Boolean(item.isAdult)))} pinned={pinnedRoomIds.includes(item.id)} onLongPress={()=>Alert.alert(item.name,undefined,[...(bottomTab==='myRooms'?[{text:pinnedRoomIds.includes(item.id)?'상단 고정 해제':'상단에 고정',onPress:()=>toggleRoomPin(item)}]:[]),...(isSuperAdmin?[{text:'서버로 신고',style:'destructive' as const,onPress:()=>onAdminReportRoom(item)}]:[]),{text:'취소',style:'cancel'}])} onPress={() => openRoom(item)} onDescriptionPress={bottomTab==='discover'?()=>openRoomDetail(item):undefined} unreadCount={bottomTab === 'myRooms' ? (index === 0 ? 12 : 0) : 0} activityLabel={bottomTab==='discover'&&category==='promotion'?'':formatRoomActivity(item.updatedAt??ROOM_UPDATED_AT[item.id]??now,now,bottomTab==='myRooms')} />}
      ListEmptyComponent={<Empty title="표시할 방이 없어요" body="검색어나 카테고리를 변경해 보세요." />}
    />}
    {bottomTab === 'profile' && <Profile points={points} now={now} attendanceAvailableAt={attendanceAvailableAt} rewardedAdAvailable={rewardedAdAvailable} onAttendance={onAttendance} onRewardedAd={onRewardedAd} onRanking={onRanking} onSettings={onSettings} />}
    {bottomTab === 'stories' && <PublicStoryFeed roomData={roomData} joinedIds={joinedIds}/>}
    {(bottomTab === 'discover'||bottomTab === 'myRooms') && <Pressable onPress={onCreate} style={s.fab}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.fabGradient}><Ionicons name="add" size={27} color="#FFF" /></LinearGradient></Pressable>}
    <BottomNav selected={bottomTab} onSelect={setBottomTab} />
    <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onUnreadChange={setHasUnreadNotifications} onNavigate={onNotification} />
    {toast?<View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>:null}
  </SafeAreaView>;
}

function SearchScreen({roomData,query,setQuery,joinedIds,onBack,openRoom}:{roomData:Room[];query:string;setQuery:(value:string)=>void;joinedIds:string[];onBack:()=>void;openRoom:(room:Room)=>void}){
  const normalized=query.trim().toLowerCase();
  const results=useMemo(()=>normalized
    ? roomData.filter((room)=>[room.name,room.description,...room.tags,room.region??''].join(' ').toLowerCase().includes(normalized))
    : [],[normalized,roomData]);
  return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.searchHeader}><IconButton name="chevron-back" color={colors.textSubtle} onPress={onBack}/><View style={s.searchPageBox}><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="방 이름, 설명, 해시태그 검색" placeholderTextColor={colors.textMuted} style={[s.searchInput,Platform.OS==='web'&&({outlineStyle:'none'} as object)]}/>{query.length>0&&<Pressable onPress={()=>setQuery('')}><Ionicons name="close-circle" size={19} color={colors.gray300}/></Pressable>}</View></View><FlatList data={results} keyExtractor={(item)=>item.id} contentContainerStyle={s.searchResults} ListHeaderComponent={normalized?<View style={s.searchResultHead}><Text style={s.searchResultTitle}>{`‘${query.trim()}’ 관련 방`}</Text><Text style={s.searchResultCount}>{results.length}</Text></View>:null} renderItem={({item})=><RoomRow room={item} joined={joinedIds.includes(item.id)} onPress={()=>openRoom(item)}/>} ListEmptyComponent={normalized?<Empty title="관련 방을 찾지 못했어요" body="다른 이름이나 해시태그로 검색해 보세요."/>:null}/></SafeAreaView>;
}

function RankingScreen({roomData,onBack,openRoom,countFor}:{roomData:Room[];onBack:()=>void;openRoom:(room:Room)=>void;countFor:(room:Room)=>number}){
  const ranked=[...roomData].sort((a,b)=>countFor(b)-countFor(a));
  return <SafeAreaView style={s.safe}><StatusBar style="light"/><TopBar title="탑스페이스 랭킹" onBack={onBack}/><FlatList data={ranked} keyExtractor={(item)=>item.id} contentContainerStyle={s.rankingList} ListHeaderComponent={<View style={s.rankingIntro}><Text style={s.rankingIntroTitle}>전체 방 랭킹</Text><Text style={s.rankingIntroText}>멤버들이 탑스페이스를 올린 누적 횟수 기준이에요.</Text></View>} renderItem={({item,index})=><Pressable onPress={()=>openRoom(item)} style={s.rankingRow}><Text style={[s.rankNumber,index<3&&s.rankNumberTop]}>{index+1}</Text><RoomImage room={item} size={54}/><View style={s.rankingBody}><Text style={s.rankingName}>{item.name}</Text><Text numberOfLines={1} style={s.rankingDesc}>{item.description}</Text></View><View style={s.rankingCount}><Ionicons name="rocket" size={14} color={colors.mint700}/><Text style={s.rankingCountText}>{countFor(item)}회</Text></View></Pressable>}/></SafeAreaView>;
}

function RoomRow({ room, joined, blurAdult=false, pinned=false, onLongPress, onPress, onDescriptionPress, unreadCount=0, topSpaceProgress, activityLabel='', topHighlight=false }: { room: Room; joined: boolean; blurAdult?:boolean; pinned?:boolean; onLongPress?:()=>void; onPress: () => void; onDescriptionPress?:()=>void; unreadCount?: number; topSpaceProgress?:number; activityLabel?:string; topHighlight?:boolean }) {
  const isPrivateRoom=Boolean(room.isPrivate||room.tags.includes('비밀방'));
  return <Pressable accessibilityLabel={onLongPress?`${room.name} 채팅방 메뉴`:undefined} onLongPress={onLongPress} delayLongPress={450} onPress={onPress} style={({ pressed }) => [s.roomRow, topHighlight&&s.roomRowTop, pressed && s.pressed]}>
    {topHighlight&&<Text style={s.topInlineLabel}>Top</Text>}
    <RoomImage room={room} size={68} blurAdult={blurAdult} />
    <View style={s.roomInfo}><View style={s.nameLine}>{isPrivateRoom&&<Ionicons name="lock-closed" size={13} color={colors.mint700} style={s.privateRoomLock}/>}<Text numberOfLines={1} style={s.roomName}>{room.name}</Text></View>
      <Text numberOfLines={1} onPress={onDescriptionPress?(event)=>{event.stopPropagation();onDescriptionPress();}:undefined} suppressHighlighting style={s.roomDesc}>{room.description}</Text>
      <View style={s.metaLine}><View style={s.metaGroup}><Ionicons name="people" size={12} color={colors.textMuted} /><Text style={s.meta}>{room.memberCount}/{room.maxMembers}</Text><Text style={s.meta}>#{room.tags[0]}</Text></View>{topSpaceProgress===undefined?(activityLabel?<Text style={s.meta}>{activityLabel}</Text>:null):<View style={s.topSpaceGaugeTrack}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.topSpaceGaugeFill,{width:`${topSpaceProgress*100}%`}]}/></View>}</View>
    </View>{pinned&&<Text style={s.pinnedLabel}>고정</Text>}{joined&&unreadCount>0?<NotificationBadge inline count={unreadCount}/>:null}
  </Pressable>;
}

function RoomDetail({ room, joined, adminReadOnly, isSuperAdmin, onAdminReportUser, pending, onBack, onApply, onEnterChat, enterLabel='채팅방 바로가기' }: { room: Room; joined:boolean; adminReadOnly:boolean; isSuperAdmin:boolean; onAdminReportUser:(id:string,label:string)=>void; pending: boolean; onBack: () => void; onApply: () => void; onEnterChat:()=>void; enterLabel?:string }) {
  const [tab, setTab] = useState<'profile' | 'story'>('profile');
  const [profile,setProfile]=useState<RoomMember|null>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [toast,setToast]=useState('');
  const [pinOpen,setPinOpen]=useState(false);
  const [pin,setPin]=useState('');
  const [pinError,setPinError]=useState('');
  const [pinChecking,setPinChecking]=useState(false);
  const [members,setMembers]=useState<RoomMember[]>(()=>room.id===DEMO_ROOM_ID?membersForRoom(room):[]);
  const [currentUserId,setCurrentUserId]=useState<string|undefined>();
  const isPrivateRoom=Boolean(room.isPrivate || room.tags.includes('비밀방'));

  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>setCurrentUserId(data.user?.id)).catch(()=>undefined);
  },[]);
  useEffect(()=>{
    if(!isSupabaseConfigured||!isUuid(room.id)){
      setMembers(room.id===DEMO_ROOM_ID?membersForRoom(room):[]);
      return;
    }
    listRoomMembers(room.id)
      .then((serverMembers)=>setMembers(mapRoomMembers(serverMembers,currentUserId)))
      .catch(()=>undefined);
  },[currentUserId,room]);

  if(profile)return <MemberProfile member={profile} room={room} onBack={()=>setProfile(null)}/>;

  const onShare=async()=>{setMenuOpen(false);setToast('링크 공유는 아직 준비 중입니다.');setTimeout(()=>setToast(''),1800);};
  const onReport=()=>{setMenuOpen(false);Alert.alert('신고하기','신고 사유 선택 기능은 다음 단계에서 연결됩니다.');};
  const openApply=()=>{if(isPrivateRoom&&!joined&&!adminReadOnly&&!isSuperAdmin){setPinOpen(true);return;}onApply();};
  const verifyJoinPin=async()=>{
    if(pin.length!==6||pinChecking)return;
    setPinChecking(true);
    setPinError('');
    try{
      if(isSupabaseConfigured&&isUuid(room.id)){
        const verified=await verifyRoomPin(room.id,pin);
        if(!verified){setPinError('비밀방 PIN이 일치하지 않습니다.');setPinChecking(false);return;}
      }
      setPin('');
      setPinOpen(false);
      setPinChecking(false);
      onApply();
    }catch(error){
      setPinError(serverErrorMessage(error));
      setPinChecking(false);
    }
  };

  return <SafeAreaView style={s.safe}><EdgeBackLayer onBack={onBack}/><StatusBar style="light" /><TopBar title={room.name} inlineCount={room.memberCount} onBack={onBack} trailing="ellipsis-horizontal" onTrailingPress={()=>setMenuOpen((value)=>!value)} />
    {menuOpen&&<View style={s.sheetLayer}><Pressable accessibilityLabel="방 소개 메뉴 닫기" onPress={()=>setMenuOpen(false)} style={s.sheetDim}/><View style={s.roomDetailMenu}><View style={s.profileActionList}><Pressable onPress={onShare} style={s.profileActionRow}><Text style={s.profileActionText}>링크 공유하기</Text></Pressable><Pressable onPress={onReport} style={s.profileActionRow}><Text style={s.profileActionText}>신고하기</Text></Pressable></View></View></View>}
    {pinOpen&&<View style={s.sheetLayer}><Pressable accessibilityLabel="비밀방 PIN 닫기" onPress={()=>{setPinOpen(false);setPin('');setPinError('');}} style={s.sheetDim}/><View style={s.privatePinSheet}><View style={s.sheetHandle}/><Text style={s.privatePinTitle}>비밀방 PIN 입력</Text><Text style={s.privatePinBody}>가입 신청 전에 비밀방 PIN 6자리를 먼저 확인해주세요.</Text><TextInput autoFocus value={pin} onChangeText={(value)=>{setPin(value.replace(/\D/g,'').slice(0,6));setPinError('');}} keyboardType="number-pad" secureTextEntry placeholder="숫자 6자리" placeholderTextColor={colors.textMuted} style={s.input}/>{pinError!==''&&<Text style={s.pinError}>{pinError}</Text>}<Pressable disabled={pin.length!==6||pinChecking} onPress={verifyJoinPin} style={[s.primary,(pin.length!==6||pinChecking)&&s.disabled]}><Text style={s.primaryText}>{pinChecking?'확인 중...':'확인'}</Text></Pressable></View></View>}
    <View style={s.profileTabs}><Pressable onPress={() => setTab('profile')} style={s.profileTab}><Text style={[s.profileTabText,tab==='profile'&&s.profileTabActive]}>프로필</Text>{tab==='profile'&&<View style={s.profileTabLine}/>}</Pressable><Pressable onPress={() => setTab('story')} style={s.profileTab}><Text style={[s.profileTabText,tab==='story'&&s.profileTabActive]}>스토리</Text>{tab==='story'&&<View style={s.profileTabLine}/>}</Pressable></View>
    {tab==='profile'
      ? <ScrollView contentContainerStyle={s.spaceProfile}>
          <DefaultRoomCover room={room}/>
          <View style={s.coverMeta}><Text style={s.coverMetaText}>2026.06.11.</Text><Text style={s.coverMetaText}>{room.memberCount}/{room.maxMembers}명</Text></View>
          <View style={s.spaceIntro}><Text style={s.spaceTitle}>{room.name}</Text>{room.region&&<View style={s.detailMetaRow}><View style={s.detailMetaItem}><Ionicons name="location-outline" size={15} color={colors.mint700}/><Text style={s.detailMetaText}>{room.region}</Text></View></View>}<Text style={[s.gradientTags,s.roomDetailTags]}>{room.tags.map((tag)=>`#${tag}`).join('  ')}</Text><Text style={s.spaceBody}>{room.description}</Text></View>
          <View style={s.memberSectionHead}><Text style={s.memberSectionTitle}>멤버</Text></View>
          <View style={s.detailMemberGrid}>{members.map((member)=><Pressable key={member.userId??member.name} onPress={()=>setProfile(member)} onLongPress={isSuperAdmin&&member.userId?()=>onAdminReportUser(member.userId!,member.name):undefined} style={s.detailMemberItem}><View style={s.detailMemberAvatar}><Avatar uri={member.avatarUri} size={64}/>{member.owner&&<View style={s.crown}><Ionicons name="trophy" size={13} color="#FFF"/></View>}</View><View style={s.detailMemberNameLine}><Text style={s.gridName}>{member.name}</Text></View>{member.owner?<Badge text="방장" pink/>:member.coHost?<Badge text="부방장"/>:null}</Pressable>)}</View>
        </ScrollView>
      : <StoryPanel room={room} joined={joined} isStaff={members.some((member)=>member.mine&&(member.owner||member.coHost))} showChatButton={false} showInternalHeader={false} onEnterChat={onEnterChat}/>
    }
    {tab==='profile'&&<View style={s.detailSticky}>{(joined||adminReadOnly||isSuperAdmin)?<Pressable onPress={onEnterChat} style={s.detailJoinButton}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.detailJoinGradient}><Text style={s.primaryText}>{enterLabel}</Text></LinearGradient></Pressable>:pending?<View style={s.pendingButton}><Ionicons name="time-outline" size={17} color={colors.textMuted}/><Text style={s.pendingText}>가입 승인 대기 중</Text></View>:<Pressable onPress={openApply} style={s.detailJoinButton}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.detailJoinGradient}><Text style={s.primaryText}>가입 신청하기</Text></LinearGradient></Pressable>}</View>}
    {toast!==''&&<View pointerEvents="none" style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
  </SafeAreaView>;
}

function JoinApplication({ room, onBack, onCompleted, onSubmit }: { room: Room; onBack: () => void; onCompleted:()=>void; onSubmit: (name:string,intro:string,avatarUploadId?:string) => Promise<string> }) {
  const [name,setName]=useState(''); const [intro,setIntro]=useState('');
  const [avatar,setAvatar]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [toast,setToast]=useState('');
  const [submitStatus,setSubmitStatus]=useState('');
  const [submitError,setSubmitError]=useState('');
  const enabled=name.trim().length>0&&intro.trim().length>0;
  const pick=async()=>{
    const source=await promptImageSource();
    if(!source)return;
    const asset=await pickSingleImage({source,aspect:[1,1],quality:.82});
    if(asset)setAvatar(asset);
  };
  const submit=async()=>{
    if(!enabled||submitting)return;
    setSubmitting(true);setSubmitError('');setSubmitStatus(avatar?'프로필 사진을 처리하고 있어요.':'가입 신청을 보내고 있어요.');
    try{
      let uploadId:string|undefined;
      if(avatar&&isSupabaseConfigured){
        const resized=await withTimeout(ImageManipulator.manipulateAsync(avatar.uri,[{resize:{width:720}}],{compress:.8,format:ImageManipulator.SaveFormat.JPEG}),10000,'프로필 사진 처리 시간이 초과되었습니다.');
        const bytes=await withTimeout(fetch(resized.uri).then((response)=>response.arrayBuffer()),10000,'프로필 사진을 읽지 못했습니다.');
        const upload=await withTimeout(uploadValidatedImage({uri:resized.uri,mimeType:'image/jpeg',fileSize:bytes.byteLength,width:720,height:720,purpose:'profile-avatar'}),20000,'프로필 사진 업로드 시간이 초과되었습니다.');
        uploadId=upload.uploadId;
      }
      setSubmitStatus('가입 신청을 보내고 있어요.');
      const message=await withTimeout(onSubmit(name.trim(),intro.trim(),uploadId),15000,'가입 신청 응답 시간이 초과되었습니다.');
      setSubmitting(false);setSubmitStatus('');
      setToast(message);
      setTimeout(onCompleted,1800);
    }catch(error){const message=serverErrorMessage(error);setSubmitting(false);setSubmitStatus('');setSubmitError(message);}
  };
  return <SafeAreaView style={s.safe}><EdgeBackLayer onBack={onBack}/><StatusBar style="light"/><TopBar title={`${room.name} 가입 신청`} onBack={onBack}/><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={s.joinForm}><View style={s.joinProfile}><Pressable accessibilityLabel="프로필 사진 선택" onPress={pick}>{avatar?<Image source={{uri:avatar.uri}} style={s.joinAvatar}/>:<DefaultAvatar size={82}/>}<View style={s.editDot}><Ionicons name="camera" size={13} color="#FFF"/></View></Pressable></View><Field label="이름" value={name} onChange={(v)=>setName(v.slice(0,13))} placeholder="가입할 이름을 입력해주세요."/><Text style={s.counter}>{name.length}/13</Text><Field label="자기 소개" value={intro} onChange={(v)=>setIntro(v.slice(0,60))} placeholder="자기 소개를 입력해주세요." multiline/><Text style={s.counter}>{intro.length}/60</Text>{submitStatus!==''&&<View style={s.joinSubmitStatus}><ActivityIndicator size="small" color={colors.mint700}/><Text style={s.joinSubmitStatusText}>{submitStatus}</Text></View>}{submitError!==''&&<Text style={s.joinSubmitError}>{submitError}</Text>}</ScrollView><View style={s.sticky}><Pressable disabled={!enabled||submitting||toast!==''} onPress={submit} style={[s.primary,(!enabled||submitting||toast!=='')&&s.disabled]}><Text style={s.primaryText}>{submitting?'신청 중...':'가입하고 싶어요'}</Text></Pressable></View></KeyboardAvoidingView>{toast!==''&&<View pointerEvents="none" style={s.joinSuccessToast}><Ionicons name="checkmark-circle" size={18} color="#FFF"/><Text style={s.toastText}>{toast}</Text></View>}</SafeAreaView>;
}

function ChatRoom({ room, readOnly, isKnownOwner, isSuperAdmin, onAdminReportUser, initialPanel=null, points, topSpaceExpiresAt, topSpaceRemaining, onBoost, onPromote, onBack }: { room: Room; readOnly:boolean; isKnownOwner:boolean; isSuperAdmin:boolean; onAdminReportUser:(id:string,label:string)=>void; initialPanel?:ChatPanel; points:number; topSpaceExpiresAt?:number; topSpaceRemaining:string; onBoost:(option:TopSpacePackage)=>Promise<boolean>; onPromote:()=>{ok:true;remainingMs:number}|{ok:false;remainingMs:number}; onBack: () => void }) {
  const [currentUserId,setCurrentUserId]=useState<string|undefined>();
  const [roomMembers,setRoomMembers]=useState<RoomMember[]>(()=>room.id===DEMO_ROOM_ID?membersForRoom(room):[]);
  const myProfile=roomMembers.find((member)=>member.mine)??ROOM_MEMBERS.find((member)=>member.mine);
  const myDisplayName = myProfile?.name ?? '나';
  const [myRole,setMyRole]=useState<'owner'|'cohost'|'member'>(isKnownOwner?'owner':'member');
  const isOwner=myRole==='owner';
  const isStaff=myRole==='owner'||myRole==='cohost';
  const [panel, setPanel] = useState<ChatPanel>(initialPanel);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tool, setTool] = useState<ComposerTool>(null);
  const [bubbleColor, setBubbleColor] = useState<string>('#F5F5F5');
  const [textColor, setTextColor] = useState<string>(colors.text);
  const [chatBackground,setChatBackground]=useState('#FFFFFF');
  const [message, setMessage] = useState('');
  const [secretDraft, setSecretDraft] = useState('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [pointTarget,setPointTarget]=useState<string|null>(null);
  const [pointDraft,setPointDraft]=useState('');
  const [profileMember,setProfileMember]=useState<RoomMember|null>(null);
  const [topSpaceOpen,setTopSpaceOpen]=useState(false);
  const [boostResult,setBoostResult]=useState<'success'|'shortage'|null>(null);
  const [replyTo,setReplyTo]=useState<{id:string;name:string;text:string}|null>(null);
  const [expandedMessages,setExpandedMessages]=useState<string[]>([]);
  const [chatSearchOpen,setChatSearchOpen]=useState(false);
  const [chatSearch,setChatSearch]=useState('');
  const [chatSearchCursor,setChatSearchCursor]=useState(0);
  const chatScrollRef=useRef<ScrollView|null>(null);
  const scrollMetrics=useRef({layoutHeight:0,contentHeight:0,offsetY:0});
  const initialScrollDone=useRef(false);
  const nearBottomRef=useRef(true);
  const messagePositions=useRef<Record<string,number>>({});
  const [newMessagePreview,setNewMessagePreview]=useState('');
  const [pendingJoinRequests,setPendingJoinRequests]=useState<{id:string;name:string}[]>([]);
  const [roomSystemMessages,setRoomSystemMessages]=useState<ChatMessage[]>([]);
  const [storyPanelInitialId,setStoryPanelInitialId]=useState<string|null>(null);
  const [storyPanelInitialWrite,setStoryPanelInitialWrite]=useState(false);
  const [photoViewer,setPhotoViewer]=useState<{uri:string;menuOpen:boolean}|null>(null);
  const [toast,setToast]=useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', kind: 'text', mine: false, name: '초록윤', text: '오늘 저녁 산책할 사람 있나요?', time: '오후 9:21' },
    { id: '2', kind: 'text', mine: false, name: '초록윤', text: '날씨가 좋아서 천천히 걸으면 좋겠어요. 산책 코스는 지난번에 갔던 공원 입구에서 시작해서 강변을 따라 천천히 걷고, 중간에 편의점 앞 벤치에서 잠깐 쉬었다가 돌아오는 방향이면 좋을 것 같아요. 늦게 합류하는 분도 찾기 쉽도록 출발 전에 위치를 한 번 더 공유할게요. 혹시 비가 오면 실내로 바로 바꿀 수 있도록 대체 장소도 같이 정해두면 좋겠습니다. 처음 보는 분들도 부담 없게 이동 속도는 느리게 잡고, 중간에 사진 찍고 쉬는 시간도 넣을게요.', time: '오후 9:22' },
    { id: '3', kind: 'system', event: 'join', text: '한걸음님이 들어왔습니다.' },
    { id: '4', kind: 'text', mine: true, name: myDisplayName, text: '저 좋아요. 8시쯤 어때요?', time: '오후 9:23' },
    { id: '5', kind: 'image', mine: false, name: '느린준', imageUris:[], time: '오후 9:24' },
    { id: '6', kind: 'system', event: 'heart', text: '한걸음님이 느린준님에게 하트를 보냈습니다.' },
    { id: '7', kind: 'secret', mine: false, name: '느린준', recipient: '한걸음', text: '산책 장소는 지난번 카페 앞으로 할까요?', time: '오후 9:25' },
    { id: '8', kind: 'system', event: 'leave', text: '솔바람님이 초록 테이블에서 퇴장했습니다.' },
    { id: '8-kick', kind: 'system', event: 'kick', text: '느린준님이 강퇴되었습니다: 한걸음' },
    { id: '9', kind: 'system', event: 'room', text: '방 설명이 변경되었습니다: 한걸음' },
    { id: '10', kind: 'story', mine: false, name: '해질녘', storyId:'s1', title:'이번 주 산책 후보', preview:'토요일 오후에 걷기 좋은 코스를 몇 군데 정리해봤어요. 같이 보고 의견 남겨주세요.', time:'오후 9:28' },
  ]);
  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>setCurrentUserId(data.user?.id)).catch(()=>undefined);
  },[]);
  useEffect(()=>{
    if(!isSupabaseConfigured||!isUuid(room.id)){
      setRoomMembers(room.id===DEMO_ROOM_ID?membersForRoom(room):[]);
      return;
    }
    listRoomMembers(room.id)
      .then((serverMembers)=>setRoomMembers(mapRoomMembers(serverMembers,currentUserId)))
      .catch(()=>undefined);
  },[currentUserId,room.id,room.memberCount]);
  useEffect(()=>{
    if(!isSupabaseConfigured||!isUuid(room.id)){
      if(room.id!==DEMO_ROOM_ID)setMessages([]);
      return;
    }
    listRoomMessages(room.id)
      .then((serverMessages)=>setMessages(serverMessages.map((item)=>mapServerChatMessage(item,currentUserId))))
      .catch(()=>undefined);
  },[currentUserId,room.id]);
  useEffect(()=>{
    if(!supabase||!isUuid(room.id))return;
    const client=supabase;
    client.auth.getUser().then(({data:userData})=>{
      if(!userData.user)return;
      return client.from('room_memberships').select('role').eq('room_id',room.id).eq('user_id',userData.user.id).eq('status','active').maybeSingle()
        .then(({data})=>{if(data?.role==='owner'||data?.role==='cohost'||data?.role==='member')setMyRole(data.role);});
    });
  },[room.id]);
  useEffect(()=>{
    if(!supabase||!isUuid(room.id)||!isStaff){setPendingJoinRequests([]);return;}
    const client=supabase;
    let active=true;
    const reload=()=>listPendingRoomJoinRequests(room.id).then((rows)=>{
      if(active)setPendingJoinRequests(rows.map((row)=>({id:row.id,name:row.requested_name})));
    }).catch(()=>undefined);
    reload();
    const channel=client.channel(`chat-join-requests-${room.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'room_join_requests',filter:`room_id=eq.${room.id}`},reload)
      .subscribe();
    return()=>{active=false;client.removeChannel(channel);};
  },[isStaff,room.id]);
  useEffect(()=>{
    if(!supabase||!isUuid(room.id)){setRoomSystemMessages([]);return;}
    const client=supabase;
    let active=true;
    const reload=()=>listRecentSystemMessages(room.id).then((rows)=>{
      if(active)setRoomSystemMessages(rows.map((row)=>({id:`server-${row.id}`,kind:'system' as const,event:'room' as const,text:row.body??''})));
    }).catch(()=>undefined);
    reload();
    const channel=client.channel(`chat-system-${room.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`room_id=eq.${room.id}`},(payload)=>{
        if(payload.new.kind==='system')reload();
      })
      .subscribe();
    return()=>{active=false;client.removeChannel(channel);};
  },[room.id]);
  const scrollToLatest=(animated=true)=>{setNewMessagePreview('');requestAnimationFrame(()=>chatScrollRef.current?.scrollToEnd({animated}));};
  const focusComposer=()=>{
    const {layoutHeight,contentHeight,offsetY}=scrollMetrics.current;
    const distanceFromBottom=Math.max(0,contentHeight-layoutHeight-offsetY);
    if(nearBottomRef.current||distanceFromBottom<=layoutHeight*2.4){
      setTimeout(()=>scrollToLatest(false),120);
      setTimeout(()=>scrollToLatest(false),280);
    }
  };
  useEffect(()=>{initialScrollDone.current=false;requestAnimationFrame(()=>setTimeout(()=>scrollToLatest(false),80));},[room.id]);
  const send = async () => { const text = message.trim(); if (!text) return; try{let id=`${Date.now()}`;if(isSupabaseConfigured&&isUuid(room.id))id=await sendTextMessage({roomId:room.id,body:text,replyToMessageId:isUuid(replyTo?.id)?replyTo?.id:undefined});setMessages((v) => [...v, { id, kind: 'text', mine: true, name: myDisplayName, avatarUri:myProfile?.avatarUri, text, time: '지금', replyTo:replyTo??undefined }]);setMessage('');setReplyTo(null);scrollToLatest();}catch(error){Alert.alert('메시지 전송 실패',serverErrorMessage(error));} };
  const sendHeart = () => {
    setMessages((value)=>[...value,{id:`heart-${Date.now()}`,kind:'system',event:'heart',text:`${myDisplayName}님이 ${selectedMember??'느린준'}님에게 하트를 보냈습니다.`}]);
    setTool(null);
  };
  const sendSecret = () => {
    const text=secretDraft.trim();
    if(!text)return;
    setMessages((value)=>[...value,{id:`secret-${Date.now()}`,kind:'secret',mine:true,name:myDisplayName,avatarUri:myProfile?.avatarUri,recipient:selectedMember??'느린준',text,time:'지금'}]);
    setSecretDraft('');
    setTool(null);
  };
  const sendPoint = () => {
    const amount=Number(pointDraft.replace(/[^0-9]/g,''));
    if(!pointTarget)return;
    if(!Number.isFinite(amount)||amount<1){Alert.alert('포인트 보내기','1p 이상 입력해주세요.');return;}
    if(amount>points){Alert.alert('포인트 부족',`현재 보유 포인트는 ${points.toLocaleString()}p입니다.`);return;}
    setMessages((value)=>[...value,{id:`point-${Date.now()}`,kind:'system',event:'point',text:`${myDisplayName}님이 ${pointTarget}님에게 ${amount.toLocaleString()}p를 보냈습니다.`}]);
    setPointTarget(null);
    setPointDraft('');
    scrollToLatest();
  };
  const sendImage = async (source: 'camera' | 'gallery') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection:true, selectionLimit:5, quality:0.9 });
    if (result.canceled) return;
    const selected=result.assets.slice(0,5);
    try {
      const output:string[]=[];
      const uploadIds:string[]=[];
      for(const asset of selected){
        const isGif=asset.mimeType==='image/gif'||asset.uri.toLowerCase().endsWith('.gif');
        if(isGif){
          const response=await fetch(asset.uri);
          const bytes=await response.arrayBuffer();
          if(bytes.byteLength>10*1024*1024){Alert.alert('GIF 용량 초과','GIF는 10MB 이하만 보낼 수 있습니다.');continue;}
          output.push(asset.uri);
          if(isSupabaseConfigured&&isUuid(room.id)){
            const upload=await uploadValidatedImage({
              uri:asset.uri,
              mimeType:'image/gif',
              fileSize:bytes.byteLength,
              width:asset.width??1,
              height:asset.height??1,
              purpose:'chat',
              roomId:room.id,
            });
            uploadIds.push(upload.uploadId);
          }
          continue;
        }
        const width = asset.width ?? 1600;
        const height = asset.height ?? 1600;
        const resize = width >= height ? { width: Math.min(width, 1600) } : { height: Math.min(height, 1600) };
        const optimized = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG });
        output.push(optimized.uri);
        if(isSupabaseConfigured&&isUuid(room.id)){
          const response=await fetch(optimized.uri);
          const bytes=await response.arrayBuffer();
          const scale=Math.min(1,1600/Math.max(width,height));
          const upload=await uploadValidatedImage({
            uri:optimized.uri,
            mimeType:'image/jpeg',
            fileSize:bytes.byteLength,
            width:Math.max(1,Math.round(width*scale)),
            height:Math.max(1,Math.round(height*scale)),
            purpose:'chat',
            roomId:room.id,
          });
          uploadIds.push(upload.uploadId);
        }
      }
      let id=`${Date.now()}`;
      if(uploadIds.length)id=await sendUploadedImages({roomId:room.id,uploadIds,replyToMessageId:isUuid(replyTo?.id)?replyTo?.id:undefined});
      if(output.length){setMessages((value) => [...value, { id, kind: 'image', mine: true, name: myDisplayName, avatarUri:myProfile?.avatarUri, imageUris:output, time: '지금', replyTo:replyTo??undefined }]);scrollToLatest();}
      setReplyTo(null);
      setTool(null);
    } catch(error) {
      Alert.alert('이미지 전송 실패',serverErrorMessage(error));
    }
  };
  const copyMessage=async(text:string)=>{await Clipboard.setStringAsync(text);Alert.alert('복사됨','메시지를 클립보드에 복사했습니다.');};
  const openPromotion=()=>{
    const result=onPromote();
    setTool(null);
    if(result.ok){
      setToast('프로모션에 올렸습니다.');
    }else{
      const minutes=Math.max(1,Math.ceil(result.remainingMs/60000));
      setToast(`${minutes}분 후 다시 시도할 수 있어요.`);
    }
    setTimeout(()=>setToast(''),1800);
  };
  const saveImage=async(uri:string)=>{
    if(!uri)return;
    if(Platform.OS==='web'){Alert.alert('사진 저장','모바일 앱에서 사진함에 저장할 수 있습니다.');return false;}
    const MediaLibrary=await import('expo-media-library');
    const permission=await MediaLibrary.requestPermissionsAsync();
    if(!permission.granted)return false;
    try{
      let localUri=uri;
      if(!uri.startsWith('file://')){
        const manipulated=await ImageManipulator.manipulateAsync(uri,[],{compress:1,format:ImageManipulator.SaveFormat.JPEG});
        localUri=manipulated.uri;
      }
      await MediaLibrary.saveToLibraryAsync(localUri);
      setToast('사진이 저장되었습니다.');
      setTimeout(()=>setToast(''),1800);
      return true;
    }catch(error){
      Alert.alert('저장 실패',serverErrorMessage(error));
      return false;
    }
  };
  const messageActions=(item:Extract<ChatMessage,{kind:'text'|'secret'}>)=>Alert.alert('메시지',undefined,[
    ...(item.kind==='text'?[{text:'답장',onPress:()=>setReplyTo({id:item.id,name:item.name,text:item.text})}]:[]),
    {text:'복사',onPress:()=>copyMessage(item.text)},
    {text:'취소',style:'cancel'},
  ]);
  const combinedMessages=messages;
  const visibleMessages=combinedMessages;
  useEffect(()=>{
    const latest=visibleMessages[visibleMessages.length-1];
    if(!latest||latest.kind==='system'||latest.mine)return;
    if(nearBottomRef.current)scrollToLatest();
    else setNewMessagePreview(latest.kind==='text'?latest.text:latest.kind==='image'?'사진이 도착했습니다.':'비밀 쪽지가 도착했습니다.');
  },[visibleMessages.length]);
  const chatSearchMatches=chatSearch.trim()?combinedMessages.filter((item)=>item.kind==='text'&&item.text.toLowerCase().includes(chatSearch.trim().toLowerCase())).reverse():[];
  const activeSearchMessage=chatSearchMatches[chatSearchCursor];
  useEffect(()=>{setChatSearchCursor(0);},[chatSearch]);
  useEffect(()=>{
    if(!activeSearchMessage)return;
    const y=messagePositions.current[activeSearchMessage.id];
    if(y!==undefined)chatScrollRef.current?.scrollTo({y:Math.max(0,y-100),animated:true});
  },[activeSearchMessage?.id]);
  const moveSearch=(delta:number)=>{
    if(!chatSearchMatches.length)return;
    setChatSearchCursor((value)=>(value+delta+chatSearchMatches.length)%chatSearchMatches.length);
  };
  if(profileMember)return <MemberProfile member={profileMember} room={room} viewerRole={myRole} editable={Boolean(profileMember.mine)} onBack={()=>setProfileMember(null)}/>;
  const addStoryPreview=(story:StoryItem)=>{const preview=story.blocks.filter((block)=>block.type==='text').map((block)=>block.text).join(' ').slice(0,86);setMessages((items)=>[...items,{id:`story-${story.id}-${Date.now()}`,kind:'story',mine:story.mine??true,name:story.author,avatarUri:story.authorAvatarUri,storyId:story.id,title:story.title,preview,time:'지금'}]);};
  if(panel==='overview')return <RoomDetail room={room} joined adminReadOnly={readOnly} isSuperAdmin={isSuperAdmin} onAdminReportUser={onAdminReportUser} pending={false} onBack={()=>setPanel(null)} onApply={()=>setPanel(null)} onEnterChat={()=>setPanel(null)} enterLabel="채팅방으로 돌아가기"/>;
  if(panel==='stories')return <StoryPanel room={room} joined isStaff={isStaff} showChatButton={false} showInternalHeader title="스토리" initialSelectedId={storyPanelInitialId??undefined} initialWrite={storyPanelInitialWrite} onClose={()=>{setStoryPanelInitialId(null);setStoryPanelInitialWrite(false);setPanel(null);}} onEnterChat={()=>{setStoryPanelInitialId(null);setStoryPanelInitialWrite(false);setPanel(null);}} onStorySaved={(story)=>{setStoryPanelInitialWrite(false);addStoryPreview(story);}}/>;
  if (panel) return <SafeAreaView style={s.safe}><StatusBar style="light"/><TopBar title={panel==='applications'?'가입 신청 목록':panel==='members'?'멤버 관리':panel==='blocked'?'차단 멤버 목록':panel==='profile'?'프로필':'방 공개 설정'} onBack={() => setPanel(null)}/>{panel==='applications'?<JoinRequests room={room}/>:panel==='members'?<MemberPanel room={room} isOwner={isOwner} isSuperAdmin={isSuperAdmin} onAdminReportUser={onAdminReportUser} onProfile={setProfileMember}/>:panel==='blocked'?<BlockedMembers room={room}/>:<RoomAccessSettings room={room} onSaved={()=>setPanel(null)}/>}</SafeAreaView>;
  return <SafeAreaView style={s.safe}><EdgeBackLayer onBack={onBack}/><StatusBar style="light" /><TopBar title={`[${room.name}]`} inlineCount={room.memberCount} onBack={onBack} secondaryTrailing="search" onSecondaryTrailingPress={()=>{setChatSearchOpen((value)=>!value);setChatSearch('');}} trailing="menu" onTrailingPress={() => {Keyboard.dismiss();setTool(null);setChatSearchOpen(false);readOnly?setPanel('members'):setDrawerOpen(true);}} />
    {chatSearchOpen&&<View style={s.chatSearchBar}><Ionicons name="search" size={18} color={colors.textMuted}/><TextInput autoFocus value={chatSearch} onChangeText={setChatSearch} placeholder="이 방의 채팅 검색" placeholderTextColor={colors.textMuted} style={s.chatSearchInput}/><Text style={s.chatSearchCount}>{chatSearchMatches.length?`${chatSearchCursor+1}/${chatSearchMatches.length}`:'0건'}</Text><Pressable disabled={!chatSearchMatches.length} onPress={()=>moveSearch(1)} style={s.chatSearchNav}><Ionicons name="chevron-up" size={19} color={chatSearchMatches.length?colors.textSubtle:colors.gray300}/></Pressable><Pressable disabled={!chatSearchMatches.length} onPress={()=>moveSearch(-1)} style={s.chatSearchNav}><Ionicons name="chevron-down" size={19} color={chatSearchMatches.length?colors.textSubtle:colors.gray300}/></Pressable><Pressable onPress={()=>{setChatSearchOpen(false);setChatSearch('');}} style={s.chatSearchNav}><Ionicons name="close" size={20} color={colors.textSubtle}/></Pressable></View>}
    <KeyboardAvoidingView style={[s.flex,{backgroundColor:chatBackground}]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {readOnly&&<View style={s.readOnlyBanner}><Ionicons name="eye-outline" size={15} color={colors.mint700}/><Text style={s.readOnlyText}>관리자 읽기 전용 조회</Text></View>}
      <ScrollView ref={chatScrollRef} style={{backgroundColor:chatBackground}} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets scrollEventThrottle={80} onScroll={(event)=>{const {layoutMeasurement,contentOffset,contentSize}=event.nativeEvent;scrollMetrics.current={layoutHeight:layoutMeasurement.height,contentHeight:contentSize.height,offsetY:contentOffset.y};nearBottomRef.current=contentSize.height-layoutMeasurement.height-contentOffset.y<120;if(nearBottomRef.current&&newMessagePreview)setNewMessagePreview('');}} onContentSizeChange={(width,height)=>{scrollMetrics.current.contentHeight=height;if(!initialScrollDone.current){initialScrollDone.current=true;scrollToLatest(false);}else if(nearBottomRef.current)scrollToLatest();}}><Text style={s.date}>2026년 6월 11일</Text>{isStaff&&pendingJoinRequests.map((request)=><SystemMessage key={`request-${request.id}`} event="join" text={`${request.name}님이 가입 신청을 보냈습니다.`}/>)}{visibleMessages.map((item,index) => {
        const unreadMarker=index===4?<View key={`unread-${item.id}`} style={s.unreadMarker}><View style={s.unreadLine}/><Text style={s.unreadText}>여기까지 읽었어요</Text><View style={s.unreadLine}/></View>:null;
        if(item.kind==='system')return <View key={item.id}>{unreadMarker}<SystemMessage event={item.event} text={item.text}/></View>;
        if(item.kind==='story')return <View key={item.id}>{unreadMarker}<View style={[s.messageRow,s.continuousRow]}><Pressable accessibilityLabel={`${item.name} 프로필 메뉴`} onPress={()=>setSelectedMember(item.name)}><Avatar uri={item.avatarUri} size={46}/></Pressable><View style={s.messageBlock}><Text style={s.sender}>{item.name}</Text><View style={s.bubbleLine}><Pressable onPress={()=>{setStoryPanelInitialWrite(false);setStoryPanelInitialId(item.storyId);setPanel('stories');}} style={[s.bubble,s.otherBubble,s.storyBubble]}><View style={s.storyChatPreviewHead}><Ionicons name="albums-outline" size={16} color={colors.mint700}/><Text style={s.storyChatPreviewLabel}>{item.name}님이 스토리를 올렸습니다.</Text></View><Text numberOfLines={1} style={s.storyChatPreviewTitle}>{item.title}</Text><Text numberOfLines={2} style={s.storyChatPreviewBody}>{item.preview}</Text><Text style={s.storyChatPreviewMore}>바로가기</Text></Pressable><Text numberOfLines={1} style={s.time}>{item.time}</Text></View></View></View></View>;
        const previous=visibleMessages[index-1];
        const continuous=!item.mine&&previous?.kind!=='system'&&!previous?.mine&&previous?.name===item.name;
        const expanded=expandedMessages.includes(item.id);
        const shouldCollapse=item.kind==='text'&&item.text.length>=CHAT_COLLAPSE_CHAR_THRESHOLD;
        return <View key={item.id} onLayout={(event)=>{messagePositions.current[item.id]=event.nativeEvent.layout.y;}}>{unreadMarker}<View style={[s.messageRow,item.mine&&s.mineRow,continuous&&s.continuousRow]}>{!item.mine&&!continuous?<Pressable accessibilityLabel={`${item.name} 프로필 메뉴`} onPress={()=>setSelectedMember(item.name)}><Avatar uri={item.avatarUri} size={46}/></Pressable>:!item.mine?<View style={s.avatarSpacer}/>:null}<View style={s.messageBlock}>{!item.mine&&!continuous&&<Text style={s.sender}>{item.name}</Text>}<View style={s.bubbleLine}>{item.mine&&<Text numberOfLines={1} style={s.time}>{item.time}</Text>}<Pressable onLongPress={()=>item.kind==='image'&&item.imageUris?.[0]?setPhotoViewer({uri:item.imageUris[0],menuOpen:false}):messageActions(item as Extract<ChatMessage,{kind:'text'|'secret'}>)} style={[s.bubble,item.kind==='image'&&s.imageBubble,activeSearchMessage?.id===item.id&&s.searchBubbleActive,item.mine?{backgroundColor:bubbleColor,borderBottomRightRadius:4}:s.otherBubble]}>{item.replyTo&&<View style={s.replyQuote}><Text style={s.replyQuoteName}>{replyLabel(item.replyTo.name,myDisplayName)}</Text><Text numberOfLines={1} style={s.replyQuoteText}>{item.replyTo.text}</Text></View>}{item.kind==='image'?(item.imageUris?.length?<ImageGrid uris={item.imageUris} onSave={saveImage} onPress={(uri)=>setPhotoViewer({uri,menuOpen:false})}/>:<View style={s.imagePlaceholder}><Ionicons name="image-outline" size={30} color={colors.gray300}/></View>):item.kind==='secret'?<View style={s.secretContent}><View style={s.secretLabel}><Ionicons name="lock-closed" size={12} color={colors.pink600}/><Text style={s.secretLabelText}>{item.recipient}님에게만 보이는 쪽지</Text></View><Text style={[s.messageText,item.mine&&{color:textColor}]}>{item.text}</Text></View>:<View><Text numberOfLines={expanded||!shouldCollapse?undefined:CHAT_COLLAPSE_LINE_LIMIT} style={[s.messageText,item.mine&&{color:textColor}]}>{item.text}</Text>{shouldCollapse&&<Pressable onPress={(event)=>{event.stopPropagation?.();setExpandedMessages((ids)=>ids.includes(item.id)?ids.filter((id)=>id!==item.id):[...ids,item.id]);}}><Text style={s.expandMessage}>{expanded?'접기':'전체보기'}</Text></Pressable>}</View>}</Pressable>{!item.mine&&<Text numberOfLines={1} style={s.time}>{item.time}</Text>}</View></View></View></View>;
      })}</ScrollView>
      {newMessagePreview!==''&&<Pressable onPress={()=>scrollToLatest()} style={s.newMessagePreview}><Text numberOfLines={1} style={s.newMessagePreviewText}>{newMessagePreview}</Text><Ionicons name="chevron-down" size={15} color="#FFF"/></Pressable>}
      {!chatSearchOpen&&<>
      {!readOnly&&<ComposerPanel tool={tool} showPromotion={isOwner} onCamera={() => sendImage('camera')} onGallery={() => sendImage('gallery')} onTopSpace={()=>{setTool(null);setTopSpaceOpen(true);}} onPromotion={openPromotion} onNewStory={()=>{setTool(null);setStoryPanelInitialId(null);setStoryPanelInitialWrite(true);setPanel('stories');}} secretDraft={secretDraft} onSecretDraft={setSecretDraft} onSendSecret={sendSecret} bubbleColor={bubbleColor} textColor={textColor} backgroundColor={chatBackground} onBubbleColor={setBubbleColor} onTextColor={setTextColor} onBackgroundColor={setChatBackground}/>}
      {!readOnly&&replyTo&&<View style={s.replyComposer}><View style={s.flex}><Text style={s.replyComposerName}>{replyLabel(replyTo.name,myDisplayName)}</Text><Text numberOfLines={1} style={s.replyComposerText}>{replyTo.text}</Text></View><Pressable onPress={()=>setReplyTo(null)}><Ionicons name="close" size={20} color={colors.textMuted}/></Pressable></View>}
      {!readOnly&&<View style={s.composer}><IconCircle name={tool==='media'?'close':'add'} onPress={() => setTool((value) => value === 'media' ? null : 'media')} /><IconCircle name="brush-outline" active={tool==='style'} onPress={() => setTool((value) => value === 'style' ? null : 'style')} /><TextInput value={message} onFocus={focusComposer} onChangeText={setMessage} onSubmitEditing={send} placeholder="메시지를 입력해주세요." placeholderTextColor={colors.textMuted} style={[s.composerInput,Platform.OS==='web'&&({outlineStyle:'none'} as object)]} /><Pressable disabled={!message.trim()} onPress={send} style={s.send}><LinearGradient colors={message.trim()?['#82B9C1','#5DBB8C']:['#C9D8D5','#BFCAC7']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.sendGradient}><Ionicons name="paper-plane" size={18} color="#FFF" /></LinearGradient></Pressable></View>}
      </>}
    </KeyboardAvoidingView>
    <MemberActionSheet member={selectedMember} readOnly={readOnly} secretOpen={tool==='secret'} onClose={()=>{setSelectedMember(null);if(tool==='secret')setTool(null);}} onHeart={()=>{sendHeart();setSelectedMember(null);}} onPoint={()=>{setPointTarget(selectedMember);setPointDraft('');setSelectedMember(null);}} onSecret={()=>setTool('secret')} onProfile={()=>{const found=roomMembers.find((item)=>item.name===selectedMember)??{name:selectedMember??'멤버',intro:'이 방에서 사용하는 프로필입니다.'};setSelectedMember(null);setProfileMember(found);}} onReport={()=>{const found=roomMembers.find((item)=>item.name===selectedMember);if(isSuperAdmin&&found?.userId)onAdminReportUser(found.userId,found.name);else Alert.alert('신고하기','신고 사유 선택 기능은 다음 단계에서 연결됩니다.');setSelectedMember(null);}} secretDraft={secretDraft} onSecretDraft={setSecretDraft} onSendSecret={()=>{sendSecret();setSelectedMember(null);}}/>
    {pointTarget&&<View style={s.sheetLayer}><Pressable accessibilityLabel="포인트 보내기 닫기" onPress={()=>{setPointTarget(null);setPointDraft('');}} style={s.sheetDim}/><View style={s.pointSendSheet}><View style={s.sheetHandle}/><Text style={s.pointSendTitle}>{pointTarget}님에게 포인트 보내기</Text><Text style={s.pointSendBody}>1p부터 보유 포인트 {points.toLocaleString()}p까지 보낼 수 있어요.</Text><TextInput autoFocus value={pointDraft} onChangeText={(value)=>setPointDraft(value.replace(/[^0-9]/g,''))} keyboardType="number-pad" placeholder="보낼 포인트" placeholderTextColor={colors.textMuted} style={[s.pointSendInput,Platform.OS==='web'&&({outlineStyle:'none'} as object)]}/><View style={s.pointSendActions}><Pressable onPress={()=>{setPointTarget(null);setPointDraft('');}} style={s.pointSendCancel}><Text style={s.pointSendCancelText}>취소</Text></Pressable><Pressable disabled={!pointDraft||Number(pointDraft)<1||Number(pointDraft)>points} onPress={sendPoint} style={[s.pointSendButton,(!pointDraft||Number(pointDraft)<1||Number(pointDraft)>points)&&s.disabled]}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.pointSendGradient}><Text style={s.primaryText}>보내기</Text></LinearGradient></Pressable></View></View></View>}
    {photoViewer&&<View style={s.photoViewer}><Pressable accessibilityLabel="사진 닫기" onPress={()=>setPhotoViewer((current)=>current?.menuOpen?{...current,menuOpen:false}:null)} style={s.photoViewerDim}/><ExpoImage source={{uri:photoViewer.uri}} contentFit="contain" style={s.photoViewerExpandedImage}/><Pressable onPress={()=>setPhotoViewer(null)} style={s.photoViewerCloseLeft}><Ionicons name="close" size={24} color="#FFF"/></Pressable><Pressable onPress={()=>setPhotoViewer((current)=>current?{...current,menuOpen:!current.menuOpen}:current)} style={s.photoViewerMore}><Ionicons name="ellipsis-horizontal" size={24} color="#FFF"/></Pressable>{photoViewer.menuOpen&&<View style={s.photoViewerMenu}><Pressable onPress={async()=>{const saved=await saveImage(photoViewer.uri);if(saved)setPhotoViewer((current)=>current?{...current,menuOpen:false}:current);}} style={s.photoViewerMenuItem}><Text style={s.photoViewerMenuText}>저장하기</Text></Pressable><Pressable onPress={()=>{setPhotoViewer((current)=>current?{...current,menuOpen:false}:current);Alert.alert('신고하기','신고 사유 선택 기능은 다음 단계에서 연결됩니다.');}} style={s.photoViewerMenuItem}><Text style={s.photoViewerMenuText}>신고하기</Text></Pressable></View>}</View>}
    <TopSpaceSheet open={topSpaceOpen} room={room} points={points} expiresAt={topSpaceExpiresAt} remaining={topSpaceRemaining} result={boostResult} onClose={()=>{setTopSpaceOpen(false);setBoostResult(null);}} onBoost={async(option)=>{try{setBoostResult(await onBoost(option)?'success':'shortage');}catch(error){Alert.alert('탑스페이스 실패',serverErrorMessage(error));}}}/>
    <ChatDrawer open={drawerOpen} isOwner={isOwner} isStaff={isStaff} onClose={() => setDrawerOpen(false)} onProfileEdit={()=>{setDrawerOpen(false);setProfileMember(roomMembers.find((member)=>member.mine)??{name:'나',intro:'방에서 사용하는 내 프로필',mine:true});}} onApplications={()=>{setDrawerOpen(false);setPanel('applications');}} onStories={() => {setDrawerOpen(false);setStoryPanelInitialId(null);setStoryPanelInitialWrite(false);setPanel('overview');}} onOpenMembers={() => {setDrawerOpen(false);setPanel('members');}} onBlocked={()=>{setDrawerOpen(false);setPanel('blocked');}} onRoomSettings={()=>{setDrawerOpen(false);setPanel('roomSettings');}} onDelete={()=>Alert.alert('방 삭제하기','방을 정말 삭제하시겠습니까? 모든 내역이 삭제됩니다.',[{text:'취소',style:'cancel'},{text:'삭제하기',style:'destructive'}])} onLeave={()=>Alert.alert('방 나가기','방을 정말 나가시겠습니까? 모든 내역이 삭제됩니다.',[{text:'취소',style:'cancel'},{text:'나가기',style:'destructive'}])} />
    {toast!==''&&<View pointerEvents="none" style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
  </SafeAreaView>;
}

function initialStoryItems(room:Room):StoryItem[]{
  return stories.map((story,index)=>({
    id:story.id,roomId:room.id,roomName:room.name,title:story.title,author:story.author,
    createdAt:index===0?'2026.06.14. 14:20':'2026.06.13. 19:10',
    visibility:index===0?'public':'room',
    blocks:[{id:`${story.id}-text`,type:'text',text:`${story.body}\n\n서로 가능한 시간과 장소를 댓글로 남겨주세요. 의견을 모아 본문에 계속 업데이트하겠습니다.`}],
    comments:index===0?[
      {id:'c1',author:'느린준',body:'저는 토요일 저녁이 좋아요. 장소도 투표했어요!',createdAt:'2분 전'},
      {id:'c2',author:'해질녘',body:'사진도 함께 올려주시면 좋을 것 같아요.',createdAt:'방금'},
    ]:[],
    views:index===0?128:42,
    hearts:index===0?18:5,
    liked:false,
    mine:index===1,
  }));
}

function mapServerStory(story:ServerStory,currentUserId?:string):StoryItem{
  return {
    id:story.id,roomId:story.roomId,roomName:story.roomName,title:story.title,author:story.author,authorAvatarUri:story.authorAvatarUrl,
    createdAt:story.createdAt,visibility:story.visibility,
    views:story.viewCount,hearts:story.heartCount,liked:story.liked,
    blocks:story.blocks.map((block,index)=>block.type==='text'
      ? {id:`${story.id}-text-${index}`,type:'text',text:block.text}
      : {id:`${story.id}-image-${index}`,type:'image',uri:block.uri,storagePath:block.storagePath,mimeType:block.mimeType}),
    comments:story.comments.map((comment)=>({id:comment.id,author:comment.author,authorAvatarUri:comment.authorAvatarUrl,body:comment.body,createdAt:new Date(comment.createdAt).toLocaleString('ko-KR'),mine:comment.authorUserId===currentUserId})),
    mine:story.authorUserId===currentUserId,
  };
}

function StoryPanel({room,joined,isStaff:initialStaff,showChatButton=true,showInternalHeader=false,title='스토리',showLinkedRoom=false,initialSelectedId,initialWrite=false,onClose,onEnterChat,onStorySaved}:{room:Room;joined:boolean;isStaff:boolean;showChatButton?:boolean;showInternalHeader?:boolean;title?:string;showLinkedRoom?:boolean;initialSelectedId?:string;initialWrite?:boolean;onClose?:()=>void;onEnterChat:()=>void;onStorySaved?:(story:StoryItem)=>void}) {
  const [filter,setFilter]=useState<'all'|StoryVisibility>('all');
  const [staff,setStaff]=useState(initialStaff);
  const isStaff=staff;
  const [items,setItems]=useState<StoryItem[]>(()=>room.id===DEMO_ROOM_ID?initialStoryItems(room):[]);
  const [selected,setSelected]=useState<StoryItem|null>(null);
  const [editing,setEditing]=useState<StoryItem|null>(null);
  const [writing,setWriting]=useState(initialWrite);
  const seededSelection=useRef(false);
  const visible=filter==='all'?items:items.filter((item)=>item.visibility===filter);
  useEffect(()=>{
    if(!supabase||!isUuid(room.id)||!joined)return;
    supabase.from('room_memberships').select('role').eq('room_id',room.id).eq('status','active').maybeSingle()
      .then(({data})=>setStaff(data?.role==='owner'||data?.role==='cohost'));
  },[joined,room.id]);
  useEffect(()=>{
    if(!supabase||!isUuid(room.id))return;
    Promise.all([listStories({roomId:room.id}),supabase.auth.getUser()]).then(([serverStories,userResult])=>{
      setItems(serverStories.map((story)=>mapServerStory(story,userResult.data.user?.id)));
    }).catch(()=>undefined);
  },[room.id]);
  useEffect(()=>{
    if(!initialSelectedId||seededSelection.current||selected)return;
    const target=items.find((item)=>item.id===initialSelectedId);
    if(target){setSelected(target);seededSelection.current=true;}
  },[initialSelectedId,items,selected]);
  const saveStory=(story:StoryItem)=>{
    setItems((current)=>current.some((item)=>item.id===story.id)?current.map((item)=>item.id===story.id?story:item):[story,...current]);
    onStorySaved?.(story);
    setSelected(story);setEditing(null);setWriting(false);
  };
  const removeStory=async(story:StoryItem)=>{
    try{if(isSupabaseConfigured&&isUuid(story.id))await deleteStory(story.id);setItems((current)=>current.filter((item)=>item.id!==story.id));setSelected(null);}
    catch(error){Alert.alert('삭제 실패',serverErrorMessage(error));}
  };
  if(writing||editing)return <StoryEditor room={room} initial={editing} embedded={showInternalHeader?false:!showChatButton} onCancel={()=>{setWriting(false);setEditing(null);}} onSave={saveStory}/>;
  if(selected)return showInternalHeader
    ? <SafeAreaView style={s.safe}><StatusBar style="light"/><StoryDetail story={selected} room={room} joined={joined} canModerate={staff} showLinkedRoom={showLinkedRoom} onBack={()=>setSelected(null)} onChange={(story)=>{setSelected(story);setItems((current)=>current.map((item)=>item.id===story.id?story:item));}} onEdit={()=>setEditing(selected)} onDelete={()=>removeStory(selected)}/></SafeAreaView>
    : <StoryDetail story={selected} room={room} joined={joined} canModerate={staff} showLinkedRoom={showLinkedRoom} onBack={()=>setSelected(null)} onChange={(story)=>{setSelected(story);setItems((current)=>current.map((item)=>item.id===story.id?story:item));}} onEdit={()=>setEditing(selected)} onDelete={()=>removeStory(selected)}/>;
  const content=<View style={s.flex}>
    <View style={s.storyVisibility}><Pressable onPress={()=>setFilter('all')} style={[s.visibilityOption,filter==='all'&&s.visibilityOptionActive]}><Ionicons name="apps-outline" size={14} color={filter==='all'?colors.mint700:colors.textMuted}/><Text style={s.visibilityText}>모두 보기</Text></Pressable><Pressable onPress={()=>setFilter('room')} style={[s.visibilityOption,filter==='room'&&s.visibilityOptionActive]}><Ionicons name="people-outline" size={14} color={filter==='room'?colors.mint700:colors.textMuted}/><Text style={s.visibilityText}>방 멤버</Text></Pressable><Pressable onPress={()=>setFilter('public')} style={[s.visibilityOption,filter==='public'&&s.visibilityOptionActive]}><Ionicons name="earth-outline" size={14} color={filter==='public'?colors.mint700:colors.textMuted}/><Text style={s.visibilityText}>전체 공개</Text></Pressable></View>
    <ScrollView contentContainerStyle={[s.panel,{paddingBottom:joined?150:100}]}>{visible.map((story)=>{
      const text=story.blocks.filter((block)=>block.type==='text').map((block)=>block.text).join(' ');
      const latest=story.comments.at(-1);
      return <Pressable key={story.id} onPress={()=>setSelected(story)} style={s.story}><View style={s.storyAuthor}><Avatar uri={story.authorAvatarUri} size={42}/><View style={s.flex}><Text style={s.storyAuthorName}>{story.author}</Text><Text style={s.storyTime}>{story.createdAt} · {story.visibility==='public'?'전체 공개':'방 멤버 공개'}</Text></View></View><Text numberOfLines={2} style={s.storyTitle}>{story.title}</Text><Text numberOfLines={4} ellipsizeMode="tail" style={s.storyBody}>{text}</Text>{latest&&<View style={s.storyComment}><Avatar uri={latest.authorAvatarUri} size={30}/><View style={s.flex}><Text style={s.storyCommentName}>{latest.author}</Text><Text numberOfLines={2} style={s.storyCommentBody}>{latest.body}</Text></View></View>}{story.comments.length>0&&<Text style={s.storyMeta}>댓글 {story.comments.length}개 모두 보기</Text>}</Pressable>;
    })}</ScrollView>
    {joined&&<>{showChatButton&&<Pressable onPress={onEnterChat} style={s.storyChatButton}><Text style={s.primaryText}>채팅방 들어가기</Text></Pressable>}<Pressable accessibilityLabel="스토리 글쓰기" onPress={()=>setWriting(true)} style={[s.storyFab,!showChatButton&&{bottom:22}]}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.fabGradient}><Ionicons name="create-outline" size={22} color="#FFF"/></LinearGradient></Pressable></>}
  </View>;
  if(showInternalHeader)return <SafeAreaView style={s.safe}><StatusBar style="light"/><TopBar title={title} onBack={onClose??onEnterChat}/>{content}</SafeAreaView>;
  return content;
}

function StoryDetail({story,room,joined,canModerate,publicMode=false,showLinkedRoom=false,hideHeader=false,onBack,onChange,onEdit,onDelete}:{story:StoryItem;room?:Room;joined:boolean;canModerate:boolean;publicMode?:boolean;showLinkedRoom?:boolean;hideHeader?:boolean;onBack:()=>void;onChange:(story:StoryItem)=>void;onEdit:()=>void;onDelete:()=>void}){
  const [comment,setComment]=useState('');
  const [menuOpen,setMenuOpen]=useState(false);
  const canDelete=story.mine||canModerate;
  useEffect(()=>{
    if(!publicMode||!isSupabaseConfigured||!isUuid(story.id))return;
    recordStoryView(story.id).then((views)=>onChange({...story,views})).catch(()=>undefined);
  },[publicMode,story.id]);
  const toggleHeart=async()=>{
    try{
      if(isSupabaseConfigured&&isUuid(story.id)){
        const result=await toggleStoryLike(story.id);
        onChange({...story,liked:result.liked,hearts:result.heartCount});
      }else onChange({...story,liked:!story.liked,hearts:Math.max(0,story.hearts+(story.liked?-1:1))});
    }catch(error){Alert.alert('하트 처리 실패',serverErrorMessage(error));}
  };
  const submit=async()=>{
    const body=comment.trim();if(!body||!joined)return;
    try{let id=`comment-${Date.now()}`;if(isSupabaseConfigured&&isUuid(story.id))id=await addStoryComment(story.id,body);onChange({...story,comments:[...story.comments,{id,author:'나',body,createdAt:'방금',mine:true}]});setComment('');}
    catch(error){Alert.alert('댓글 작성 실패',serverErrorMessage(error));}
  };
  const removeComment=async(item:StoryComment)=>{
    try{if(isSupabaseConfigured&&isUuid(item.id))await deleteStoryComment(item.id);onChange({...story,comments:story.comments.filter((commentItem)=>commentItem.id!==item.id)});}
    catch(error){Alert.alert('댓글 삭제 실패',serverErrorMessage(error));}
  };
  const storyMenuActions=[
    ...(canDelete?[{label:'삭제하기',onPress:()=>{setMenuOpen(false);onDelete();}}]:[]),
    {label:'신고하기',onPress:()=>{setMenuOpen(false);Alert.alert('신고하기','신고 사유 선택 기능은 다음 단계에서 연결됩니다.');}},
  ];
  return <View style={s.flex}>
    {!hideHeader&&<LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.storyDetailHeader}>
      <Pressable onPress={onBack} style={s.storyHeaderAction}><Ionicons name="chevron-back" size={22} color="#FFF"/></Pressable>
      <Text style={s.storyDetailHeaderTitle}>스토리</Text>
      <View style={s.storyHeaderRight}>
        <Pressable onPress={()=>setMenuOpen((value)=>!value)} style={s.storyHeaderAction}><Ionicons name="ellipsis-horizontal" size={20} color="#FFF"/></Pressable>
      </View>
    </LinearGradient>}
    {!hideHeader&&menuOpen&&<View style={s.storyMenuLayer}><Pressable accessibilityLabel="스토리 메뉴 닫기" onPress={()=>setMenuOpen(false)} style={s.sheetDim}/><View style={s.storyHeaderMenu}><View style={s.storyHeaderMenuList}>{storyMenuActions.map((item)=><Pressable key={item.label} onPress={item.onPress} style={s.storyHeaderMenuRow}><Text style={s.storyHeaderMenuText}>{item.label}</Text></Pressable>)}</View></View></View>}
    <ScrollView contentContainerStyle={s.storyDetail}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={s.storyDetailTitle}>{story.title}</Text>
      <View style={s.storyAuthor}>
        <Avatar uri={story.authorAvatarUri} size={46}/>
        <View style={s.flex}>
          <Text style={s.storyAuthorName}>{story.author}</Text>
          <Text style={s.storyTime}>{formatStoryTime(story.createdAt)} · 조회 {story.views} · 하트 {story.hearts}</Text>
        </View>
        <Pressable onPress={toggleHeart} style={s.storyInlineHeart}><Ionicons name={story.liked?'heart':'heart-outline'} size={21} color={story.liked?colors.pink600:colors.textSubtle}/></Pressable>
        {showLinkedRoom&&<View style={s.storyLinkedRoomInline}>
          <RoomImage room={room} size={30}/>
          <View style={s.storyLinkedText}>
            <Text style={s.storyLinkedLabel}>연결된 채팅방</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={s.storyLinkedName}>{story.roomName}</Text>
          </View>
        </View>}
      </View>
      {story.blocks.map((block)=>block.type==='text'?<Text key={block.id} style={s.storyDetailText}>{block.text}</Text>:<ExpoImage key={block.id} source={{uri:block.uri}} contentFit="cover" style={s.storyDetailImage}/>)}
      <View style={s.commentSection}>
        <Text style={s.commentCount}>댓글 {story.comments.length}</Text>
        {story.comments.map((item)=><View key={item.id} style={s.storyDetailComment}><Avatar uri={item.authorAvatarUri} size={34}/><View style={s.flex}><View style={s.commentMetaLine}><Text style={s.storyCommentName}>{item.author}</Text><Text style={s.storyCommentTime}>{item.createdAt}</Text></View><Text style={s.storyCommentBody}>{item.body}</Text></View>{(story.mine||item.mine)&&<Pressable accessibilityLabel="댓글 삭제" onPress={()=>removeComment(item)} style={s.commentDelete}><Ionicons name="close" size={16} color={colors.gray300}/></Pressable>}</View>)}
      </View>
    </ScrollView>
    {joined&&<View style={s.commentComposer}><TextInput value={comment} onChangeText={setComment} placeholder="댓글을 입력해주세요." placeholderTextColor={colors.textMuted} style={s.commentInput}/><Pressable disabled={!comment.trim()} onPress={submit} style={[s.commentSend,!comment.trim()&&s.disabled]}><Ionicons name="paper-plane" size={17} color="#FFF"/></Pressable></View>}
  </View>;
}

function StoryEditor({room,initial,embedded=false,onCancel,onSave}:{room:Room;initial:StoryItem|null;embedded?:boolean;onCancel:()=>void;onSave:(story:StoryItem)=>void}){
  const [title,setTitle]=useState(initial?.title??'');
  const [visibility,setVisibility]=useState<StoryVisibility>(initial?.visibility??'room');
  const [blocks,setBlocks]=useState<StoryBlock[]>(initial?.blocks??[{id:'text-1',type:'text',text:''}]);
  const [saving,setSaving]=useState(false);
  const updateText=(id:string,text:string)=>setBlocks((items)=>items.map((item)=>item.id===id&&item.type==='text'?{...item,text}:item));
  const addText=()=>setBlocks((items)=>[...items,{id:`text-${Date.now()}`,type:'text',text:''}]);
  const addImages=async()=>{
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return;
    const remaining=10-blocks.filter((block)=>block.type==='image').length;
    if(remaining<=0){Alert.alert('첨부 제한','사진은 최대 10장까지 첨부할 수 있습니다.');return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:remaining,quality:.85});if(result.canceled)return;
    const next:StoryBlock[]=[];
    for(const asset of result.assets.slice(0,remaining)){
      if(asset.mimeType==='image/gif')continue;
      let uploadId:string|undefined;
      if(isSupabaseConfigured&&isUuid(room.id)){
        const bytes=await (await fetch(asset.uri)).arrayBuffer();
        const uploaded=await uploadValidatedImage({uri:asset.uri,mimeType:(asset.mimeType as 'image/jpeg'|'image/png'|'image/webp')??'image/jpeg',fileSize:bytes.byteLength,width:asset.width??1,height:asset.height??1,purpose:'story',roomId:room.id});
        uploadId=uploaded.uploadId;
      }
      next.push({id:`image-${Date.now()}-${next.length}`,type:'image',uri:asset.uri,uploadId});
    }
    setBlocks((items)=>[...items,...next]);
  };
  const save=async()=>{
    const normalized=blocks.filter((block)=>block.type==='image'||block.text.trim()).map((block)=>block.type==='text'?{...block,text:block.text.trim()}:block);
    const normalizedTitle=title.trim();
    if(!normalizedTitle||!normalized.some((block)=>block.type==='text'))return;
    setSaving(true);
    try{
      const payload:StoryBlockInput[]=normalized.map((block)=>block.type==='text'?{type:'text',text:block.text}:{type:'image',uploadId:block.uploadId,storagePath:block.storagePath,mimeType:block.mimeType,uri:block.uri});
      let id=initial?.id??`story-${Date.now()}`;
      if(isSupabaseConfigured&&isUuid(room.id)){
        if(initial&&isUuid(initial.id))await updateStoryContent(initial.id,normalizedTitle,payload);
        else id=await createStoryWithBlocks({roomId:room.id,visibility,title:normalizedTitle,blocks:payload});
      }
      onSave({id,roomId:room.id,roomName:room.name,title:normalizedTitle,author:initial?.author??'나',createdAt:initial?.createdAt??new Date().toISOString(),visibility,blocks:normalized,comments:initial?.comments??[],views:initial?.views??0,hearts:initial?.hearts??0,liked:initial?.liked??false,mine:true});
    }catch(error){Alert.alert('스토리 저장 실패',serverErrorMessage(error));}finally{setSaving(false);}
  };
  const hasBody=blocks.some((block)=>block.type==='text'&&Boolean(block.text.trim()));
  const content=<><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.storyEditor}><TextInput value={title} onChangeText={(value)=>setTitle(value.slice(0,45))} placeholder="제목" placeholderTextColor={colors.textMuted} style={s.storyTitleInput}/><View style={s.storyAuthor}><DefaultAvatar size={44}/><View><Text style={s.storyAuthorName}>나</Text><Text style={s.storyTime}>{room.name} 프로필</Text></View></View><View style={s.storyEditorVisibility}><Pressable onPress={()=>setVisibility('room')} style={[s.visibilityOption,visibility==='room'&&s.visibilityOptionActive]}><Text style={s.visibilityText}>방 멤버</Text></Pressable><Pressable onPress={()=>setVisibility('public')} style={[s.visibilityOption,visibility==='public'&&s.visibilityOptionActive]}><Text style={s.visibilityText}>전체 공개</Text></Pressable></View>{blocks.map((block)=>block.type==='text'?<TextInput key={block.id} value={block.text} onChangeText={(text)=>updateText(block.id,text)} multiline placeholder="본문을 입력하세요." placeholderTextColor={colors.textMuted} style={s.storyBlockInput}/>:<View key={block.id} style={s.storyEditorImageWrap}><ExpoImage source={{uri:block.uri}} contentFit="cover" style={s.storyEditorImage}/><Pressable onPress={()=>setBlocks((items)=>items.filter((item)=>item.id!==block.id))} style={s.storyImageRemove}><Ionicons name="close" size={17} color="#FFF"/></Pressable></View>)}<View style={s.storyEditorToolbar}><Pressable onPress={addImages} style={s.storyToolbarButton}><Ionicons name="images-outline" size={21} color={colors.textSubtle}/></Pressable><Pressable onPress={addText} style={s.storyToolbarButton}><Ionicons name="text-outline" size={21} color={colors.textSubtle}/></Pressable><View style={s.flex}/><Pressable onPress={onCancel} style={s.storyEditorCancel}><Text style={s.storyEditorCancelText}>취소</Text></Pressable><Pressable disabled={saving||!title.trim()||!hasBody} onPress={save} style={[s.storyEditorSubmit,(saving||!title.trim()||!hasBody)&&s.disabled]}><Text style={s.primaryText}>{saving?'저장 중...':'게시'}</Text></Pressable></View></ScrollView></>;
  return embedded?<View style={s.safe}>{content}</View>:<SafeAreaView style={s.safe}><TopBar title={initial?'스토리 편집':'스토리 작성'} onBack={onCancel}/>{content}</SafeAreaView>;
}

function PublicStoryFeed({roomData,joinedIds}:{roomData:Room[];joinedIds:string[]}){
  const room=rooms[0];
  const [sort,setSort]=useState<'random'|'views'|'hearts'|'latest'>('latest');
  const [selected,setSelected]=useState<StoryItem|null>(null);
  const [publicStories,setPublicStories]=useState<StoryItem[]>(()=>initialStoryItems(room).filter((item)=>item.visibility==='public'));
  useEffect(()=>{
    if(!supabase)return;
    Promise.all([listStories({publicOnly:true}),supabase.auth.getUser()]).then(([serverStories,userResult])=>{
      if(serverStories.length)setPublicStories(serverStories.map((story)=>mapServerStory(story,userResult.data.user?.id)));
    }).catch(()=>undefined);
  },[]);
  const sortedStories=useMemo(()=>{
    const result=[...publicStories];
    if(sort==='views')return result.sort((a,b)=>b.views-a.views);
    if(sort==='hearts')return result.sort((a,b)=>b.hearts-a.hearts);
    if(sort==='latest')return result.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
    return result.sort((a,b)=>a.id.localeCompare(b.id));
  },[publicStories,sort]);
  if(selected){
    const linkedRoom=roomData.find((item)=>item.id===selected.roomId);
    return <StoryDetail story={selected} room={linkedRoom} publicMode showLinkedRoom joined={joinedIds.includes(selected.roomId)} canModerate={false} onBack={()=>setSelected(null)} onChange={(story)=>{setSelected(story);setPublicStories((items)=>items.map((item)=>item.id===story.id?story:item));}} onEdit={()=>undefined} onDelete={()=>undefined}/>;
  }
  return <FlatList
    data={sortedStories}
    keyExtractor={(item)=>item.id}
    contentContainerStyle={s.publicStoryList}
    ListHeaderComponent={<View style={s.publicStoryHeader}><Text style={s.publicStoryHeaderText}>공개 스토리</Text><View style={s.storySortRow}>{([['random','랜덤'],['views','조회순'],['hearts','하트순'],['latest','최신순']] as const).map(([value,label])=><Pressable key={value} onPress={()=>setSort(value)}><Text style={[s.storySortText,sort===value&&s.storySortTextActive]}>{label}</Text></Pressable>)}</View></View>}
    renderItem={({item})=>{
      const body=item.blocks.filter((block)=>block.type==='text').map((block)=>block.text).join(' ');
      const thumbnail=item.blocks.find((block):block is Extract<StoryBlock,{type:'image'}>=>block.type==='image');
      return <Pressable onPress={()=>setSelected(item)} style={({pressed})=>[s.publicStoryCard,pressed&&s.publicStoryPressed]}>
        <View style={s.publicStoryMain}>
          <View style={s.publicStoryCopy}>
            <Text numberOfLines={2} style={s.publicStoryTitle}>{item.title}</Text>
            <Text numberOfLines={3} ellipsizeMode="tail" style={s.publicStoryBody}>{body}</Text>
            <View style={s.publicStoryStats}><Text style={s.publicStoryMeta}>{formatStoryTime(item.createdAt)}</Text><Text style={s.publicStoryStat}>조회 {item.views}</Text><Ionicons name="heart" size={12} color={colors.pink600}/><Text style={s.publicStoryStat}>{item.hearts}</Text></View>
          </View>
          {thumbnail&&<ExpoImage source={{uri:thumbnail.uri}} contentFit="cover" style={s.publicStoryThumbnail}/>}
        </View>
      </Pressable>;
    }}
  />;
}

function RoomAccessSettings({room,onSaved}:{room:Room;onSaved:()=>void}){
  const [visibility,setVisibility]=useState<'public'|'private'>('public');
  const [pin,setPin]=useState('');
  const [saving,setSaving]=useState(false);
  const invalidPin=visibility==='private'&&pin.length!==6;
  const save=async()=>{setSaving(true);try{if(isSupabaseConfigured&&isUuid(room.id))await configureRoomAccess({roomId:room.id,visibility,pin});onSaved();}catch(error){setSaving(false);Alert.alert('저장 실패',serverErrorMessage(error));}};
  return <ScrollView contentContainerStyle={s.accessSettings}><Text style={s.accessTitle}>방 노출 범위</Text><Text style={s.accessBody}>비밀방은 홈과 검색에 표시되지 않습니다. 가입 신청 전 PIN 6자리 확인이 필요합니다.</Text><View style={s.visibilityRows}><Pressable onPress={()=>{setVisibility('public');setPin('');}} style={[s.visibilityCard,visibility==='public'&&s.visibilityCardActive]}><Ionicons name="earth-outline" size={21} color={colors.mint700}/><View><Text style={s.visibilityCardTitle}>공개방</Text><Text style={s.visibilityCardText}>홈과 검색에 표시</Text></View></Pressable><Pressable onPress={()=>setVisibility('private')} style={[s.visibilityCard,visibility==='private'&&s.visibilityCardActive]}><Ionicons name="lock-closed-outline" size={21} color={colors.mint700}/><View><Text style={s.visibilityCardTitle}>비밀방</Text><Text style={s.visibilityCardText}>PIN 6자리 필수</Text></View></Pressable></View>{visibility==='private'&&<View style={s.field}><Text style={s.fieldLabel}>PIN 비밀번호</Text><TextInput value={pin} onChangeText={(value)=>setPin(value.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" secureTextEntry placeholder="숫자 6자리" placeholderTextColor={colors.textMuted} style={s.input}/>{invalidPin&&<Text style={s.pinError}>비밀방은 PIN 6자리를 반드시 설정해야 합니다.</Text>}</View>}<Pressable disabled={saving||invalidPin} onPress={save} style={[s.accessSave,(saving||invalidPin)&&s.disabled]}><LinearGradient colors={saving||invalidPin?['#C9D8D5','#BFCAC7']:['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.accessSaveGradient}><Text style={s.primaryText}>{saving?'저장 중...':'설정 저장'}</Text></LinearGradient></Pressable></ScrollView>;
}

function MemberPanel({room,isOwner,isSuperAdmin,onAdminReportUser,onProfile}:{room:Room;isOwner:boolean;isSuperAdmin:boolean;onAdminReportUser:(id:string,label:string)=>void;onProfile:(member:RoomMember)=>void}) {
  const [members,setMembers]=useState<RoomMember[]>([
    {userId:'00000000-0000-4000-8000-000000000002',name:'한걸음',intro:'방에서 사용하는 내 소개입니다.',mine:true},
    {userId:'00000000-0000-4000-8000-000000000001',name:'초록윤',intro:'작은 모임과 편안한 대화를 좋아해요.',owner:true},
    {userId:'00000000-0000-4000-8000-000000000003',name:'느린준',intro:'천천히 친해지는 중',coHost:true},
    {userId:'00000000-0000-4000-8000-000000000004',name:'해질녘',intro:'퇴근 후 산책과 커피'},
    {userId:'00000000-0000-4000-8000-000000000005',name:'솔바람',intro:'서울 곳곳을 탐색해요',coHost:true},
  ]);
  const [editing,setEditing]=useState<string|null>(null);
  const selected=members.find((member)=>member.name===editing);
  const toggle=async()=>{if(!selected?.userId)return;try{if(isSupabaseConfigured&&isUuid(room.id)&&isUuid(selected.userId))await setRoomMemberRole(room.id,selected.userId,selected.coHost?'member':'cohost');setMembers((value)=>value.map((member)=>member.name!==editing?member:{...member,coHost:!member.coHost}));setEditing(null);}catch(error){Alert.alert('권한 변경 실패',serverErrorMessage(error));}};
  const transfer=()=>{if(!selected?.userId)return;const targetUserId=selected.userId;Alert.alert('방장 권한 위임',`${selected.name}님에게 방장을 넘기시겠습니까?`,[{text:'취소',style:'cancel'},{text:'위임하기',style:'destructive',onPress:async()=>{try{if(isSupabaseConfigured&&isUuid(room.id)&&isUuid(targetUserId))await transferRoomOwnership(room.id,targetUserId);setMembers((items)=>items.map((item)=>item.userId===targetUserId?{...item,owner:true,coHost:false}:item.mine?{...item,owner:false,coHost:true}:item));setEditing(null);}catch(error){Alert.alert('방장 위임 실패',serverErrorMessage(error));}}}])};
  const remove=async(ban:boolean)=>{if(!selected?.userId)return;try{if(isSupabaseConfigured&&isUuid(room.id)&&isUuid(selected.userId))await kickOrBanRoomMember({roomId:room.id,userId:selected.userId,ban});setMembers((items)=>items.filter((item)=>item.userId!==selected.userId));setEditing(null);}catch(error){Alert.alert('멤버 내보내기 실패',serverErrorMessage(error));}};
  return <View style={s.flex}><ScrollView contentContainerStyle={s.memberPanel}><Text style={s.memberLabel}>멤버 {members.length}명</Text>{members.map((member)=><MemberCard key={member.userId??member.name} {...member} onPress={()=>onProfile(member)} onLongPress={isOwner&&!member.owner?()=>setEditing(member.name):isSuperAdmin&&member.userId?()=>onAdminReportUser(member.userId!,member.name):undefined}/>)}</ScrollView>{isOwner&&<CoHostSheet member={selected} onClose={()=>setEditing(null)} onToggle={toggle} onTransfer={transfer} onKick={()=>remove(false)} onBan={()=>remove(true)}/>}</View>;
}

function MemberCard({name,intro,owner,mine,coHost,onPress,onLongPress,onManage}:{name:string;intro:string;owner?:boolean;mine?:boolean;coHost?:boolean;onPress:()=>void;onLongPress?:()=>void;onManage?:()=>void}){
  return <Pressable onPress={onPress} onLongPress={onLongPress} style={({pressed})=>[s.memberCard,pressed&&s.pressed]}><DefaultAvatar size={50}/><View style={s.memberCardBody}><View style={s.memberTitleLine}><Text style={s.memberName}>{name}</Text>{mine&&<Badge text="나"/>}{owner&&<Badge text="방장" pink/>}{coHost&&<Badge text="부방장"/>}</View><Text style={s.memberIntro}>{intro}</Text></View>{onManage&&<Pressable accessibilityLabel={`${name} 관리`} onPress={onManage} style={s.memberManage}><Ionicons name="ellipsis-horizontal" size={19} color={colors.textMuted}/></Pressable>}</Pressable>;
}

function MemberProfile({member,room,viewerRole=null,editable=false,onBack}:{member:RoomMember;room:Room;viewerRole?:'owner'|'cohost'|'member'|null;editable?:boolean;onBack:()=>void}){
  const [photoOpen,setPhotoOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [name,setName]=useState(member.name);
  const [intro,setIntro]=useState(member.intro);
  const [avatar,setAvatar]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const pick=async()=>{if(!editable){setPhotoOpen(true);return;}const source=await promptImageSource();if(!source)return;const asset=await pickSingleImage({source,aspect:[1,1],quality:.82});if(asset)setAvatar(asset);};
  const save=()=>Alert.alert('프로필 저장','방별 프로필 저장 API는 다음 단계에서 연결됩니다.');
  const canShowMenu=!editable&&!member.mine&&Boolean(viewerRole);
  const actions=viewerRole==='owner'
    ? [
        member.coHost?'부방장 해제하기':'부방장 설정하기',
        '방장 양도하기',
        '채팅 금지',
        '강퇴하기',
        '신고하기',
      ]
    : viewerRole==='cohost'
      ? ['채팅 금지','강퇴하기','신고하기']
      : ['신고하기'];
  const selectAction=(label:string)=>{setMenuOpen(false);Alert.alert(label,'세부 처리 로직은 다음 단계에서 연결합니다.');};
  return <SafeAreaView style={s.safe}><EdgeBackLayer onBack={onBack}/><ProfileCaptureGuard/><StatusBar style="light"/><TopBar title={editable?'프로필 수정':'프로필'} onBack={onBack} trailing={canShowMenu?'ellipsis-horizontal':undefined} onTrailingPress={canShowMenu?()=>setMenuOpen((value)=>!value):undefined}/>{canShowMenu&&menuOpen&&<View style={s.sheetLayer}><Pressable accessibilityLabel="프로필 메뉴 닫기" onPress={()=>setMenuOpen(false)} style={s.sheetDim}/><View style={s.profileActionMenu}><View style={s.profileActionList}>{actions.map((label)=><Pressable key={label} onPress={()=>selectAction(label)} style={s.profileActionRow}><Text style={s.profileActionText}>{label}</Text></Pressable>)}</View></View></View>}<KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={s.memberProfilePage}><Pressable accessibilityLabel={editable?'프로필 사진 변경':'프로필 사진 크게 보기'} onPress={pick}>{avatar?<Image source={{uri:avatar.uri}} style={s.memberProfileAvatarLarge}/>:<DefaultAvatar size={96}/>}</Pressable>{editable?<View style={s.memberProfileEditCard}><LimitedField label="이름" value={name} onChange={(value)=>setName(value.slice(0,13))} placeholder="방에서 사용할 이름" limit={13}/><LimitedField label="자기 소개" value={intro} onChange={(value)=>setIntro(value.slice(0,60))} placeholder="자기 소개를 입력해주세요." limit={60} multiline/><Pressable disabled={!name.trim()||!intro.trim()} onPress={save} style={[s.primary,(!name.trim()||!intro.trim())&&s.disabled]}><Text style={s.primaryText}>저장하기</Text></Pressable></View>:<><View style={s.memberProfileNameLine}><Text style={s.memberProfileName}>{member.name}</Text>{member.owner?<Badge text="방장" pink/>:member.coHost?<Badge text="부방장"/>:null}</View><Text style={s.memberProfileRoom}>{room.name}에서 사용하는 프로필</Text><View style={s.memberProfileCard}><Text style={s.memberProfileLabel}>자기 소개</Text><Text style={s.memberProfileIntro}>{member.intro}</Text></View></>}</ScrollView></KeyboardAvoidingView>{photoOpen&&<View style={s.photoViewer}><Pressable accessibilityLabel="프로필 사진 닫기" onPress={()=>setPhotoOpen(false)} style={s.photoViewerDim}/><Image source={avatar?{uri:avatar.uri}:require('./assets/default-profile.png')} style={s.photoViewerImage}/><Pressable onPress={()=>setPhotoOpen(false)} style={s.photoViewerClose}><Ionicons name="close" size={24} color="#FFF"/></Pressable></View>}</SafeAreaView>;
}

function NativeProfileCaptureGuard(){ScreenCapture.usePreventScreenCapture('mute-profile');return null;}
function ProfileCaptureGuard(){return Platform.OS==='web'?null:<NativeProfileCaptureGuard/>;}

function RoomOverview({room,onProfile}:{room:Room;onProfile:(member:RoomMember)=>void}){
  return <ScrollView contentContainerStyle={s.overviewPage}><DefaultRoomCover/><View style={s.overviewIntro}><Text style={s.spaceTitle}>{room.name}</Text><Text style={s.gradientTags}>{room.tags.map((tag)=>`#${tag}`).join('  ')}</Text><Text style={s.spaceBody}>{room.description}</Text></View><Text style={s.overviewSection}>멤버</Text><View style={s.detailMemberGrid}>{membersForRoom(room).map((member)=><Pressable key={member.name} onPress={()=>onProfile(member)} style={s.detailMemberItem}><DefaultAvatar size={58}/><Text style={s.gridName}>{member.name}</Text>{member.owner?<Badge text="방장" pink/>:member.coHost?<Badge text="부방장"/>:null}</Pressable>)}</View><Text style={s.overviewSection}>스토리</Text>{stories.map((story)=><View key={story.id} style={s.overviewStory}><Text numberOfLines={2} style={s.storyBody}>{story.body}</Text></View>)}</ScrollView>;
}

function JoinRequests({room}:{room:Room}){
  const [requests,setRequests]=useState<{id:string;name:string;intro:string;status:string}[]>([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState('');
  useEffect(()=>{let active=true;setLoading(true);if(!isSupabaseConfigured||!isUuid(room.id)){setRequests([{id:'demo-request-1',name:'유리안',intro:'산책 모임에 참여하고 싶어요. 저녁 시간대가 가장 편합니다.',status:'pending'},{id:'demo-request-2',name:'파도결',intro:'사진과 일상 이야기 둘 다 좋아해요. 조용히 적응해볼게요.',status:'pending'},{id:'demo-request-3',name:'서늘',intro:'방 분위기 읽고 천천히 이야기 나누고 싶습니다.',status:'pending'}]);setLoading(false);return;}const reload=()=>listPendingRoomJoinRequests(room.id).then((rows)=>{if(active)setRequests(rows.map((row)=>({id:row.id,name:row.requested_name,intro:row.requested_introduction,status:'pending'})));}).catch((error)=>{if(active)Alert.alert('가입 신청 목록 불러오기 실패',serverErrorMessage(error));}).finally(()=>{if(active)setLoading(false);});reload();const channel=supabase?.channel(`join-request-list-${room.id}`).on('postgres_changes',{event:'*',schema:'public',table:'room_join_requests',filter:`room_id=eq.${room.id}`},reload).subscribe();return()=>{active=false;if(channel&&supabase)supabase.removeChannel(channel);};},[room.id]);
  const decide=async(id:string,status:'approved'|'rejected')=>{try{if(isSupabaseConfigured&&isUuid(id))await decideRoomJoin(id,status==='approved');setRequests((items)=>items.filter((item)=>item.id!==id));setToast(`가입 신청을 ${status==='approved'?'승인':'거절'}하였습니다.`);setTimeout(()=>setToast(''),1800);}catch(error){Alert.alert('처리 실패',serverErrorMessage(error));}};
  if(loading)return <View style={s.centerState}><ActivityIndicator color={colors.mint700}/><Text style={s.centerStateText}>가입 신청을 불러오고 있어요.</Text></View>;
  if(requests.length===0)return <Empty title="가입 신청이 없어요" body="새 신청이 들어오면 이곳에 표시됩니다."/>;
  return <View style={s.flex}><ScrollView contentContainerStyle={s.requestList}>{requests.map((item)=><View key={item.id} style={s.requestCard}><DefaultAvatar size={52}/><View style={s.requestBody}><Text style={s.memberName}>{item.name}</Text><Text style={s.memberIntro}>{item.intro}</Text>{item.status==='pending'?<View style={s.requestActions}><Pressable onPress={()=>decide(item.id,'rejected')} style={s.rejectButton}><Text style={s.rejectText}>거절</Text></Pressable><Pressable onPress={()=>decide(item.id,'approved')} style={s.approveButton}><Text style={s.primaryText}>승인</Text></Pressable></View>:<Text style={[s.requestResult,item.status==='rejected'&&s.requestRejected]}>{item.status==='approved'?'승인했습니다.':'거절했습니다.'}</Text>}</View></View>)}</ScrollView>{toast!==''&&<View pointerEvents="none" style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}</View>;
}

function BlockedMembers({room}:{room:Room}){
  const [items,setItems]=useState<{userId:string;reason:string;createdAt:string}[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;if(!isSupabaseConfigured||!isUuid(room.id)){setItems([{userId:'demo-ban-001',reason:'내보내고 차단 · 반복 도배',createdAt:'2026.06.16'},{userId:'demo-ban-002',reason:'강퇴 후 재입장 차단 · 욕설 신고 누적',createdAt:'2026.06.14'},{userId:'demo-ban-003',reason:'수동 차단 · 비밀방 PIN 무단 공유',createdAt:'2026.06.10'}]);setLoading(false);return;}listBlockedRoomMembers(room.id).then((rows)=>{if(active)setItems(rows.map((row)=>({userId:row.user_id,reason:row.reason||'내보내고 차단함',createdAt:new Date(row.created_at).toLocaleDateString('ko-KR')})));}).catch((error)=>Alert.alert('차단 목록 불러오기 실패',serverErrorMessage(error))).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[room.id]);
  const unblock=async(userId:string)=>{try{if(isSupabaseConfigured&&isUuid(room.id))await unbanRoomMember(room.id,userId);setItems((current)=>current.filter((item)=>item.userId!==userId));}catch(error){Alert.alert('차단 해제 실패',serverErrorMessage(error));}};
  if(loading)return <View style={s.centerState}><ActivityIndicator color={colors.mint700}/><Text style={s.centerStateText}>차단 멤버를 불러오고 있어요.</Text></View>;
  if(items.length===0)return <Empty title="차단된 멤버가 없어요" body="내보내고 차단한 멤버를 여기서 관리할 수 있습니다."/>;
  return <ScrollView contentContainerStyle={s.memberPanel}>{items.map((item)=><View key={item.userId} style={s.departedMember}><DefaultAvatar size={44}/><View style={s.flex}><Text style={s.memberName}>차단 멤버</Text><Text style={s.memberIntro}>{item.userId.slice(0,8)} · {item.createdAt}</Text></View><Pressable onPress={()=>unblock(item.userId)} style={[s.blockButton,s.blockButtonActive]}><Text style={[s.blockButtonText,s.blockButtonTextActive]}>차단 풀기</Text></Pressable></View>)}</ScrollView>;
}

function CoHostSheet({member,onClose,onToggle,onTransfer,onKick,onBan}:{member:RoomMember|undefined;onClose:()=>void;onToggle:()=>void;onTransfer:()=>void;onKick:()=>void;onBan:()=>void}){
  if(!member)return null;
  return <View style={s.sheetLayer}><Pressable accessibilityLabel="멤버 관리 닫기" onPress={onClose} style={s.sheetDim}/><View style={s.coHostSheet}><View style={s.sheetHandle}/><View style={s.sheetProfile}><DefaultAvatar size={54}/><View><Text style={s.sheetName}>{member.name}</Text><Text style={s.sheetIntro}>{member.userId?.slice(0,8)} · userID 기준 관리</Text></View></View><Pressable onPress={onToggle} style={s.memberRoleAction}><Ionicons name="shield-checkmark-outline" size={20} color={colors.mint700}/><Text style={s.memberRoleActionText}>{member.coHost?'부방장 권한 해제하기':'부방장 권한 추가하기'}</Text></Pressable><Pressable onPress={onTransfer} style={s.memberRoleAction}><Ionicons name="swap-horizontal-outline" size={20} color={colors.mint700}/><Text style={s.memberRoleActionText}>방장 권한 위임하기</Text></Pressable><Pressable onPress={onKick} style={s.memberRoleAction}><Ionicons name="exit-outline" size={20} color={colors.textSubtle}/><Text style={s.memberRoleActionText}>내보내기</Text></Pressable><Pressable onPress={onBan} style={s.memberRoleAction}><Ionicons name="ban-outline" size={20} color={colors.pink600}/><Text style={[s.memberRoleActionText,s.danger]}>내보내고 차단하기</Text></Pressable></View></View>;
}

function Profile({points,now,attendanceAvailableAt,rewardedAdAvailable,onAttendance,onRewardedAd,onRanking,onSettings}:{points:number;now:number;attendanceAvailableAt:number;rewardedAdAvailable:boolean;onAttendance:()=>void;onRewardedAd:()=>void;onRanking:()=>void;onSettings:()=>void}) {
  const [shopOpen,setShopOpen]=useState(false);
  const [logOpen,setLogOpen]=useState(false);
  const [selectedCharge,setSelectedCharge]=useState(0);
  const remaining=Math.max(0,attendanceAvailableAt-now);
  const minutes=Math.floor(remaining/60000);
  const seconds=Math.floor((remaining%60000)/1000);
  const countdown=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  const attendance=()=>Alert.alert('출석 체크','출석 체크 할까요?',[{text:'취소',style:'cancel'},{text:'출석하기',onPress:onAttendance}]);
  const chargeOptions=[{p:6000,w:1200},{p:13000,w:2500},{p:32000,w:5900},{p:66000,w:12000},{p:210000,w:37000},{p:390000,w:65000}];
  if(logOpen)return <View style={s.pointLogOverlay}><SafeAreaView style={s.safe}><TopBar title="포인트 내역" onBack={()=>setLogOpen(false)}/><ScrollView style={s.pointLogPage} contentInsetAdjustmentBehavior="never">{[
    ['2026-06-15'],['07:11','출석체크 포인트','+20','688',true],['2026-03-18'],['02:08','챗버블(Pink) 구매','-3000','668',false],['2026-02-03'],['07:20','챗버블(SteelBlue) 구매','-2500','3668',false],['07:20','포인트 충전','+6000','6168',true],['2026-01-22'],['06:11','탑스페이스 추가','-2000','168',false],['2026-01-16'],['11:24','챗버블(SteelBlue) 구매','-2500','2168',false],['2026-01-08'],['12:24','챗버블(SteelBlue) 구매','-2500','4668',false],['12:23','포인트 충전','+6000','7168',true],
  ].map((row,index)=>row.length===1?<Text key={index} style={s.pointLogDate}>{row[0]}</Text>:<View key={index} style={s.pointLogRow}><Text style={s.pointLogTime}>{row[0]}</Text><Text style={s.pointLogTitle}>{row[1]}</Text><Text style={[s.pointLogAmount,row[4]?s.pointLogPlus:s.pointLogMinus]}>{row[2]}</Text><Text style={s.pointLogBalance}>({row[3]})</Text></View>)}</ScrollView></SafeAreaView></View>;
  return <View style={s.flex}><ScrollView contentContainerStyle={s.page}><View style={s.pointCard}><View><Text style={s.pointLabel}>보유 포인트</Text><Text style={s.pointValue}>{points.toLocaleString()} P</Text></View><Pressable onPress={()=>setShopOpen(true)} style={s.pointButton}><Text style={s.pointButtonText}>충전하기</Text></Pressable></View><View style={s.profileMenuGroup}><Pressable onPress={()=>setLogOpen(true)} style={s.profileMenu}><Ionicons name="wallet-outline" size={19} color={colors.textSubtle}/><Text style={s.menuTitle}>포인트 내역</Text><Ionicons name="chevron-forward" size={17} color={colors.gray300}/></Pressable><Pressable onPress={onRanking} style={s.profileMenu}><Ionicons name="trophy-outline" size={19} color={colors.textSubtle}/><Text style={s.menuTitle}>명예의 전당</Text><Ionicons name="chevron-forward" size={17} color={colors.gray300}/></Pressable><Pressable onPress={onSettings} style={s.profileMenu}><Ionicons name="settings-outline" size={19} color={colors.textSubtle}/><Text style={s.menuTitle}>설정</Text><Ionicons name="chevron-forward" size={17} color={colors.gray300}/></Pressable></View><View style={s.rewardSection}><Pressable disabled={remaining>0} onPress={attendance} style={[s.rewardButton,remaining>0&&s.rewardButtonDisabled]}><LinearGradient colors={remaining>0?['#C9D8D5','#BFCAC7']:['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.rewardGradient}><Text style={s.rewardTitle}>{remaining>0?`${countdown} 후 출석 체크`:'출석 체크'}</Text><Text style={s.rewardPoints}>10 P</Text></LinearGradient></Pressable><Pressable disabled={!rewardedAdAvailable} onPress={onRewardedAd} style={[s.rewardButton,!rewardedAdAvailable&&s.rewardButtonDisabled]}><LinearGradient colors={rewardedAdAvailable?['#82B9C1','#5DBB8C']:['#C9D8D5','#BFCAC7']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.rewardGradient}><Text style={s.rewardTitle}>광고 보고 포인트 더 받기</Text><Text style={s.rewardPoints}>{rewardedAdAvailable?'5 P':'오늘 보상 완료'}</Text></LinearGradient></Pressable></View></ScrollView>{shopOpen&&<View style={s.chargeLayer}><Pressable style={s.chargeDim} onPress={()=>setShopOpen(false)}/><View style={s.chargeModal}><Text style={s.chargeTitle}>포인트 충전</Text>{chargeOptions.map((option,index)=><Pressable key={option.p} onPress={()=>setSelectedCharge(index)} style={s.chargeOption}><View style={[s.chargeRadio,selectedCharge===index&&s.chargeRadioOn]}/><View><Text style={s.chargePoint}>{option.p.toLocaleString()}p</Text><Text style={s.chargeWon}>{option.w.toLocaleString()}원</Text></View></Pressable>)}<View style={s.chargeActions}><Pressable onPress={()=>setShopOpen(false)} style={s.chargeAction}><Text style={s.chargeCancel}>취소</Text></Pressable><Pressable onPress={()=>Alert.alert('구매 준비','스토어 결제 연결 후 구매할 수 있습니다.')} style={s.chargeAction}><Text style={[s.chargeBuy,selectedCharge>=0&&s.chargeBuyActive]}>구매</Text></Pressable></View></View></View>}</View>;
}

function StoreCard({icon,title,body,price}:{icon:IconName;title:string;body:string;price:string}){
  const buy=async()=>{
    const productId=title==='광고 없는 계정'?STORE_PRODUCTS.adFreeMonthly:title==='커스텀 색상'?STORE_PRODUCTS.customBubbleColor:null;
    if(!productId){Alert.alert(title,'채팅방의 붓 아이콘에서 색상을 선택하고 구매할 수 있습니다.');return;}
    try{await purchaseProduct(productId);Alert.alert('구매 완료','상품이 계정에 적용되었습니다.');}
    catch(error){Alert.alert('구매 준비 필요',serverErrorMessage(error));}
  };
  return <Pressable onPress={buy} style={s.storeCard}><View style={s.storeIcon}><Ionicons name={icon} size={23} color={colors.mint700}/></View><View style={s.flex}><Text style={s.storeTitle}>{title}</Text><Text style={s.storeBody}>{body}</Text></View><Text style={s.storePrice}>{price}</Text></Pressable>;
}

function CreateRoom({ adultVerified, onBack, onCreated }: { adultVerified:boolean; onBack: () => void; onCreated: (room:Room) => void }) {
  const [name,setName]=useState(''); const [description,setDescription]=useState('');
  const [profileName,setProfileName]=useState('');
  const [profileIntro,setProfileIntro]=useState('');
  const [region,setRegion]=useState('');
  const [profileAvatar,setProfileAvatar]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const [maxMembers,setMaxMembers]=useState(1);
  const [roomType,setRoomType]=useState<'member'|'concept'|'region'|'adult'>('member');
  const [coverAsset,setCoverAsset]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const coverUri=coverAsset?.uri??null;
  const [submitting,setSubmitting]=useState(false);
  const [visibility,setVisibility]=useState<'public'|'private'>('public');
  const [pin,setPin]=useState('');
  const formScrollRef=useRef<ScrollView|null>(null);
  const regionFieldY=useRef(0);
  const capacityFieldY=useRef(0);
  const setCapacity=(value:number)=>setMaxMembers(Math.min(80,Math.max(1,value||1)));
  const scrollCreateField=(y:number,anchorBottom=false)=>setTimeout(()=>{
    if(anchorBottom){
      formScrollRef.current?.scrollToEnd({animated:true});
      return;
    }
    formScrollRef.current?.scrollTo({y:Math.max(0,y-84),animated:true});
  },140);
  const types:[typeof roomType,string,boolean][]=[['member','Member',false],['concept','콘셉트',false],['region','지역별',false],['adult','성인',!adultVerified]];
  const selectCover=async()=>{const source=await promptImageSource();if(!source)return;const asset=await pickSingleImage({source,aspect:[1,1],quality:.82});if(!asset)return;const isGif=asset.mimeType==='image/gif'||asset.uri.toLowerCase().endsWith('.gif');if(isGif&&(asset.fileSize??0)>10*1024*1024){Alert.alert('GIF 용량 초과','방 대표 GIF는 10MB 이하만 사용할 수 있습니다.');return;}setCoverAsset(asset);};
  const selectProfileAvatar=async()=>{const source=await promptImageSource();if(!source)return;const asset=await pickSingleImage({source,aspect:[1,1],quality:.82});if(asset)setProfileAvatar(asset);};
  const submit=async()=>{setSubmitting(true);try{let avatarUploadId:string|undefined;if(isSupabaseConfigured&&profileAvatar){const resized=await ImageManipulator.manipulateAsync(profileAvatar.uri,[{resize:{width:720}}],{compress:.8,format:ImageManipulator.SaveFormat.JPEG});const bytes=await (await fetch(resized.uri)).arrayBuffer();const avatarUpload=await uploadValidatedImage({uri:resized.uri,mimeType:'image/jpeg',fileSize:bytes.byteLength,width:720,height:720,purpose:'profile-avatar'});avatarUploadId=avatarUpload.uploadId;}const input={name:name.trim(),description:description.trim(),category:roomType,maxMembers,region:roomType==='region'?region.trim():undefined};const id=isSupabaseConfigured?await createRoom(input):`demo-${Date.now()}`;if(isSupabaseConfigured){await setRoomOwnerProfile({roomId:id,displayName:profileName.trim(),introduction:profileIntro.trim(),avatarUploadId});if(visibility==='private')await configureRoomAccess({roomId:id,visibility,pin});}let finalCoverUri=coverAsset?.uri;if(isSupabaseConfigured&&coverAsset){const isGif=coverAsset.mimeType==='image/gif'||coverAsset.uri.toLowerCase().endsWith('.gif');let uri=coverAsset.uri;const mimeType:'image/jpeg'|'image/gif'=isGif?'image/gif':'image/jpeg';let width=coverAsset.width??1;let height=coverAsset.height??1;if(!isGif){const scale=Math.min(1,1440/Math.max(1,width));const resized=await ImageManipulator.manipulateAsync(uri,[{resize:{width:Math.max(1,Math.round(width*scale))}}],{compress:.8,format:ImageManipulator.SaveFormat.JPEG});uri=resized.uri;finalCoverUri=uri;width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));}const bytes=await (await fetch(uri)).arrayBuffer();const upload=await uploadValidatedImage({uri,mimeType,fileSize:bytes.byteLength,width,height,purpose:'room-cover',roomId:id});await setRoomCover(id,upload.uploadId);}const created:Room={id,name:input.name,description:input.description,tags:[visibility==='private'?'비밀방':roomType==='concept'?'콘셉트':roomType==='adult'?'성인':'Member'],memberCount:1,maxMembers,category:roomType==='concept'?'concept':roomType==='member'?'member':'general',topSpaceCount:0,isAdult:roomType==='adult',isActive:true,emoji:'○',imageColor:'#E8ECEA',coverUri:finalCoverUri,region:roomType==='region'?region.trim():undefined};onCreated(created);}catch(error){Alert.alert('방 생성 실패',serverErrorMessage(error));setSubmitting(false);}};
  const invalidPin=visibility==='private'&&pin.length!==6;
  const disabled=!name.trim()||!description.trim()||!profileName.trim()||!profileIntro.trim()||submitting||invalidPin||(roomType==='region'&&!region.trim());
  return <SafeAreaView style={s.safe}><EdgeBackLayer onBack={onBack}/><StatusBar style="light"/><TopBar title="방 생성하기" onBack={onBack}/><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView ref={formScrollRef} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={s.form}><Pressable accessibilityLabel="대표 이미지 선택" onPress={selectCover} style={s.uploadRound}>{coverUri?<Image source={{uri:coverUri}} style={s.uploadRoundImage}/>:<Ionicons name="camera-outline" size={28} color={colors.mint700}/>}</Pressable><LimitedField label="방 이름" value={name} onChange={(value)=>setName(value.slice(0,13))} placeholder="방제를 입력해주세요." limit={13}/><LimitedField label="방 설명" value={description} onChange={(value)=>setDescription(value.slice(0,120))} placeholder="방 설명을 입력해주세요." limit={120} multiline/><View style={s.ownerProfileBlock}><Text style={s.ownerProfileTitle}>방에서 사용할 내 프로필</Text><Pressable accessibilityLabel="방장 프로필 사진 선택" onPress={selectProfileAvatar} style={s.ownerProfileAvatar}>{profileAvatar?<Image source={{uri:profileAvatar.uri}} style={s.joinAvatar}/>:<DefaultAvatar size={82}/>}<View style={s.editDot}><Ionicons name="camera" size={13} color="#FFF"/></View></Pressable><LimitedField label="이름" value={profileName} onChange={(value)=>setProfileName(value.slice(0,13))} placeholder="방에서 사용할 이름" limit={13}/><LimitedField label="자기 소개" value={profileIntro} onChange={(value)=>setProfileIntro(value.slice(0,60))} placeholder="자기 소개를 입력해주세요." limit={60} multiline/></View><View style={s.field}><Text style={s.fieldLabel}>공개 설정</Text><View style={s.visibilityRows}><Pressable onPress={()=>{setVisibility('public');setPin('');}} style={[s.visibilityCard,visibility==='public'&&s.visibilityCardActive]}><Ionicons name="earth-outline" size={21} color={colors.mint700}/><View><Text style={s.visibilityCardTitle}>공개방</Text><Text style={s.visibilityCardText}>홈과 검색에 표시</Text></View></Pressable><Pressable onPress={()=>setVisibility('private')} style={[s.visibilityCard,visibility==='private'&&s.visibilityCardActive]}><Ionicons name="lock-closed-outline" size={21} color={colors.mint700}/><View><Text style={s.visibilityCardTitle}>비밀방</Text><Text style={s.visibilityCardText}>PIN 6자리 필수</Text></View></Pressable></View>{visibility==='private'&&<View style={s.pinFieldWrap}><TextInput value={pin} onFocus={()=>scrollCreateField(capacityFieldY.current,true)} onChangeText={(value)=>setPin(value.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" secureTextEntry placeholder="PIN 6자리" placeholderTextColor={colors.textMuted} style={s.input}/>{invalidPin&&<Text style={s.pinError}>비밀방은 PIN 6자리를 반드시 설정해야 합니다.</Text>}</View>}</View><View style={s.field}><Text style={s.fieldLabel}>분류</Text><View style={s.radioList}>{types.map(([value,label,typeDisabled])=><Pressable key={value} disabled={typeDisabled} onPress={()=>setRoomType(value)} style={[s.radioRow,typeDisabled&&s.radioDisabled]}><View style={[s.radioCircle,roomType===value&&s.radioCircleActive]}>{roomType===value&&<View style={s.radioDot}/>}</View><Text style={[s.radioText,typeDisabled&&s.radioTextDisabled]}>{label}</Text>{typeDisabled&&<Text style={s.radioReason}>성인 인증 필요</Text>}</Pressable>)}</View>{roomType==='region'&&<View onLayout={(event)=>{regionFieldY.current=event.nativeEvent.layout.y;}} style={s.regionFieldWrap}><Field label="지역" value={region} onChange={(value)=>setRegion(value.slice(0,20))} placeholder="경기 남부"/></View>}</View><View onLayout={(event)=>{capacityFieldY.current=event.nativeEvent.layout.y;}} style={s.field}><View style={s.capacityLine}><Text style={s.fieldLabel}>최대 인원</Text><Text style={s.capacityHintInline}>(최소 1명, 최대 80명)</Text></View><View style={s.stepper}><Pressable accessibilityLabel="인원 줄이기" onPress={()=>setCapacity(maxMembers-1)} style={s.stepperButton}><Ionicons name="remove" size={20} color={colors.textSubtle}/></Pressable><TextInput keyboardType="number-pad" value={`${maxMembers}`} onFocus={()=>scrollCreateField(capacityFieldY.current,true)} onChangeText={(value)=>setCapacity(Number(value.replace(/[^0-9]/g,'')))} style={[s.stepperInput,Platform.OS==='web'&&({outlineStyle:'none'} as object)]}/><Text style={s.stepperUnit}>명</Text><Pressable accessibilityLabel="인원 늘리기" onPress={()=>setCapacity(maxMembers+1)} style={s.stepperButton}><Ionicons name="add" size={20} color={colors.textSubtle}/></Pressable></View></View></ScrollView><View style={s.sticky}><Pressable disabled={disabled} onPress={submit} style={[s.primary,disabled&&s.disabled]}><Text style={s.primaryText}>{submitting?'생성 중...':'방 생성하기'}</Text></Pressable></View></KeyboardAvoidingView></SafeAreaView>;
}

function AdultVerificationScreen({verified,onBack,onRefresh}:{verified:boolean;onBack:()=>void;onRefresh:()=>Promise<boolean>}){
  const [loading,setLoading]=useState(false);
  const begin=async()=>{
    setLoading(true);
    try{const url=await startAdultVerification();await Linking.openURL(url);}
    catch(error){Alert.alert('성인 인증 준비 필요',serverErrorMessage(error).includes('PROVIDER_NOT_CONFIGURED')||serverErrorMessage(error).includes('ADULT_VERIFICATION_PROVIDER_NOT_CONFIGURED')?'본인확인 공급자 채널이 아직 연결되지 않았습니다. 계약 후 시작 URL을 등록하면 바로 활성화됩니다.':serverErrorMessage(error));}
    finally{setLoading(false);}
  };
  const refresh=async()=>{setLoading(true);try{const done=await onRefresh();Alert.alert('인증 상태',done?'성인 인증이 완료되었습니다.':'아직 인증 완료 정보가 확인되지 않습니다.');}finally{setLoading(false);}};
  return <SafeAreaView style={s.safe}><TopBar title="성인 인증" onBack={onBack}/><View style={s.verificationPage}><View style={s.verificationIcon}><Ionicons name={verified?'shield-checkmark':'shield-checkmark-outline'} size={34} color={colors.mint700}/></View><Text style={s.verificationTitle}>{verified?'성인 인증 완료':'만 19세 이상 본인인증'}</Text><Text style={s.verificationBody}>성인 탭은 휴대폰 본인확인 업체가 전달한 생년월일과 내·외국인 정보를 서버에서 검증한 계정만 이용할 수 있습니다. 주민등록번호는 앱과 서버에 저장하지 않습니다.</Text>{!verified&&<Pressable disabled={loading} onPress={begin} style={[s.primary,loading&&s.disabled]}><Text style={s.primaryText}>{loading?'연결 중...':'휴대폰 본인인증 시작'}</Text></Pressable>}<Pressable disabled={loading} onPress={refresh} style={s.verificationRefresh}><Text style={s.verificationRefreshText}>인증 상태 새로고침</Text></Pressable></View></SafeAreaView>;
}

function Settings({ adultVerified, isSuperAdmin, onAdultVerification, onBack, onSignedOut }: { adultVerified:boolean; isSuperAdmin:boolean; onAdultVerification:()=>void; onBack: () => void; onSignedOut: () => void }) {
  const [notifications,setNotifications]=useState(true);
  const [processingAccount,setProcessingAccount]=useState(false);
  const performLogout=async()=>{if(processingAccount)return;setProcessingAccount(true);try{await signOut();onSignedOut();}catch(error){setProcessingAccount(false);Alert.alert('로그아웃 실패',serverErrorMessage(error));}};
  const logout=()=>Alert.alert('로그아웃','로그아웃 하시겠습니까?',[{text:'취소',style:'cancel'},{text:'로그아웃',onPress:performLogout}]);
  const performDelete=async()=>{if(processingAccount)return;setProcessingAccount(true);try{await requestAccountDeletion();try{await signOut();}catch{}onSignedOut();}catch(error){setProcessingAccount(false);Alert.alert('탈퇴 실패',serverErrorMessage(error));}};
  const deleteAccount=()=>{if(isSuperAdmin){Alert.alert('탈퇴 불가','슈퍼관리자 계정은 탈퇴할 수 없습니다.');return;}Alert.alert('계정 탈퇴','정말 탈퇴하시겠습니까?\n탈퇴 후 3일 간 계정 생성이 불가합니다.',[{text:'취소',style:'cancel'},{text:'탈퇴',style:'destructive',onPress:performDelete}]);};
  const openUrl=(url:string)=>Linking.openURL(url).catch(()=>Alert.alert('열기 실패','연결할 앱이나 브라우저를 확인해주세요.'));
  return <SafeAreaView style={s.safe}><StatusBar style="light"/><TopBar title="설정" onBack={onBack}/><ScrollView contentContainerStyle={s.settings}><Text style={s.groupLabel}>알림</Text><View style={s.menuGroup}><Menu icon="notifications-outline" title="전체 알림" trailing={<Switch value={notifications} onValueChange={setNotifications} trackColor={{false:colors.gray200,true:colors.mint300}}/>}/></View><Text style={s.groupLabel}>계정 및 서비스</Text><View style={s.menuGroup}><Menu icon="call-outline" title="인증 전화번호" value="인증됨" onPress={()=>Alert.alert('인증 전화번호','보안을 위해 전화번호 전체는 표시하지 않습니다.')}/><Menu icon="shield-checkmark-outline" title="성인 인증" value={adultVerified?'인증됨':'미인증'} onPress={onAdultVerification}/><Menu icon="card-outline" title="결제 내역" onPress={()=>Alert.alert('결제 내역','아직 결제 내역이 없습니다.')}/><Menu icon="document-text-outline" title="개인정보 처리방침" onPress={()=>openUrl('https://mute.app/privacy')}/><Menu icon="mail-outline" title="피드백 보내기" onPress={()=>openUrl('mailto:support@mute.app?subject=Mute%20피드백')}/></View><View style={s.menuGroup}><Menu icon="log-out-outline" title="로그아웃" danger onPress={logout}/><Menu icon="trash-outline" title="계정 탈퇴" value={isSuperAdmin?'관리자 계정은 탈퇴 불가':undefined} danger onPress={deleteAccount}/></View><Text style={s.version}>Mute 0.1.0</Text></ScrollView></SafeAreaView>;
}

function BottomNav({ selected,onSelect }: { selected: BottomTab; onSelect:(v:BottomTab)=>void }) {
  const items: [BottomTab,IconName,IconName,string][]=[['myRooms','chatbubbles-outline','chatbubbles','내 채팅'],['discover','home-outline','home','홈'],['stories','albums-outline','albums','스토리'],['profile','person-outline','person','내 정보']];
  return <View style={s.bottomNav}>{items.map(([key,icon,active,label])=><Pressable key={key} onPress={()=>onSelect(key)} style={s.navItem}><Ionicons name={selected===key?active:icon} size={22} color={selected===key?colors.mint700:colors.textMuted}/><Text style={[s.navText,selected===key&&s.navActive]}>{label}</Text></Pressable>)}</View>;
}

function TopBar({title,subtitle,inlineCount,onBack,secondaryTrailing,onSecondaryTrailingPress,trailing,onTrailingPress}:{title:string;subtitle?:string;inlineCount?:number;onBack:()=>void;secondaryTrailing?:IconName;onSecondaryTrailingPress?:()=>void;trailing?:IconName;onTrailingPress?:()=>void}) { return <LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.topBar}><IconButton name="chevron-back" color="#FFF" onPress={onBack}/><View style={s.topCenter}><View style={s.topTitleLine}><Text numberOfLines={1} style={s.topTitle}>{title}</Text>{inlineCount!==undefined&&<Text style={s.topInlineCount}>{inlineCount}명</Text>}</View>{subtitle&&<Text style={s.topSub}>{subtitle}</Text>}</View><View style={s.topActions}>{secondaryTrailing&&<Pressable accessibilityLabel={secondaryTrailing==='search'?'채팅 검색':secondaryTrailing} onPress={onSecondaryTrailingPress} style={s.topSide}><Ionicons name={secondaryTrailing} size={21} color="#FFF"/></Pressable>}<Pressable accessibilityLabel={trailing} onPress={onTrailingPress} disabled={!onTrailingPress} style={s.topSide}>{trailing&&<Ionicons name={trailing} size={22} color="#FFF"/>}</Pressable></View></LinearGradient>; }
function DefaultAvatar({size=44,overlap=false}:{size?:number;overlap?:boolean}) { return <Image accessibilityLabel="기본 프로필 이미지" source={require('./assets/default-profile.png')} style={[s.avatar,{width:size,height:size,borderRadius:size/2,marginLeft:overlap?-9:0}]}/>; }
function Avatar({uri,size=44,overlap=false}:{uri?:string;size?:number;overlap?:boolean}) {
  if (!uri) return <DefaultAvatar size={size} overlap={overlap}/>;
  return <ExpoImage source={{uri}} contentFit="cover" style={[s.avatar,{width:size,height:size,borderRadius:size/2,marginLeft:overlap?-9:0}]}/>;
}
function RoomImage({room,size,blurAdult=false}:{room?:Room;size:number;blurAdult?:boolean}) { return room?.coverUri?<View style={[s.roomImage,{width:size,height:size,borderRadius:size/2,overflow:'hidden'}]}><ExpoImage source={{uri:room.coverUri}} contentFit="cover" blurRadius={blurAdult?16:0} style={StyleSheet.absoluteFill}/>{blurAdult&&<View style={s.adultBlurMask}/>}</View>:<View style={[s.roomImage,s.defaultRoomImage,{width:size,height:size,borderRadius:size/2}]}>{blurAdult&&<View style={s.adultBlurMask}/>}</View>; }
function DefaultRoomCover({room}:{room?:Room}){return room?.coverUri?<ExpoImage source={{uri:room.coverUri}} contentFit="cover" style={s.defaultCover}/>:<View style={[s.defaultCover,s.defaultCoverLogo]}/>;}
function ImageGrid({uris,onSave,onPress}:{uris:string[];onSave:(uri:string)=>void;onPress?:(uri:string)=>void}){return <View style={[s.imageGrid,uris.length===1&&s.imageGridSingle]}>{uris.map((uri,index)=><Pressable key={`${uri}-${index}`} onPress={()=>onPress?.(uri)} onLongPress={()=>onSave(uri)} style={[s.imageGridItem,uris.length===1&&s.imageGridItemSingle]}><ExpoImage source={{uri}} contentFit="cover" transition={120} style={s.imageGridImage}/>{uri.toLowerCase().includes('.gif')&&<View style={s.gifBadge}><Text style={s.gifBadgeText}>GIF</Text></View>}</Pressable>)}</View>;}
function MuteLogo({variant='color',compact=false}:{symbolOnly?:boolean;variant?:'white'|'color';compact?:boolean}){return <View accessibilityLabel="뮤트" style={[s.muteLogo,compact&&s.muteLogoCompact]}><Image source={variant==='white'?require('./assets/mute-logo-white.png'):require('./assets/mute-logo-color.png')} resizeMode="contain" style={[s.muteLogoSymbol,compact&&s.muteLogoSymbolCompact]}/></View>;}
function SectionLabel({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}){return <View style={s.sectionLabel}><Text style={s.sectionTitle}>{title}</Text>{action&&<Pressable onPress={onAction} style={s.sectionActionButton}><Text style={s.sectionAction}>{action}</Text><Ionicons name="chevron-forward" size={13} color={colors.mint700}/></Pressable>}</View>;}
function NotificationBadge({inline=false,count=3}:{inline?:boolean;count?:number}){const label=count>99?'99+':`${count}`;return <View style={[s.notificationBadge,inline&&s.notificationBadgeInline]}><Text style={s.notificationBadgeText}>{label}</Text></View>;}
function ComposerPanel({tool,onCamera,onGallery,onTopSpace,onPromotion,onNewStory,showPromotion,bubbleColor,textColor,backgroundColor,onBubbleColor,onTextColor,onBackgroundColor}:{tool:ComposerTool;onCamera:()=>void;onGallery:()=>void;onTopSpace:()=>void;onPromotion:()=>void;onNewStory:()=>void;showPromotion:boolean;secretDraft:string;onSecretDraft:(value:string)=>void;onSendSecret:()=>void;bubbleColor:string;textColor:string;backgroundColor:string;onBubbleColor:(value:string)=>void;onTextColor:(value:string)=>void;onBackgroundColor:(value:string)=>void}){
  if(!tool||tool==='secret')return null;
  const backgroundColors=['#FFFFFF','#F2F7F4','#EDF3F7','#F8F1F4','#EEEAE3'];
  return <View style={[s.composerPanel,{height:tool==='media'?116:260}]}>
    {tool==='media'?<View style={s.toolRow}><ToolAction icon="camera-outline" label="카메라" onPress={onCamera}/><ToolAction icon="images-outline" label="갤러리" onPress={onGallery}/><ToolAction icon="rocket-outline" label="탑스페이스" onPress={onTopSpace}/>{showPromotion&&<ToolAction icon="megaphone-outline" label="프로모션" onPress={onPromotion}/>}<ToolAction icon="create-outline" label="새 스토리 작성" onPress={onNewStory}/></View>
    :<ScrollView contentContainerStyle={s.styleTools}><ColorPicker label="채팅 배경" values={backgroundColors.map((color)=>({color,name:'배경',price:0}))} selected={backgroundColor} onSelect={onBackgroundColor}/><ColorPicker label="말풍선 색상" values={BUBBLE_COLOR_PRODUCTS} selected={bubbleColor} onSelect={onBubbleColor}/><ColorPicker label="텍스트 색상" values={TEXT_COLOR_PRODUCTS} selected={textColor} onSelect={onTextColor}/></ScrollView>}
  </View>;
}
function SystemMessage({event,text}:{event:'join'|'heart'|'point'|'leave'|'room'|'kick';text:string}){const icon=event==='heart'?'heart':event==='point'?'cash-outline':event==='join'?'person-add':event==='room'?'information-circle-outline':event==='kick'?'ban-outline':'exit-outline';return <View style={s.systemRow}><View style={s.systemLine}/><View style={s.systemContent}><Ionicons name={icon} size={15} color={event==='heart'?colors.pink600:event==='point'?colors.mint700:colors.textMuted}/><Text style={s.systemText}>{text}</Text></View><View style={s.systemLine}/></View>;}
function MemberActionSheet({member,readOnly=false,secretOpen,onClose,onHeart,onPoint=()=>undefined,onSecret,onProfile,onReport,secretDraft,onSecretDraft,onSendSecret}:{member:string|null;readOnly?:boolean;secretOpen:boolean;onClose:()=>void;onHeart:()=>void;onPoint?:()=>void;onSecret:()=>void;onProfile:()=>void;onReport:()=>void;secretDraft:string;onSecretDraft:(value:string)=>void;onSendSecret:()=>void}){
  if(!member)return null;
  const actions:[IconName,string,()=>void,boolean][]=readOnly?[['person-outline','프로필 보기',onProfile,false],['warning-outline','신고하기',onReport,true]]:[['heart','하트 보내기',onHeart,true],['cash-outline','포인트 보내기',onPoint,false],['mail-outline','비밀 쪽지',onSecret,false],['person-outline','프로필 보기',onProfile,false],['warning-outline','신고하기',onReport,true]];
  return <View style={s.sheetLayer}><Pressable accessibilityLabel="멤버 메뉴 닫기" onPress={onClose} style={s.sheetDim}/><View style={s.memberSheet}><View style={s.sheetHandle}/><View style={s.sheetProfile}><DefaultAvatar size={58}/><Text style={s.sheetName}>{member}</Text></View>{secretOpen?<View style={s.secretComposer}><Text style={s.secretTitle}><Ionicons name="lock-closed" size={13}/> {member}님에게 비밀 쪽지</Text><TextInput autoFocus value={secretDraft} onChangeText={onSecretDraft} placeholder="쪽지 내용을 입력해주세요." placeholderTextColor={colors.textMuted} multiline style={[s.secretInput,Platform.OS==='web'&&({outlineStyle:'none'} as object)]}/><Pressable disabled={!secretDraft.trim()} onPress={onSendSecret} style={[s.secretSend,!secretDraft.trim()&&s.disabled]}><Text style={s.primaryText}>비밀 쪽지 보내기</Text></Pressable></View>:<View style={s.memberActions}>{actions.map(([icon,label,onPress,pink])=><Pressable key={label} onPress={onPress} style={s.memberAction}><View style={[s.memberActionIcon,pink&&s.heartAction]}><Ionicons name={icon} size={23} color={pink?colors.pink600:colors.mint700}/></View><Text style={s.memberActionText}>{label}</Text></Pressable>)}</View>}</View></View>;
}
function ToolAction({icon,label,onPress}:{icon:IconName;label:string;onPress:()=>void}){return <Pressable onPress={onPress} style={s.toolAction}><View style={s.toolIcon}><Ionicons name={icon} size={23} color={colors.mint700}/></View><Text style={s.toolLabel}>{label}</Text></Pressable>;}
function ColorPicker({label,values,selected,onSelect}:{label:string;values:ColorProduct[];selected:string;onSelect:(value:string)=>void}){
  const [customOpen,setCustomOpen]=useState(false);
  const [customSelection,setCustomSelection]=useState(selected);
  const customEnabled=label!=='채팅 배경';
  useEffect(()=>{setCustomSelection(selected);},[selected]);
  const choose=(item:ColorProduct,index:number)=>{
    if(item.price===0){onSelect(item.color);return;}
    Alert.alert(item.name,`${item.price.toLocaleString()}원에 구매하시겠습니까?`,[{text:'취소',style:'cancel'},{text:'구매하기',onPress:async()=>{try{const prefix=label==='말풍선 색상'?'bubble':'text';await purchaseProduct(`mute_${prefix}_color_${String(index).padStart(2,'0')}`);onSelect(item.color);Alert.alert('구매 완료','색상이 적용되었습니다.');}catch(error){Alert.alert('구매 준비 필요',serverErrorMessage(error));}}}]);
  };
  const completeCustomPurchase=async()=>{
    try{
      await purchaseProduct(label==='말풍선 색상'?STORE_PRODUCTS.customBubbleColor:STORE_PRODUCTS.customTextColor);
      onSelect(customSelection);
      setCustomOpen(false);
      Alert.alert('구매 완료','커스텀 색상이 적용되었습니다.');
    }catch(error){Alert.alert('구매 준비 필요',serverErrorMessage(error));}
  };
  return (
    <View style={s.colorLine}>
      <View style={s.colorLabelLine}>
        <Text style={s.colorLabel}>{label}</Text>
      </View>
      <View style={s.colorOptions}>
        {values.map((item,index)=>
          <Pressable
            accessibilityLabel={`${item.name} ${item.price}원`}
            key={`${label}-${item.color}`}
            onPress={()=>choose(item,index)}
            style={[s.colorDot,{backgroundColor:item.color},selected===item.color&&s.colorDotActive]}
          >
            {selected===item.color&&<Ionicons name="checkmark" size={14} color={item.color==='#FFFFFF'?'#1C1C1C':'#FFF'}/>}
          </Pressable>,
        )}
        {customEnabled&&
          <Pressable
            accessibilityLabel={`${label} 커스텀 색상`}
            onPress={()=>{setCustomSelection(selected);setCustomOpen(true);}}
            style={[s.colorDot,s.customColorDot]}
          >
            <Ionicons name="add" size={15} color={colors.textMuted}/>
          </Pressable>}
      </View>
      {customOpen&&
        <View style={s.sheetLayer}>
          <Pressable accessibilityLabel="커스텀 색상 닫기" onPress={()=>setCustomOpen(false)} style={s.sheetDim}/>
          <View style={s.customColorSheet}>
            <View style={s.sheetHandle}/>
            <Text style={s.customColorTitle}>커스텀 색상 선택</Text>
            <ExternalColorPicker
              value={customSelection}
              thumbShape="ring"
              onChangeJS={(colors)=>setCustomSelection(colors.hex)}
              onCompleteJS={(colors)=>setCustomSelection(colors.hex)}
              style={s.customPickerRoot}
            >
              <View style={s.customPickerTopRow}>
                <Panel3 style={s.customPickerWheel}/>
                <View style={[s.customPickerPreviewBar,{backgroundColor:customSelection}]}/>
              </View>
              <BrightnessSlider style={s.customPickerSlider}/>
              <InputWidget
                defaultFormat="RGB"
                formats={['RGB','HEX']}
                disableAlphaChannel
                containerStyle={s.customInputWidget}
                inputStyle={s.customInput}
                inputTitleStyle={s.customInputTitle}
                iconColor={colors.textSubtle}
              />
            </ExternalColorPicker>
            <View style={s.customColorActions}>
              <Pressable onPress={()=>setCustomOpen(false)} style={s.pointSendCancel}>
                <Text style={s.pointSendCancelText}>취소</Text>
              </Pressable>
              <Pressable onPress={completeCustomPurchase} style={s.pointSendButton}>
                <LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.pointSendGradient}>
                  <Text style={s.primaryText}>3,200원 결제</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>}
    </View>
  );
}
function TopSpaceSheet({open,room,points,result,onClose,onBoost}:{open:boolean;room:Room;points:number;expiresAt?:number;remaining:string;result:'success'|'shortage'|null;onClose:()=>void;onBoost:(option:TopSpacePackage)=>Promise<void>}){
  const [selected,setSelected]=useState(TOP_SPACE_PACKAGES[0]);
  if(!open)return null;
  return <View style={s.sheetLayer}><Pressable accessibilityLabel="탑스페이스 닫기" onPress={onClose} style={s.sheetDim}/><View style={s.topSpaceSheet}><View style={s.sheetHandle}/><View style={s.topSpaceTitleLine}><View style={s.topSpaceIcon}><Ionicons name="rocket" size={25} color={colors.mint700}/></View><Text style={s.topSpaceTitle}>{room.name} 탑스페이스</Text></View><View style={s.packageGrid}>{TOP_SPACE_PACKAGES.map((option)=><Pressable accessibilityLabel={`${option.points} 포인트`} key={option.points} onPress={()=>setSelected(option)} style={[s.packageOption,selected.points===option.points&&s.packageOptionActive]}><Text style={[s.packagePoints,selected.points===option.points&&s.packageTextActive]}>{option.points.toLocaleString()} P</Text></Pressable>)}</View>{result&&<Text style={[s.topSpaceResult,result==='shortage'&&s.topSpaceError]}>{result==='success'?'탑스페이스에 올렸습니다.':'포인트가 부족합니다.'}</Text>}<Pressable disabled={points<selected.points} onPress={()=>onBoost(selected)} style={[s.topSpaceButton,points<selected.points&&s.disabled]}><LinearGradient colors={points>=selected.points?['#82B9C1','#5DBB8C']:['#C9D8D5','#BFCAC7']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.topSpaceButtonGradient}><Text style={s.primaryText}>탑스페이스 올리기</Text></LinearGradient></Pressable></View></View>;
}
function ChatDrawer({open,isOwner,isStaff,onClose,onProfileEdit,onApplications,onStories,onOpenMembers,onBlocked,onRoomSettings,onDelete,onLeave}:{open:boolean;isOwner:boolean;isStaff:boolean;onClose:()=>void;onProfileEdit:()=>void;onApplications:()=>void;onStories:()=>void;onOpenMembers:()=>void;onBlocked:()=>void;onRoomSettings:()=>void;onDelete:()=>void;onLeave:()=>void}){
  const slide=useRef(new Animated.Value(340)).current;
  const [visible,setVisible]=useState(open);
  const [notifications,setNotifications]=useState(true);
  useEffect(()=>{
    if(open){
      setVisible(true);
      slide.setValue(340);
      Animated.timing(slide,{toValue:0,duration:230,useNativeDriver:true}).start();
    }else if(visible){
      Animated.timing(slide,{toValue:340,duration:200,useNativeDriver:true}).start(()=>setVisible(false));
    }
  },[open,slide,visible]);
  if(!visible)return null;
  return <View style={s.drawerLayer}><Pressable accessibilityLabel="채팅 메뉴 닫기" onPress={onClose} style={s.drawerDim}/><Animated.View style={[s.chatDrawer,{transform:[{translateX:slide}]}]}>
    <Pressable onPress={onProfileEdit} style={s.drawerProfile}><View style={s.drawerAvatar}><DefaultAvatar size={72}/><View style={s.editDot}><Ionicons name="pencil" size={12} color="#FFF"/></View></View><Text style={s.drawerProfileName}>한걸음</Text><Text numberOfLines={2} style={s.drawerProfileIntro}>자기 소개가 들어가는 공간입니다. 편안한 대화를 좋아해요.</Text></Pressable>
    <View style={s.chatDrawerMenu}>
      <DrawerMenu icon="notifications-outline" title="알림 설정" trailing={<Switch value={notifications} onValueChange={setNotifications} trackColor={{false:colors.gray200,true:colors.mint300}}/>}/>
      {isStaff&&<DrawerMenu icon="person-add-outline" title="가입 신청 목록" onPress={onApplications}/>}
      <DrawerMenu icon="people-outline" title="멤버 관리" onPress={onOpenMembers}/>
      <DrawerMenu icon="albums-outline" title="방 소개 및 스토리 보기" onPress={onStories}/>
      {isOwner&&<DrawerMenu icon="lock-closed-outline" title="방 공개 설정" onPress={onRoomSettings}/>}
      {isStaff&&<DrawerMenu icon="ban-outline" title="차단 멤버 목록" onPress={onBlocked}/>}
      <Pressable onPress={isOwner?onDelete:onLeave} style={s.deleteRoomLink}><Text style={s.deleteRoomText}>{isOwner?'방 삭제하기':'방 나가기'}</Text></Pressable>
    </View>
  </Animated.View></View>;
}
function DrawerMenu({icon,title,onPress,trailing}:{icon:IconName;title:string;onPress?:()=>void;trailing?:React.ReactNode}){return <Pressable onPress={onPress} disabled={!onPress&&!trailing} style={({pressed})=>[s.drawerMenu,pressed&&s.pressed]}><Ionicons name={icon} size={20} color={colors.textSubtle}/><Text style={s.drawerMenuText}>{title}</Text><View style={s.menuTrailing}>{trailing??<Ionicons name="chevron-forward" size={17} color={colors.gray300}/>}</View></Pressable>;}
function NotificationDrawer({open,onClose,onUnreadChange,onNavigate}:{open:boolean;onClose:()=>void;onUnreadChange:(value:boolean)=>void;onNavigate:(notice:Notice)=>void}){
  const slide=useRef(new Animated.Value(340)).current;
  const [visible,setVisible]=useState(open);
  const [confirmAll,setConfirmAll]=useState(false);
  const [notices,setNotices]=useState<Notice[]>([
    {id:'approved',icon:'checkmark-circle-outline',title:'가입 신청 승인',body:'주말 한 장 가입 신청이 승인되었습니다.',time:'12분 전',read:false,roomId:'weekend-photo',destination:'chat'},
    {id:'rejected',icon:'close-circle-outline',title:'가입 신청 거절',body:'자정 라디오 가입 신청이 거절되었습니다.',time:'35분 전',read:false,roomId:'midnight-radio',destination:'chat'},
    {id:'received',icon:'person-add-outline',title:'새 가입 신청',body:'해질녘님이 가입 신청을 보냈습니다.',time:'1시간 전',read:false,roomId:'green-table',destination:'applications'},
    {id:'promotion',icon:'megaphone-outline',title:'뮤트 소식',body:'오늘의 프로모션 방을 확인해 보세요.',time:'2시간 전',read:true,destination:'promotion'},
  ]);
  useEffect(()=>onUnreadChange(notices.some((notice)=>!notice.read)),[notices,onUnreadChange]);
  useEffect(()=>{
    if(open){
      setVisible(true);
      slide.setValue(340);
      Animated.timing(slide,{toValue:0,duration:230,useNativeDriver:true}).start();
    }else if(visible){
      Animated.timing(slide,{toValue:340,duration:190,useNativeDriver:true}).start(()=>setVisible(false));
    }
  },[open,slide,visible]);
  if(!visible)return null;
  const openNotice=(notice:Notice)=>{setNotices((items)=>items.map((item)=>item.id===notice.id?{...item,read:true}:item));onClose();onNavigate(notice);};
  return <View style={s.drawerLayer}><Pressable accessibilityLabel="알림 닫기" onPress={onClose} style={s.drawerDim}/><Animated.View style={[s.drawer,{transform:[{translateX:slide}]}]}><View style={s.drawerHead}><Text style={s.drawerTitle}>알림</Text><Pressable onPress={onClose} style={s.iconButton}><Ionicons name="close" size={24} color={colors.textSubtle}/></Pressable></View><Pressable onPress={()=>setConfirmAll(true)}><Text style={s.readAll}>모두 읽음</Text></Pressable><ScrollView>{notices.map((notice)=><Pressable key={notice.id} onPress={()=>openNotice(notice)} style={[s.drawerNotice,notice.read&&s.drawerNoticeRead]}><View style={[s.notifIcon,notice.read&&s.notifIconRead]}><Ionicons name={notice.icon} size={20} color={notice.read?colors.gray300:colors.mint700}/></View><View style={s.flex}><Text style={[s.notifTitle,notice.read&&s.notifTitleRead]}>{notice.title}</Text><Text style={s.notifBody}>{notice.body}</Text><Text style={s.notifTime}>{notice.time}</Text></View></Pressable>)}</ScrollView>{confirmAll&&<View style={s.confirmLayer}><View style={s.confirmCard}><Text style={s.confirmTitle}>모두 읽음 처리하시겠습니까?</Text><View style={s.confirmActions}><Pressable onPress={()=>setConfirmAll(false)} style={s.confirmCancel}><Text style={s.confirmCancelText}>아니요</Text></Pressable><Pressable onPress={()=>{setNotices((items)=>items.map((item)=>({...item,read:true})));setConfirmAll(false);}} style={s.confirmAccept}><LinearGradient colors={['#82B9C1','#5DBB8C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.confirmAcceptGradient}><Text style={s.primaryText}>예</Text></LinearGradient></Pressable></View></View></View>}</Animated.View></View>;
}
function IconButton({name,color,onPress,size=23}:{name:IconName;color:string;onPress:()=>void;size?:number}){return <Pressable accessibilityLabel={name==='search'?'검색':name} onPress={onPress} style={size<23?s.headerIconButton:s.iconButton}><Ionicons name={name} size={size} color={color}/></Pressable>;}
function IconCircle({name,onPress,active=false}:{name:IconName;onPress?:()=>void;active?:boolean}){return <Pressable accessibilityLabel={name} onPress={onPress} style={[s.iconCircle,active&&s.iconCircleActive]}><Ionicons name={name} size={22} color={active?colors.mint700:colors.textSubtle}/></Pressable>;}
function Badge({text,pink}:{text:string;pink?:boolean}){return <Text style={[s.badge,pink&&s.badgePink]}>{text}</Text>;}
function Count({value}:{value:number}){return <Text style={s.count}>{value}</Text>;}
function Card({title,action,children}:{title:string;action?:string;children:React.ReactNode}){return <View style={s.card}><View style={s.cardHead}><Text style={s.cardTitle}>{title}</Text>{action&&<Text style={s.cardAction}>{action}</Text>}</View>{children}</View>;}
function Menu({icon,title,value,trailing,danger,onPress}:{icon:IconName;title:string;value?:string;trailing?:React.ReactNode;danger?:boolean;onPress?:()=>void}){return <Pressable onPress={onPress} disabled={!onPress&&!trailing} style={s.menu}><Ionicons name={icon} size={19} color={danger?colors.pink600:colors.textSubtle}/><Text style={[s.menuTitle,danger&&s.danger]}>{title}</Text>{value&&<Text style={s.menuValue}>{value}</Text>}<View style={s.menuTrailing}>{trailing??(!value&&<Ionicons name="chevron-forward" size={17} color={colors.gray300}/>)}</View></Pressable>;}
function Field({label,value,onChange,placeholder,multiline}:{label:string;value:string;onChange:(v:string)=>void;placeholder:string;multiline?:boolean}){return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} multiline={multiline} style={[s.input,multiline&&s.textarea]}/></View>;}
function LimitedField({label,value,onChange,placeholder,limit,multiline}:{label:string;value:string;onChange:(v:string)=>void;placeholder:string;limit:number;multiline?:boolean}){return <View style={s.field}><View style={s.fieldHead}><Text style={s.fieldLabel}>{label}</Text><Text style={s.fieldCounter}>{value.length}/{limit}</Text></View><TextInput value={value} maxLength={limit} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} multiline={multiline} style={[s.input,multiline&&s.textarea,Platform.OS==='web'&&({outlineStyle:'none'} as object)]}/></View>;}
function Empty({title,body}:{title:string;body:string}){return <View style={s.empty}><Ionicons name="chatbubbles-outline" size={42} color={colors.gray300}/><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyBody}>{body}</Text></View>;}

const s=StyleSheet.create({
  ownerProfileBlock:{marginTop:24,padding:18,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:colors.gray050},
  ownerProfileTitle:{fontSize:15,fontWeight:'700',color:colors.text},
  ownerProfileAvatar:{position:'relative',alignSelf:'center',marginTop:14,marginBottom:2},
  centerState:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:30},
  centerStateText:{color:colors.textMuted,fontSize:11},
  rewardSection:{gap:12,marginTop:18},
  rewardButton:{height:72,borderRadius:24,overflow:'hidden',...shadows.soft},
  rewardButtonDisabled:{opacity:.72},
  rewardGradient:{flex:1,alignItems:'center',justifyContent:'center'},
  rewardTitle:{color:'#FFF',fontSize:14,fontWeight:'800'},
  rewardPoints:{color:'rgba(255,255,255,.86)',fontSize:11,marginTop:5},
  storePage:{padding:18,gap:11},
  storeCard:{minHeight:86,flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#FFF',borderRadius:18,padding:15,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},
  storeIcon:{width:48,height:48,borderRadius:16,backgroundColor:colors.mint050,alignItems:'center',justifyContent:'center'},
  storeTitle:{color:colors.text,fontSize:14,fontWeight:'800'},
  storeBody:{color:colors.textMuted,fontSize:10,lineHeight:15,marginTop:4},
  storePrice:{color:colors.mint700,fontSize:11,fontWeight:'800'},
  verificationPage:{flex:1,padding:24,alignItems:'center',justifyContent:'center'},
  verificationIcon:{width:72,height:72,borderRadius:24,backgroundColor:colors.mint050,alignItems:'center',justifyContent:'center'},
  verificationTitle:{color:colors.text,fontSize:20,fontWeight:'800',marginTop:20},
  verificationBody:{color:colors.textMuted,fontSize:12,lineHeight:20,textAlign:'center',marginTop:12,marginBottom:26},
  verificationRefresh:{height:46,alignItems:'center',justifyContent:'center',paddingHorizontal:20,marginTop:10},
  verificationRefreshText:{color:colors.mint700,fontSize:12,fontWeight:'700'},
  readOnlyBanner:{height:34,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:colors.mint050,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  readOnlyText:{color:colors.mint700,fontSize:10,fontWeight:'700'},
  storyInlineBack:{height:48,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:14,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  storyInlineBackText:{color:colors.textSubtle,fontSize:12,fontWeight:'700'},
  commentDelete:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray050},
  headerIconButton:{width:32,height:32,alignItems:'center',justifyContent:'center'},
  muteLogoCompact:{height:24},
  muteLogoSymbolCompact:{width:25,height:18},
  mainHeaderLogoWrap:{paddingLeft:12,marginRight:12,justifyContent:'center'},
  joinAvatar:{width:82,height:82,borderRadius:41},
  memberRoleAction:{height:54,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  memberRoleActionText:{color:colors.text,fontSize:13,fontWeight:'700'},
  pinnedLabel:{color:colors.mint700,fontSize:9,fontWeight:'800',paddingHorizontal:5},
  topActions:{flexDirection:'row',alignItems:'center'},
  chatSearchBar:{height:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  chatSearchInput:{flex:1,height:38,color:colors.text,fontSize:13},
  chatSearchCount:{color:colors.mint700,fontSize:11,fontWeight:'700'},
  chatSearchNav:{width:30,height:38,alignItems:'center',justifyContent:'center'},
  searchMessageActive:{backgroundColor:'rgba(93,187,140,.12)',borderRadius:14},
  searchBubbleActive:{backgroundColor:'rgba(93,187,140,.18)',borderColor:'rgba(93,187,140,.45)',borderWidth:1},
  privateRoomLock:{marginRight:1},
  replyQuote:{borderLeftWidth:3,borderLeftColor:colors.mint600,paddingLeft:8,marginBottom:7,maxWidth:210},
  replyQuoteName:{color:colors.mint700,fontSize:10,fontWeight:'800'},
  replyQuoteText:{color:colors.textMuted,fontSize:10,marginTop:2},
  replyComposer:{minHeight:54,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:15,paddingVertical:8,backgroundColor:'#FFF',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},
  replyComposerName:{color:colors.mint700,fontSize:11,fontWeight:'800'},
  replyComposerText:{color:colors.textMuted,fontSize:11,marginTop:3},
  pointSendSheet:{position:'absolute',left:18,right:18,bottom:24,borderRadius:24,backgroundColor:'#FFF',padding:18,...shadows.floating},
  pointSendTitle:{color:colors.text,fontSize:17,fontWeight:'800'},
  pointSendBody:{color:colors.textMuted,fontSize:11,lineHeight:17,marginTop:7},
  pointSendInput:{height:48,borderRadius:14,backgroundColor:colors.gray050,borderWidth:1,borderColor:colors.border,paddingHorizontal:14,color:colors.text,fontSize:15,fontWeight:'700',marginTop:16},
  pointSendActions:{flexDirection:'row',alignItems:'center',gap:10,marginTop:14},
  pointSendCancel:{flex:1,height:46,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray050},
  pointSendCancelText:{color:colors.textSubtle,fontSize:12,fontWeight:'800'},
  pointSendButton:{flex:1,height:46,borderRadius:14,overflow:'hidden'},
  pointSendGradient:{flex:1,alignItems:'center',justifyContent:'center'},
  expandMessage:{color:colors.text,fontSize:11,fontWeight:'500',marginTop:6},
  imageGrid:{width:220,flexDirection:'row',flexWrap:'wrap',gap:2},
  imageGridSingle:{width:220},
  imageGridItem:{width:109,height:109,overflow:'hidden',backgroundColor:colors.gray100},
  imageGridItemSingle:{width:220,height:220},
  imageGridImage:{width:'100%',height:'100%',resizeMode:'cover'},
  gifBadge:{position:'absolute',right:6,bottom:6,paddingHorizontal:6,paddingVertical:3,borderRadius:5,backgroundColor:'rgba(0,0,0,.58)'},
  gifBadgeText:{color:'#FFF',fontSize:9,fontWeight:'800'},
  storyVisibility:{height:52,flexDirection:'row',alignItems:'center',paddingHorizontal:15,gap:8,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  storyVisibilityLabel:{color:colors.textSubtle,fontSize:11,fontWeight:'700',marginRight:'auto'},
  visibilityOption:{height:32,paddingHorizontal:10,borderRadius:16,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:colors.gray050,borderWidth:1,borderColor:colors.border},
  visibilityOptionActive:{backgroundColor:colors.mint050,borderColor:colors.mint300},
  visibilityText:{color:colors.textSubtle,fontSize:10,fontWeight:'700'},
  publicStoryList:{paddingBottom:100,backgroundColor:'#FFF'},publicStoryHeader:{minHeight:74,justifyContent:'center',paddingHorizontal:20,paddingVertical:12,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},publicStoryHeaderText:{color:colors.text,fontSize:15,fontWeight:'800'},storySortRow:{flexDirection:'row',gap:16,marginTop:11},storySortText:{color:colors.textMuted,fontSize:10,fontWeight:'600'},storySortTextActive:{color:colors.mint700,fontWeight:'800'},publicStoryCard:{paddingHorizontal:20,paddingVertical:18,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},publicStoryPressed:{backgroundColor:colors.gray050},publicStoryMain:{flexDirection:'row',alignItems:'flex-start',gap:14},publicStoryCopy:{flex:1,minWidth:0},publicStoryTitle:{color:colors.text,fontSize:16,fontWeight:'800',lineHeight:22},publicStoryAuthor:{flexDirection:'row',alignItems:'center',gap:9},publicStoryAuthorName:{color:colors.text,fontSize:12,fontWeight:'800'},publicStoryMeta:{color:colors.mint700,fontSize:9},publicStoryBody:{color:colors.textSubtle,fontSize:12,lineHeight:18,marginTop:7},publicStoryStats:{flexDirection:'row',alignItems:'center',gap:7,marginTop:11},publicStoryStat:{color:colors.textMuted,fontSize:9},publicStoryThumbnail:{width:82,height:82,borderRadius:13,backgroundColor:colors.gray100},publicStoryComment:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:colors.gray050,borderRadius:10,paddingHorizontal:10,paddingVertical:8,marginTop:13},publicStoryCommentName:{color:colors.text,fontSize:10,fontWeight:'800'},publicStoryCommentBody:{flex:1,color:colors.textMuted,fontSize:10},
  topPlaceholder:{borderRadius:18,backgroundColor:'#FFF',paddingHorizontal:16,paddingVertical:18,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},
  topPlaceholderText:{color:colors.textMuted,fontSize:12,lineHeight:18},
  departedMember:{minHeight:70,flexDirection:'row',alignItems:'center',gap:11,padding:12,borderRadius:14,backgroundColor:'#FFF',marginBottom:8},
  blockButton:{paddingHorizontal:10,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:colors.border},
  blockButtonActive:{backgroundColor:colors.mint050,borderColor:colors.mint300},
  blockButtonText:{color:colors.pink600,fontSize:10,fontWeight:'700'},
  blockButtonTextActive:{color:colors.mint700},
  memberDiscipline:{flexDirection:'row',gap:8,marginTop:12},
  kickButton:{flex:1,height:42,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray100},
  kickButtonText:{color:colors.textSubtle,fontSize:12,fontWeight:'700'},
  banButton:{flex:1.6,height:42,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.pink050},
  banButtonText:{color:colors.pink600,fontSize:12,fontWeight:'800'},
  visibilityRows:{flexDirection:'row',gap:10},
  accessSettings:{padding:20,gap:18},
  accessTitle:{color:colors.text,fontSize:18,fontWeight:'800'},
  accessBody:{color:colors.textSubtle,fontSize:12,lineHeight:19},
  visibilityCard:{flex:1,minHeight:70,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:'#FFF',padding:12,flexDirection:'row',alignItems:'center',gap:9},
  visibilityCardActive:{borderColor:colors.mint600,backgroundColor:colors.mint050},
  visibilityCardTitle:{color:colors.text,fontSize:12,fontWeight:'800'},
  visibilityCardText:{color:colors.textMuted,fontSize:9,marginTop:3},
  pinError:{color:colors.pink600,fontSize:10,marginTop:6},
  authScreen:{flex:1,backgroundColor:'#FFF',justifyContent:'center'},
  authSplash:{flex:1,alignItems:'center',justifyContent:'center',gap:14},
  authSplashText:{color:'rgba(255,255,255,.86)',fontSize:13,fontWeight:'600'},
  authCard:{marginHorizontal:24,padding:24,borderRadius:24,backgroundColor:'#FFF',gap:14,...shadows.floating},
  authTitle:{marginTop:10,color:colors.text,fontSize:22,fontWeight:'800'},
  authBody:{color:colors.textSubtle,fontSize:13,lineHeight:20},
  authInput:{height:52,borderRadius:14,backgroundColor:colors.gray050,borderWidth:1,borderColor:colors.border,paddingHorizontal:16,color:colors.text,fontSize:17,letterSpacing:.4},
  authScroll:{flexGrow:1,justifyContent:'center',paddingVertical:24},
  authPhoneRow:{flexDirection:'row',alignItems:'center',gap:8},
  authPhoneInput:{flex:1,minWidth:0},
  authInputVerified:{color:colors.textMuted,backgroundColor:colors.gray100},
  authVerifyButton:{height:52,minWidth:82,paddingHorizontal:12,borderRadius:14,backgroundColor:colors.mint050,borderWidth:1,borderColor:colors.mint600,alignItems:'center',justifyContent:'center'},
  authVerifyButtonDisabled:{backgroundColor:colors.gray100,borderColor:colors.gray200},
  authVerifyText:{color:colors.mint700,fontSize:12,fontWeight:'800'},
  authVerifyTextDisabled:{color:colors.textMuted},
  authSignupReveal:{overflow:'hidden',gap:12},
  authPinHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:2},
  authPinLabel:{color:colors.textSubtle,fontSize:12,fontWeight:'700'},
  authPinLine:{position:'relative',flexDirection:'row',alignItems:'center',gap:8},
  authPinInput:{flex:1,minWidth:0,letterSpacing:5},
  authPinButton:{height:52,minWidth:62,paddingHorizontal:12,borderRadius:14,backgroundColor:colors.mint050,borderWidth:1,borderColor:colors.mint600,alignItems:'center',justifyContent:'center'},
  authVerifying:{flexDirection:'row',alignItems:'center',gap:6},
  authOtpError:{color:colors.pink600,fontSize:10,fontWeight:'700',marginTop:-6,marginLeft:4},
  authTimer:{color:colors.mint700,fontSize:12,fontWeight:'800'},
  authTimerExpired:{color:colors.pink600},
  authPasswordHint:{color:colors.mint700,fontSize:10,marginTop:-5},
  authPasswordMismatch:{color:colors.pink600},
  authInlineNotice:{color:colors.mint700,fontSize:10,fontWeight:'700',marginTop:-8,marginLeft:4},
  authBack:{height:40,alignItems:'center',justifyContent:'center'},
  authBackText:{color:colors.mint700,fontSize:12,fontWeight:'700'},
  safe:{flex:1,backgroundColor:colors.background,overflow:'hidden'},flex:{flex:1,minWidth:0},mainHeader:{height:48,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'rgba(255,255,255,.25)'},headerActions:{flexDirection:'row',alignItems:'center'},searchArea:{paddingHorizontal:14,paddingVertical:9,backgroundColor:'#FFF'},muteLogo:{height:44,flexDirection:'row',alignItems:'center',gap:9},muteLogoSymbol:{width:38,height:28},muteLogoMark:{width:50,height:36},muteName:{color:colors.text,fontSize:16,fontWeight:'800',lineHeight:17,letterSpacing:-.3},muteEnglish:{color:colors.textMuted,fontSize:8,fontWeight:'700',letterSpacing:.8,marginTop:1},muteNameWhite:{color:'#FFF'},iconButton:{width:42,height:42,alignItems:'center',justifyContent:'center'},searchBox:{height:44,borderRadius:22,backgroundColor:'#FFF',flexDirection:'row',alignItems:'center',paddingHorizontal:15,gap:9,...shadows.soft},searchInput:{flex:1,color:colors.text,fontSize:14,paddingVertical:0},
  tabs:{height:48,flexDirection:'row',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},tab:{flex:1,alignItems:'center',justifyContent:'center'},tabText:{color:colors.textMuted,fontSize:12,fontWeight:'600'},tabTextActive:{color:colors.mint700,fontWeight:'700'},tabIndicator:{position:'absolute',bottom:0,width:26,height:3,borderRadius:2,backgroundColor:colors.mint600},
  list:{paddingBottom:100},sectionLabel:{height:44,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF'},sectionTitle:{color:colors.text,fontSize:17,fontWeight:'500'},sectionActionButton:{height:32,flexDirection:'row',alignItems:'center',gap:2},sectionAction:{color:colors.mint700,fontSize:11,fontWeight:'500'},listHeader:{paddingHorizontal:20,paddingTop:20,paddingBottom:10,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},listTitle:{color:colors.text,fontSize:18,fontWeight:'700'},listSub:{color:colors.textMuted,fontSize:11,marginTop:4},count:{color:colors.mint700,backgroundColor:colors.mint050,minWidth:28,height:28,borderRadius:14,textAlign:'center',lineHeight:28,fontSize:11,fontWeight:'700'},
  roomRow:{height:92,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',paddingHorizontal:20,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},pressed:{backgroundColor:colors.gray050},roomImage:{backgroundColor:'#F0F1F1',alignItems:'center',justifyContent:'center',flexShrink:0},roomInfo:{flex:1,paddingHorizontal:13,paddingVertical:11},nameLine:{flexDirection:'row',alignItems:'center',gap:6},roomName:{maxWidth:'65%',color:colors.text,fontSize:15,fontWeight:'700'},roomDesc:{color:colors.textSubtle,fontSize:12,marginTop:4},metaLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:7},metaGroup:{flexDirection:'row',alignItems:'center',gap:3},meta:{color:colors.textMuted,fontSize:10},topSpaceRemaining:{color:colors.mint700,fontWeight:'700'},topSpaceGaugeTrack:{width:72,height:7,borderRadius:4,overflow:'hidden',backgroundColor:colors.gray100},topSpaceGaugeFill:{height:'100%',borderRadius:4},joined:{color:colors.mint700,fontSize:10,fontWeight:'700'},hash:{color:colors.textMuted,fontSize:10},badge:{color:colors.mint700,backgroundColor:colors.mint050,borderRadius:6,paddingHorizontal:6,paddingVertical:3,overflow:'hidden',fontSize:9,fontWeight:'700'},badgePink:{color:colors.pink600,backgroundColor:colors.pink050},
  fab:{position:'absolute',right:20,bottom:126,width:52,height:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:colors.mint600,...shadows.floating},bottomNav:{position:'absolute',left:0,right:0,bottom:0,height:112,paddingBottom:28,flexDirection:'row',backgroundColor:'#FFF',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,...shadows.nav},navItem:{flex:1,alignItems:'center',justifyContent:'flex-start',paddingTop:14,gap:3},navText:{color:colors.textMuted,fontSize:10},navActive:{color:colors.mint700,fontWeight:'700'},
  topBar:{height:58,flexDirection:'row',alignItems:'center',paddingHorizontal:8},topCenter:{flex:1,alignItems:'center'},topTitleLine:{flexDirection:'row',alignItems:'baseline',justifyContent:'center',gap:6},topTitle:{color:'#FFF',fontSize:16,fontWeight:'700',maxWidth:220},topInlineCount:{color:'rgba(255,255,255,.88)',fontSize:11,fontWeight:'600'},topSub:{color:'rgba(255,255,255,.82)',fontSize:10,marginTop:2},topSide:{width:44,height:44,alignItems:'center',justifyContent:'center'},profileTabs:{height:45,flexDirection:'row',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},profileTab:{flex:1,alignItems:'center',justifyContent:'center'},profileTabText:{color:colors.textMuted,fontSize:12,fontWeight:'600'},profileTabActive:{color:colors.mint700,fontWeight:'700'},profileTabLine:{position:'absolute',bottom:0,width:45,height:2,backgroundColor:colors.mint600},spaceProfile:{paddingBottom:116,backgroundColor:'#FFF'},defaultCover:{height:230,backgroundColor:'#DADDDC',alignItems:'center',justifyContent:'center'},coverMeta:{alignSelf:'center',marginTop:-15,height:30,borderRadius:15,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'rgba(45,48,47,.76)'},coverMetaText:{color:'#FFF',fontSize:10},spaceIntro:{marginHorizontal:16,marginTop:16,padding:18,borderRadius:20,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},spaceEyebrow:{color:colors.mint700,fontSize:9,fontWeight:'800',letterSpacing:1.2},spaceTitle:{color:colors.text,fontSize:21,fontWeight:'800',marginTop:7},detailMetaRow:{flexDirection:'row',alignItems:'center',gap:14,marginTop:10,marginBottom:14},detailMetaItem:{flexDirection:'row',alignItems:'center',gap:5},detailMetaText:{color:colors.textMuted,fontSize:10,fontWeight:'600'},gradientTags:{color:colors.mint700,fontSize:12,fontWeight:'700',marginBottom:11},spaceBody:{color:colors.textSubtle,fontSize:13,lineHeight:21},memberSectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:23,paddingBottom:12},memberSectionTitle:{color:colors.text,fontSize:16,fontWeight:'800'},memberSectionCount:{color:colors.mint700,fontSize:11,fontWeight:'800'},hostBlock:{flexDirection:'row',alignItems:'center',marginHorizontal:16,padding:16,borderRadius:18,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},hostAvatar:{position:'relative'},hostCopy:{flex:1,marginLeft:15},hostNameLine:{flexDirection:'row',alignItems:'center',gap:7},crown:{position:'absolute',right:0,bottom:2,width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.mint600,borderWidth:2,borderColor:'#FFF'},hostName:{color:colors.text,fontSize:15,fontWeight:'800'},hostIntro:{color:colors.textMuted,fontSize:10,lineHeight:15,marginTop:6},memberPreview:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,paddingTop:18,paddingBottom:24},memberPreviewItem:{width:54,alignItems:'center'},memberMore:{width:48,height:48,borderRadius:24,backgroundColor:colors.gray100,alignItems:'center',justifyContent:'center'},memberMoreText:{color:colors.textMuted,fontSize:11,fontWeight:'800'},gridName:{color:colors.textSubtle,fontSize:10,marginTop:6},detailSticky:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:20,paddingTop:12,paddingBottom:18,backgroundColor:'rgba(255,255,255,.96)',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},detailJoinButton:{height:52,borderRadius:16,overflow:'hidden',...shadows.soft},detailJoinGradient:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},pendingButton:{height:52,borderRadius:16,backgroundColor:colors.gray100,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},pendingText:{color:colors.textSubtle,fontSize:12,fontWeight:'700'},joinForm:{padding:20,paddingBottom:110},joinProfile:{alignSelf:'center',position:'relative',marginTop:8,marginBottom:8},editDot:{position:'absolute',right:0,bottom:0,width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:colors.mint600,borderWidth:2,borderColor:'#FFF'},counter:{color:colors.textMuted,fontSize:10,textAlign:'right',marginTop:5},detailScroll:{padding:20,paddingBottom:130},hero:{alignItems:'center',paddingVertical:12},heroTitle:{color:colors.text,fontSize:22,fontWeight:'700',marginTop:14},heroMeta:{color:colors.textMuted,fontSize:11,marginTop:5},tagRow:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6,marginTop:12},tag:{color:colors.mint700,backgroundColor:colors.mint050,paddingHorizontal:9,paddingVertical:5,borderRadius:8,fontSize:11},
  card:{backgroundColor:'#FFF',borderRadius:18,padding:20,marginTop:14,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.card},cardHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:12},cardTitle:{color:colors.text,fontSize:14,fontWeight:'700'},cardAction:{color:colors.mint700,fontSize:11,fontWeight:'600'},body:{color:colors.textSubtle,fontSize:13,lineHeight:21,marginBottom:5},avatarRow:{flexDirection:'row'},avatar:{flexShrink:0,backgroundColor:'#E7E9E8',alignItems:'center',justifyContent:'flex-end',overflow:'hidden',borderWidth:2,borderColor:'#FFF'},avatarMore:{width:44,height:44,borderRadius:22,marginLeft:-9,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray100,borderWidth:2,borderColor:'#FFF'},avatarMoreText:{color:colors.textMuted,fontSize:10,fontWeight:'700'},notice:{flexDirection:'row',gap:11,backgroundColor:colors.mint050,padding:15,borderRadius:13,marginTop:14},noticeTitle:{color:colors.mint800,fontSize:12,fontWeight:'700'},noticeText:{color:colors.textSubtle,fontSize:11,marginTop:3},sticky:{position:'absolute',left:0,right:0,bottom:0,padding:14,paddingHorizontal:20,backgroundColor:'rgba(250,250,250,.97)',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},primary:{height:50,borderRadius:13,backgroundColor:colors.mint600,alignItems:'center',justifyContent:'center'},disabled:{backgroundColor:colors.gray200},primaryText:{color:'#FFF',fontSize:14,fontWeight:'700'},hint:{color:colors.textMuted,fontSize:10,textAlign:'center',marginTop:6},
  chatTabs:{height:44,flexDirection:'row',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},chatTab:{flex:1,alignItems:'center',justifyContent:'center'},chatTabText:{color:colors.textMuted,fontSize:12,fontWeight:'600'},chatTabActive:{color:colors.mint700,fontWeight:'700'},chatIndicator:{position:'absolute',bottom:0,width:38,height:2,backgroundColor:colors.mint600},messages:{padding:20,paddingBottom:28,maxWidth:'100%'},date:{alignSelf:'center',color:colors.textMuted,fontSize:10,marginBottom:15},system:{alignSelf:'center',maxWidth:'90%',color:colors.textMuted,fontSize:10,backgroundColor:colors.gray100,borderRadius:12,paddingHorizontal:12,paddingVertical:6,overflow:'hidden',marginBottom:22},messageRow:{flexDirection:'row',alignItems:'flex-start',marginBottom:17,maxWidth:'100%',minWidth:0},mineRow:{justifyContent:'flex-end'},messageBlock:{maxWidth:'76%',minWidth:0,flexShrink:1,marginLeft:8},sender:{color:colors.textSubtle,fontSize:11,fontWeight:'600',marginBottom:5},bubbleLine:{flexDirection:'row',alignItems:'flex-end',gap:5,maxWidth:'100%',minWidth:0,flexShrink:1},bubble:{borderRadius:12,paddingHorizontal:13,paddingVertical:9,maxWidth:'100%',minWidth:0,flexShrink:1},imageBubble:{padding:0,overflow:'hidden'},mineBubble:{backgroundColor:'#F5F5F5',borderBottomRightRadius:4},otherBubble:{backgroundColor:'#F5F5F5',borderBottomLeftRadius:4},messageText:{color:colors.text,fontSize:14,lineHeight:20,flexShrink:1},mineText:{color:colors.text},chatImage:{width:140,height:140,borderRadius:12,resizeMode:'cover'},time:{minWidth:38,maxWidth:42,color:colors.textMuted,fontSize:9,marginBottom:2,flexShrink:0},composerPanel:{overflow:'hidden',backgroundColor:'#FFF',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},toolRow:{flex:1,flexDirection:'row',alignItems:'center',paddingHorizontal:15,gap:18},toolAction:{alignItems:'center',gap:5},toolIcon:{width:48,height:48,borderRadius:24,backgroundColor:colors.mint050,alignItems:'center',justifyContent:'center'},toolLabel:{color:colors.textSubtle,fontSize:10,fontWeight:'600'},styleTools:{paddingHorizontal:18,paddingVertical:14,gap:15},colorLine:{gap:8},colorLabelLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},colorLabel:{color:colors.textSubtle,fontSize:11,fontWeight:'700'},customColorLink:{color:colors.mint700,fontSize:10,fontWeight:'800'},colorOptions:{flexDirection:'row',flexWrap:'wrap',gap:10},colorDot:{width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},colorDotActive:{borderWidth:2,borderColor:colors.mint700},composer:{minHeight:58,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FFF',paddingHorizontal:9,paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},iconCircle:{width:34,height:34,borderRadius:17,backgroundColor:colors.gray100,alignItems:'center',justifyContent:'center'},iconCircleActive:{backgroundColor:colors.mint050},composerInput:{flex:1,minWidth:0,height:40,borderRadius:20,backgroundColor:colors.gray050,paddingHorizontal:13,color:colors.text,fontSize:13},send:{width:36,height:36,borderRadius:18,overflow:'hidden'},sendGradient:{flex:1,alignItems:'center',justifyContent:'center'},
  panel:{padding:20,paddingBottom:40},panelHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:15},panelTitle:{color:colors.text,fontSize:20,fontWeight:'700'},writeButton:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:colors.mint600,borderRadius:8,paddingHorizontal:11,paddingVertical:8},writeText:{color:'#FFF',fontSize:11,fontWeight:'700'},story:{backgroundColor:'#FFF',borderRadius:18,padding:16,marginBottom:11,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border},storyTop:{flexDirection:'row',justifyContent:'space-between'},storyTime:{color:colors.textMuted,fontSize:10,lineHeight:16,marginTop:3},storyTitle:{color:colors.text,fontSize:15,fontWeight:'600',marginTop:10},storyBody:{color:colors.textSubtle,fontSize:12,lineHeight:18,marginTop:5},storyMeta:{color:colors.textMuted,fontSize:10,marginTop:13},myProfile:{flexDirection:'row',alignItems:'center',backgroundColor:colors.mint050,borderRadius:18,padding:14,marginBottom:20},memberPanel:{padding:16,paddingBottom:40},memberLabel:{color:colors.textMuted,fontSize:11,fontWeight:'700',marginHorizontal:4,marginBottom:10},memberCard:{minHeight:84,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:17,paddingHorizontal:16,paddingVertical:14,marginBottom:10,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},memberCardBody:{flex:1,marginLeft:16},memberTitleLine:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},memberName:{color:colors.text,fontSize:13,fontWeight:'700'},memberIntro:{color:colors.textMuted,fontSize:10,lineHeight:15,marginTop:5},permissionTags:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:9},permissionTag:{color:colors.mint700,backgroundColor:colors.mint050,borderRadius:7,paddingHorizontal:7,paddingVertical:4,overflow:'hidden',fontSize:9,fontWeight:'700'},
  page:{padding:20,paddingBottom:100},pageTitle:{color:colors.text,fontSize:22,fontWeight:'700',marginBottom:16},notificationBadge:{position:'absolute',right:3,top:3,minWidth:17,height:17,borderRadius:9,paddingHorizontal:4,alignItems:'center',justifyContent:'center',backgroundColor:'#FF3D5A',borderWidth:0},notificationBadgeInline:{position:'relative',right:0,top:0,minWidth:19,height:19,borderRadius:10,borderWidth:0},notificationBadgeText:{color:'#FFF',fontSize:8,fontWeight:'800'},drawerLayer:{...StyleSheet.absoluteFill,zIndex:50,flexDirection:'row'},drawerDim:{flex:1,backgroundColor:'rgba(20,23,22,.28)'},drawer:{width:'84%',maxWidth:340,backgroundColor:'#FFF',...shadows.floating},chatDrawer:{width:'87%',maxWidth:340,backgroundColor:'#FFF',...shadows.floating},drawerProfile:{alignItems:'center',paddingHorizontal:24,paddingTop:52,paddingBottom:32,borderBottomWidth:8,borderBottomColor:colors.gray050},drawerAvatar:{position:'relative'},drawerProfileName:{color:colors.text,fontSize:16,fontWeight:'800',marginTop:11},drawerProfileIntro:{color:colors.textMuted,fontSize:11,lineHeight:17,textAlign:'center',marginTop:6},chatDrawerMenu:{paddingHorizontal:15,paddingTop:18},drawerMenu:{height:58,flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},drawerMenuText:{flex:1,color:colors.text,fontSize:13,fontWeight:'600'},drawerHead:{height:58,paddingLeft:20,paddingRight:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},drawerTitle:{color:colors.text,fontSize:18,fontWeight:'800'},readAll:{alignSelf:'flex-end',color:colors.mint700,fontSize:10,fontWeight:'700',paddingHorizontal:20,paddingTop:14},drawerNotice:{minHeight:86,flexDirection:'row',gap:12,paddingHorizontal:18,paddingVertical:15,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},notification:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#FFF',paddingVertical:15,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},notifIcon:{width:40,height:40,borderRadius:20,backgroundColor:colors.mint050,alignItems:'center',justifyContent:'center'},notifTitle:{color:colors.text,fontSize:13,fontWeight:'700'},notifBody:{color:colors.textMuted,fontSize:10,marginTop:4,lineHeight:15},notifTime:{color:colors.textMuted,fontSize:9,marginTop:7},profileHero:{alignItems:'center',paddingVertical:15},profileName:{color:colors.text,fontSize:20,fontWeight:'700',marginTop:12},profilePhone:{color:colors.textMuted,fontSize:11,marginTop:5},pointCard:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:18,padding:18,marginTop:10,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},pointLabel:{color:colors.textMuted,fontSize:10},pointValue:{color:colors.text,fontSize:20,fontWeight:'500',marginTop:4},pointButton:{backgroundColor:colors.mint050,borderRadius:10,paddingHorizontal:15,paddingVertical:9},pointButtonText:{color:colors.mint700,fontSize:11,fontWeight:'700'},settingsLink:{height:54,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#FFF',borderRadius:13,paddingHorizontal:15,marginTop:13,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border},settingsText:{flex:1,color:colors.text,fontSize:13,fontWeight:'600'},
  form:{padding:20,paddingBottom:120},upload:{height:150,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray100,borderRadius:18,borderWidth:1,borderStyle:'dashed',borderColor:colors.gray300},uploadTitle:{color:colors.textSubtle,fontSize:13,fontWeight:'700',marginTop:8},uploadHint:{color:colors.textMuted,fontSize:10,marginTop:4},field:{marginTop:20},fieldLabel:{color:colors.text,fontSize:12,fontWeight:'700',marginBottom:8},input:{height:48,borderRadius:13,backgroundColor:'#FFF',borderWidth:1,borderColor:colors.border,paddingHorizontal:14,color:colors.text,fontSize:13},textarea:{height:105,paddingTop:13,textAlignVertical:'top'},capacityRow:{flexDirection:'row',gap:8},capacity:{flex:1,height:42,borderRadius:11,backgroundColor:'#FFF',borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},capacityActive:{backgroundColor:colors.mint050,borderColor:colors.mint600},capacityText:{color:colors.textMuted,fontSize:11,fontWeight:'600'},capacityTextActive:{color:colors.mint700,fontWeight:'800'},fakeField:{height:48,borderRadius:13,backgroundColor:'#FFF',borderWidth:1,borderColor:colors.border,paddingHorizontal:14,justifyContent:'center'},fakeText:{color:colors.mint700,fontSize:12},
  settings:{padding:20,paddingBottom:40},groupLabel:{color:colors.textMuted,fontSize:10,fontWeight:'600',marginTop:12,marginBottom:7,marginLeft:3},menuGroup:{backgroundColor:'#FFF',borderRadius:18,paddingHorizontal:14,marginBottom:12,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border},menu:{minHeight:55,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},menuTitle:{flex:1,color:colors.text,fontSize:13,fontWeight:'600'},menuValue:{color:colors.textMuted,fontSize:10},danger:{color:colors.pink600},version:{color:colors.textMuted,fontSize:10,textAlign:'center',marginTop:18},empty:{alignItems:'center',paddingVertical:70},emptyTitle:{color:colors.text,fontSize:14,fontWeight:'700',marginTop:12},emptyBody:{color:colors.textMuted,fontSize:11,marginTop:4},
  searchHeader:{height:58,flexDirection:'row',alignItems:'center',paddingRight:14,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},searchPageBox:{flex:1,height:40,borderRadius:20,backgroundColor:colors.gray050,flexDirection:'row',alignItems:'center',paddingHorizontal:15},searchResults:{paddingBottom:40},searchResultHead:{height:52,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},searchResultTitle:{color:colors.text,fontSize:14,fontWeight:'800'},searchResultCount:{color:colors.mint700,fontSize:12,fontWeight:'800'},fabGradient:{width:'100%',height:'100%',borderRadius:26,alignItems:'center',justifyContent:'center'},
  continuousRow:{marginTop:-11},avatarSpacer:{width:46},imagePlaceholder:{width:140,height:140,borderRadius:12,backgroundColor:colors.gray100,alignItems:'center',justifyContent:'center'},secretContent:{maxWidth:210},secretLabel:{flexDirection:'row',alignItems:'center',gap:4,marginBottom:7},secretLabelText:{color:colors.pink600,fontSize:9,fontWeight:'700'},systemRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:15,marginBottom:24},systemLine:{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:colors.border},systemContent:{maxWidth:'82%',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:2},systemText:{color:colors.textMuted,fontSize:10,textAlign:'center',lineHeight:16},
  sheetLayer:{...StyleSheet.absoluteFill,zIndex:60,justifyContent:'flex-end'},sheetDim:{...StyleSheet.absoluteFill,backgroundColor:'rgba(20,23,22,.3)'},memberSheet:{backgroundColor:'#FFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10,paddingBottom:28,...shadows.floating},privatePinSheet:{backgroundColor:'#FFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10,paddingBottom:28,...shadows.floating},privatePinTitle:{color:colors.text,fontSize:17,fontWeight:'800',marginBottom:6},privatePinBody:{color:colors.textMuted,fontSize:11,lineHeight:16,marginBottom:16},coHostSheet:{backgroundColor:'#FFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10,paddingBottom:22,...shadows.floating},sheetHandle:{alignSelf:'center',width:38,height:4,borderRadius:2,backgroundColor:colors.gray200,marginBottom:18},sheetProfile:{flexDirection:'row',alignItems:'center',gap:13,paddingBottom:18,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},sheetName:{color:colors.text,fontSize:15,fontWeight:'800'},sheetIntro:{color:colors.textMuted,fontSize:10,marginTop:4},memberActions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-around',paddingTop:20,rowGap:18},memberAction:{width:'25%',alignItems:'center',gap:8},memberActionIcon:{width:52,height:52,borderRadius:26,backgroundColor:colors.mint050,alignItems:'center',justifyContent:'center'},heartAction:{backgroundColor:colors.pink050},memberActionText:{color:colors.textSubtle,fontSize:10,fontWeight:'700'},secretComposer:{paddingTop:18},secretTitle:{color:colors.text,fontSize:12,fontWeight:'800',marginBottom:10},secretInput:{height:88,borderRadius:13,backgroundColor:colors.gray050,borderWidth:1,borderColor:colors.border,padding:13,color:colors.text,fontSize:13,textAlignVertical:'top'},secretSend:{height:46,borderRadius:13,backgroundColor:colors.mint600,alignItems:'center',justifyContent:'center',marginTop:10},coHostToggle:{minHeight:76,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14},coHostToggleTitle:{color:colors.text,fontSize:14,fontWeight:'800'},coHostToggleText:{color:colors.textMuted,fontSize:10,marginTop:5},permissionCheck:{width:24,height:24,borderRadius:8,backgroundColor:colors.gray100,alignItems:'center',justifyContent:'center'},permissionCheckOn:{backgroundColor:colors.mint600},permissionHint:{color:colors.textMuted,fontSize:9,lineHeight:14,marginTop:8},
  rankingList:{paddingBottom:40},rankingIntro:{paddingHorizontal:20,paddingVertical:18,backgroundColor:colors.gray050},rankingIntroTitle:{color:colors.text,fontSize:17,fontWeight:'800'},rankingIntroText:{color:colors.textMuted,fontSize:10,marginTop:5},rankingRow:{height:82,flexDirection:'row',alignItems:'center',paddingHorizontal:16,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},rankNumber:{width:28,color:colors.textMuted,fontSize:14,fontWeight:'800',textAlign:'center',marginRight:8},rankNumberTop:{color:colors.mint700,fontSize:18},rankingBody:{flex:1,marginLeft:12},rankingName:{color:colors.text,fontSize:14,fontWeight:'800'},rankingDesc:{color:colors.textMuted,fontSize:10,marginTop:5},rankingCount:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:colors.mint050,borderRadius:12,paddingHorizontal:9,paddingVertical:6},rankingCountText:{color:colors.mint700,fontSize:10,fontWeight:'800'},topSpaceSheet:{backgroundColor:'#FFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10,paddingBottom:22,...shadows.floating},topSpaceTitleLine:{flexDirection:'row',alignItems:'center',gap:12},topSpaceIcon:{width:50,height:50,borderRadius:25,backgroundColor:colors.mint050,alignItems:'center',justifyContent:'center'},topSpaceTitle:{color:colors.text,fontSize:17,fontWeight:'800'},topSpaceBody:{color:colors.textMuted,fontSize:10,lineHeight:15,marginTop:4},topSpaceStats:{flexDirection:'row',justifyContent:'space-around',backgroundColor:colors.gray050,borderRadius:15,paddingVertical:13,marginTop:16},topSpaceStatLabel:{color:colors.textMuted,fontSize:9,textAlign:'center'},topSpaceStatValue:{color:colors.text,fontSize:14,fontWeight:'800',textAlign:'center',marginTop:5},packageLabel:{color:colors.text,fontSize:11,fontWeight:'800',marginTop:17,marginBottom:9},packageGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:8},packageOption:{width:'24%',minHeight:54,borderRadius:12,backgroundColor:colors.gray050,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},packageOptionActive:{backgroundColor:colors.mint050,borderColor:colors.mint600},packagePoints:{color:colors.textSubtle,fontSize:11,fontWeight:'800'},packageDuration:{color:colors.textMuted,fontSize:9,marginTop:4},packageTextActive:{color:colors.mint700},topSpaceResult:{color:colors.mint700,fontSize:10,fontWeight:'700',textAlign:'center',marginTop:11},topSpaceError:{color:colors.pink600},topSpaceButton:{height:48,borderRadius:14,overflow:'hidden',marginTop:13},topSpaceButtonGradient:{flex:1,alignItems:'center',justifyContent:'center'},
  uploadImage:{width:'100%',height:'100%',borderRadius:18,resizeMode:'cover'},
  uploadRound:{width:108,height:108,borderRadius:54,alignSelf:'center',alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderWidth:1,borderColor:colors.border,overflow:'hidden',marginBottom:10,...shadows.tiny},
  uploadRoundImage:{width:'100%',height:'100%',resizeMode:'cover'},
  detailMemberGrid:{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:14,paddingBottom:26},detailMemberItem:{width:'33.333%',alignItems:'center',paddingVertical:12},detailMemberAvatar:{position:'relative'},detailMemberNameLine:{minHeight:22,justifyContent:'center'},unreadMarker:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:14,maxWidth:'100%'},unreadLine:{flex:1,height:1,backgroundColor:'#D7DDD9'},unreadText:{color:colors.textMuted,fontSize:10,fontWeight:'400'},
  storyAuthor:{flexDirection:'row',alignItems:'center',gap:14},storyAuthorName:{color:colors.text,fontSize:12,fontWeight:'800'},storyComment:{flexDirection:'row',gap:9,backgroundColor:colors.gray050,borderRadius:13,padding:11,marginTop:14},storyCommentName:{color:colors.text,fontSize:10,fontWeight:'800',marginRight:4},storyCommentTime:{color:colors.textMuted,fontSize:10,fontWeight:'400'},storyCommentBody:{color:colors.textSubtle,fontSize:14,lineHeight:21,marginTop:4},storyFab:{position:'absolute',right:20,bottom:22,width:52,height:52,borderRadius:26,...shadows.floating},memberManage:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  storyChatButton:{position:'absolute',left:20,right:84,bottom:22,height:52,borderRadius:16,backgroundColor:colors.mint600,alignItems:'center',justifyContent:'center',...shadows.floating},
  storyDetailHeader:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:8},storyDetailHeaderTitle:{color:'#FFF',fontSize:16,fontWeight:'700'},storyHeaderRight:{minWidth:44,flexDirection:'row',justifyContent:'flex-end'},storyHeaderAction:{width:44,height:44,alignItems:'center',justifyContent:'center'},storyMenuLayer:{...StyleSheet.absoluteFill,zIndex:70},storyHeaderMenu:{position:'absolute',top:58,right:12,zIndex:40},storyHeaderMenuList:{minWidth:144,backgroundColor:'#FFF',borderRadius:16,paddingVertical:6,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.floating},storyHeaderMenuRow:{minHeight:42,justifyContent:'center',paddingHorizontal:14},storyHeaderMenuText:{color:colors.text,fontSize:12,fontWeight:'500'},storyDetail:{padding:20,paddingBottom:100},storyDetailTitle:{color:colors.text,fontSize:19,fontWeight:'700',lineHeight:25,marginBottom:24},storyLinkedRoom:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#FFF',borderRadius:15,padding:11,marginTop:18,marginBottom:24},storyLinkedLabel:{color:colors.textMuted,fontSize:8},storyLinkedName:{color:colors.textSubtle,fontSize:10,fontWeight:'400',marginTop:2},storyDetailText:{color:colors.text,fontSize:15,lineHeight:25,marginTop:18,marginBottom:18},storyDetailImage:{width:'100%',height:260,borderRadius:16,backgroundColor:colors.gray100,marginBottom:20},commentSection:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,paddingTop:20,marginTop:12},commentCount:{color:colors.text,fontSize:14,fontWeight:'800',marginBottom:8},commentMetaLine:{flexDirection:'row',alignItems:'center',gap:18},storyDetailComment:{flexDirection:'row',gap:12,paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},commentComposer:{minHeight:66,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,paddingVertical:10,backgroundColor:'#FFF',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},commentInput:{flex:1,height:44,borderRadius:22,backgroundColor:colors.gray050,paddingHorizontal:16,color:colors.text,fontSize:13},commentSend:{width:42,height:42,borderRadius:21,backgroundColor:colors.mint600,alignItems:'center',justifyContent:'center'},
  storyEditor:{padding:20,paddingBottom:60},storyTitleInput:{height:50,borderBottomWidth:1,borderBottomColor:colors.border,color:colors.text,fontSize:19,fontWeight:'800',marginBottom:18},storyEditorVisibility:{flexDirection:'row',gap:8,marginTop:18,marginBottom:12},storyBlockInput:{minHeight:180,color:colors.text,fontSize:15,lineHeight:24,textAlignVertical:'top',paddingVertical:18},storyEditorImageWrap:{position:'relative',marginVertical:10},storyEditorImage:{width:'100%',height:250,borderRadius:15,backgroundColor:colors.gray100},storyImageRemove:{position:'absolute',right:10,top:10,width:30,height:30,borderRadius:15,backgroundColor:'rgba(0,0,0,.5)',alignItems:'center',justifyContent:'center'},storyInsertRow:{flexDirection:'row',gap:9,marginVertical:18},storyInsert:{flex:1,height:48,borderRadius:13,backgroundColor:colors.mint050,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},storyInsertText:{color:colors.mint700,fontSize:12,fontWeight:'700'},storyEditorToolbar:{height:54,flexDirection:'row',alignItems:'center',gap:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border,marginTop:16},storyToolbarButton:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray050},storyEditorCancel:{height:38,paddingHorizontal:13,alignItems:'center',justifyContent:'center'},storyEditorCancelText:{color:colors.textMuted,fontSize:12,fontWeight:'700'},storyEditorSubmit:{height:38,borderRadius:12,backgroundColor:colors.mint600,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
  memberProfilePage:{alignItems:'center',padding:28},memberProfileNameLine:{flexDirection:'row',alignItems:'center',gap:8,marginTop:15},memberProfileName:{color:colors.text,fontSize:20,fontWeight:'800'},memberProfileRoom:{color:colors.textMuted,fontSize:10,marginTop:7},memberProfileCard:{alignSelf:'stretch',backgroundColor:'#FFF',borderRadius:18,padding:18,marginTop:26,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},memberProfileLabel:{color:colors.textMuted,fontSize:10,fontWeight:'700'},memberProfileIntro:{color:colors.text,fontSize:13,lineHeight:20,marginTop:9},
  overviewPage:{paddingBottom:40},overviewIntro:{padding:20,backgroundColor:'#FFF'},overviewSection:{color:colors.text,fontSize:16,fontWeight:'800',paddingHorizontal:20,paddingTop:22,paddingBottom:10},overviewStory:{backgroundColor:'#FFF',borderRadius:17,padding:16,marginHorizontal:16,marginBottom:10,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border},
  requestList:{padding:16},requestCard:{flexDirection:'row',backgroundColor:'#FFF',borderRadius:18,padding:16,marginBottom:11,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},requestBody:{flex:1,marginLeft:13},requestActions:{flexDirection:'row',gap:8,marginTop:13},rejectButton:{flex:1,height:40,borderRadius:11,backgroundColor:colors.gray100,alignItems:'center',justifyContent:'center'},rejectText:{color:colors.textSubtle,fontSize:12,fontWeight:'700'},approveButton:{flex:1,height:40,borderRadius:11,backgroundColor:colors.mint600,alignItems:'center',justifyContent:'center'},requestResult:{color:colors.mint700,fontSize:11,fontWeight:'700',marginTop:12},requestRejected:{color:colors.pink600},
  fieldHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},fieldCounter:{color:colors.textMuted,fontSize:10},radioList:{backgroundColor:'#FFF',borderRadius:15,borderWidth:1,borderColor:colors.border,overflow:'hidden'},radioRow:{height:48,flexDirection:'row',alignItems:'center',paddingHorizontal:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},radioDisabled:{backgroundColor:colors.gray050},radioCircle:{width:20,height:20,borderRadius:10,borderWidth:1.5,borderColor:colors.gray300,alignItems:'center',justifyContent:'center'},radioCircleActive:{borderColor:colors.mint600},radioDot:{width:10,height:10,borderRadius:5,backgroundColor:colors.mint600},radioText:{color:colors.text,fontSize:12,fontWeight:'600',marginLeft:10},radioTextDisabled:{color:colors.textMuted},radioReason:{marginLeft:'auto',color:colors.textMuted,fontSize:9},stepper:{height:50,flexDirection:'row',alignItems:'center',alignSelf:'flex-start',backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:colors.border,overflow:'hidden'},stepperButton:{width:48,height:50,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray050},stepperInput:{width:54,height:50,textAlign:'right',color:colors.text,fontSize:16,fontWeight:'800',paddingHorizontal:4},stepperUnit:{color:colors.textSubtle,fontSize:12,paddingRight:8},capacityHint:{color:colors.textMuted,fontSize:9,marginTop:7},
  capacityLine:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},
  capacityHintInline:{color:colors.textMuted,fontSize:11},
  deleteRoomLink:{alignSelf:'flex-end',marginTop:20,marginRight:10,padding:8},deleteRoomText:{color:colors.mint700,fontSize:10,fontWeight:'700',textDecorationLine:'underline'},drawerNoticeRead:{backgroundColor:colors.gray050},notifIconRead:{backgroundColor:colors.gray100},notifTitleRead:{color:colors.textMuted},confirmLayer:{...StyleSheet.absoluteFill,backgroundColor:'rgba(20,23,22,.24)',alignItems:'center',justifyContent:'center',padding:24},confirmCard:{width:'100%',backgroundColor:'#FFF',borderRadius:20,padding:20,...shadows.floating},confirmTitle:{color:colors.text,fontSize:15,fontWeight:'800',textAlign:'center'},confirmActions:{flexDirection:'row',gap:9,marginTop:20},confirmCancel:{flex:1,height:44,borderRadius:12,backgroundColor:colors.gray100,alignItems:'center',justifyContent:'center'},confirmCancelText:{color:colors.textSubtle,fontSize:12,fontWeight:'700'},confirmAccept:{flex:1,height:44,borderRadius:12,overflow:'hidden'},confirmAcceptGradient:{flex:1,alignItems:'center',justifyContent:'center'},
  toast:{position:'absolute',left:24,right:24,bottom:90,minHeight:44,borderRadius:14,backgroundColor:'rgba(35,39,37,.9)',alignItems:'center',justifyContent:'center',paddingHorizontal:16,zIndex:80,...shadows.floating},toastText:{color:'#FFF',fontSize:11,fontWeight:'700',textAlign:'center'},photoViewer:{...StyleSheet.absoluteFill,zIndex:80,alignItems:'center',justifyContent:'center'},photoViewerDim:{...StyleSheet.absoluteFill,backgroundColor:'rgba(15,17,16,.82)'},photoViewerImage:{width:280,height:280,borderRadius:22,resizeMode:'cover'},photoViewerClose:{position:'absolute',right:22,top:22,width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center'},
  photoViewerExpandedImage:{width:'100%',height:'100%'},
  photoViewerCloseLeft:{position:'absolute',left:18,top:56,width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center'},
  photoViewerMore:{position:'absolute',right:18,top:56,width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center'},
  photoViewerMenu:{position:'absolute',right:18,top:106,minWidth:132,backgroundColor:'#FFF',borderRadius:16,paddingVertical:6,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.floating},
  photoViewerMenuItem:{minHeight:42,justifyContent:'center',paddingHorizontal:14},
  photoViewerMenuText:{color:colors.text,fontSize:12,fontWeight:'500'},
  joinSubmitStatus:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:20},joinSubmitStatusText:{color:colors.textMuted,fontSize:11},joinSubmitError:{color:colors.pink600,fontSize:11,lineHeight:17,textAlign:'center',marginTop:18},joinSuccessToast:{position:'absolute',left:20,right:20,bottom:92,minHeight:52,borderRadius:16,backgroundColor:'rgba(35,39,37,.94)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:16,zIndex:200,elevation:20,...shadows.floating},
  profileMenuGroup:{backgroundColor:'#FFF',borderRadius:18,paddingHorizontal:14,marginTop:14,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border},profileMenu:{minHeight:55,flexDirection:'row',alignItems:'center',gap:11},menuTrailing:{marginLeft:'auto',alignSelf:'stretch',minWidth:44,alignItems:'flex-end',justifyContent:'center'},
  defaultRoomImage:{backgroundColor:'#E9ECEA',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border},
  adultBlurMask:{...StyleSheet.absoluteFill,backgroundColor:'rgba(255,255,255,.38)'},
  defaultRoomLogo:{opacity:.38},
  defaultCoverLogo:{backgroundColor:'#ECEFED'},
  defaultCoverLogoImage:{width:110,height:82,opacity:.36},
  storyLinkedRoomInline:{maxWidth:118,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,borderRadius:13,paddingHorizontal:7,paddingVertical:6},
  storyLinkedText:{flex:1,minWidth:0},
  storyInlineHeart:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:colors.gray050},
  storyChatPreview:{alignSelf:'flex-start',maxWidth:'78%',backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,borderRadius:16,padding:13,marginBottom:16,...shadows.tiny},
  storyChatPreviewMine:{alignSelf:'flex-end'},
  storyBubble:{minWidth:210},
  storyChatPreviewHead:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8},
  storyChatPreviewLabel:{flex:1,color:colors.mint700,fontSize:10,fontWeight:'800'},
  storyChatPreviewTitle:{color:colors.text,fontSize:13,fontWeight:'800'},
  storyChatPreviewBody:{color:colors.textSubtle,fontSize:11,lineHeight:17,marginTop:5},
  storyChatPreviewMore:{alignSelf:'flex-end',color:colors.textMuted,fontSize:10,fontWeight:'700',marginTop:8},
  pointLogOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:120,backgroundColor:'#FFF'},
  pointLogPage:{flex:1,backgroundColor:'#FFF'},
  pointLogDate:{color:colors.textSubtle,fontSize:15,paddingHorizontal:20,paddingTop:22,paddingBottom:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  pointLogRow:{minHeight:62,flexDirection:'row',alignItems:'center',paddingHorizontal:20,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  pointLogTime:{width:64,color:colors.textSubtle,fontSize:16},
  pointLogTitle:{flex:1,color:colors.text,fontSize:15},
  pointLogAmount:{minWidth:72,textAlign:'right',fontSize:16,fontWeight:'500'},
  pointLogPlus:{color:'#1C1C1C'},
  pointLogMinus:{color:colors.pink600},
  pointLogBalance:{width:58,color:colors.textSubtle,fontSize:15,textAlign:'right'},
  chargeLayer:{...StyleSheet.absoluteFill,zIndex:90,alignItems:'center',justifyContent:'center'},
  chargeDim:{...StyleSheet.absoluteFill,backgroundColor:'rgba(0,0,0,.48)'},
  chargeModal:{width:'80%',maxWidth:360,borderRadius:28,backgroundColor:'#FFF',paddingHorizontal:28,paddingTop:28,paddingBottom:22},
  chargeTitle:{color:colors.text,fontSize:20,fontWeight:'600',marginBottom:18},
  chargeOption:{height:86,flexDirection:'row',alignItems:'center',gap:24},
  chargeRadio:{width:24,height:24,borderRadius:12,borderWidth:3,borderColor:colors.textSubtle},
  chargeRadioOn:{borderColor:colors.mint700,backgroundColor:colors.mint050},
  chargePoint:{color:colors.text,fontSize:17},
  chargeWon:{color:colors.textSubtle,fontSize:13,marginTop:4},
  chargeActions:{flexDirection:'row',justifyContent:'flex-end',gap:38,marginTop:24},
  chargeAction:{height:40,justifyContent:'center'},
  chargeCancel:{color:colors.textSubtle,fontSize:14},
  chargeBuy:{color:colors.mint700,fontSize:14},
  chargeBuyActive:{color:colors.mint700},
  accessSave:{height:48,borderRadius:14,overflow:'hidden',marginTop:8},
  accessSaveGradient:{flex:1,alignItems:'center',justifyContent:'center'},
  profileActionMenu:{position:'absolute',top:58,right:12,zIndex:50},
  profileActionList:{minWidth:168,backgroundColor:'#FFF',borderRadius:16,paddingVertical:6,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.floating},
  profileActionRow:{minHeight:42,justifyContent:'center',paddingHorizontal:14},
  profileActionText:{color:colors.text,fontSize:12,fontWeight:'500'},
  roomDetailMenu:{position:'absolute',top:58,right:12,zIndex:50},
  roomDetailTags:{marginTop:12,marginBottom:6,lineHeight:19},
  customColorDot:{backgroundColor:'#FFF',borderStyle:'dashed',borderColor:colors.gray300},
  pinFieldWrap:{marginTop:16},
  regionFieldWrap:{marginTop:16},
  customColorSheet:{marginHorizontal:18,maxHeight:'86%',borderRadius:24,backgroundColor:'#FFF',padding:18,...shadows.floating},
  customColorTitle:{color:colors.text,fontSize:17,fontWeight:'800',textAlign:'center',marginBottom:14},
  customPickerRoot:{gap:16},
  customPickerTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16},
  customPickerWheel:{width:230,height:230},
  customPickerPreviewBar:{width:56,height:230,borderRadius:12,borderWidth:1,borderColor:colors.border},
  customPickerSlider:{borderRadius:999,height:18},
  customInputWidget:{marginTop:4},
  customInput:{height:44,borderRadius:10,borderWidth:1,borderColor:colors.border,backgroundColor:'#FFF',paddingHorizontal:12,color:colors.text,fontSize:14},
  customInputTitle:{color:colors.textSubtle,fontSize:11,fontWeight:'500'},
  customColorActions:{flexDirection:'row',gap:10,marginTop:18},
  memberProfileAvatarLarge:{width:96,height:96,borderRadius:48},
  memberProfileEditCard:{alignSelf:'stretch',gap:12,backgroundColor:'#FFF',borderRadius:18,padding:18,marginTop:24,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.border,...shadows.tiny},
  newMessagePreview:{position:'absolute',left:22,right:22,bottom:126,minHeight:38,borderRadius:19,backgroundColor:'rgba(35,39,37,.92)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:14,zIndex:30,...shadows.floating},
  newMessagePreviewText:{flex:1,color:'#FFF',fontSize:12,fontWeight:'700',textAlign:'center'},
  roomRowTop:{backgroundColor:'#F4FBF7'},
  topInlineLabel:{position:'absolute',left:14,top:8,color:colors.mint700,fontSize:10,fontWeight:'600'},
  edgeBackLayer:{position:'absolute',left:0,top:0,bottom:0,width:32,zIndex:120},
});
