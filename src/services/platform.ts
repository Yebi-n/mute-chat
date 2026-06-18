export type RewardReason = 'theme' | 'bubble_color' | 'room_promotion';

export type PointLedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export interface AuthService {
  requestPhoneVerification(phoneNumber: string): Promise<{ verificationId: string }>;
  confirmPhoneVerification(verificationId: string, code: string): Promise<{ userId: string }>;
}

export interface ChatService {
  subscribeToRecentMessages(
    roomId: string,
    onMessages: (messages: unknown[]) => void,
  ): () => void;
  sendMessage(roomId: string, text: string): Promise<void>;
}

export interface MediaService {
  pickAndCropImage(source: 'camera' | 'gallery'): Promise<{ uri: string }>;
  compressForUpload(uri: string): Promise<{ uri: string; width: number; height: number }>;
}

export interface MonetizationService {
  showRewardedAd(reason: RewardReason): Promise<{ completed: boolean; rewardToken?: string }>;
  purchase(productId: string): Promise<{ receipt: string }>;
  verifyAndCredit(input: { rewardToken?: string; receipt?: string }): Promise<PointLedgerEntry>;
}

export interface NotificationService {
  registerDevice(): Promise<{ pushToken: string }>;
  setGlobalEnabled(enabled: boolean): Promise<void>;
  setRoomEnabled(roomId: string, enabled: boolean): Promise<void>;
}

export type PlatformServices = {
  auth: AuthService;
  chat: ChatService;
  media: MediaService;
  monetization: MonetizationService;
  notifications: NotificationService;
};
