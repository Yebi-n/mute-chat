import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { initializeAds } from '../services/monetization.native';

export type BannerPlacement = 'main' | 'chat' | 'story';

const IOS_DEFAULT_BANNER_ID = 'ca-app-pub-4013454985021474/9051959127';
const ANDROID_DEFAULT_BANNER_ID = 'ca-app-pub-4013454985021474/4135765674';

function configuredUnitId(placement: BannerPlacement) {
  if (Platform.OS === 'ios') {
    if (placement === 'chat')
      return process.env.EXPO_PUBLIC_ADMOB_BANNER_CHAT_IOS_ID
        || process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_IOS_ID
        || IOS_DEFAULT_BANNER_ID;
    if (placement === 'story')
      return process.env.EXPO_PUBLIC_ADMOB_BANNER_STORY_IOS_ID
        || process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_IOS_ID
        || IOS_DEFAULT_BANNER_ID;
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_IOS_ID
      || IOS_DEFAULT_BANNER_ID;
  }
  if (placement === 'chat')
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_CHAT_ANDROID_ID
      || process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID
      || ANDROID_DEFAULT_BANNER_ID;
  if (placement === 'story')
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_STORY_ANDROID_ID
      || process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID
      || ANDROID_DEFAULT_BANNER_ID;
  return process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID
    || ANDROID_DEFAULT_BANNER_ID;
}

export default function InlineBannerAd({
  placement,
  disabled = false,
  dark = false,
  reserveSpace = false,
}: {
  placement: BannerPlacement;
  disabled?: boolean;
  dark?: boolean;
  reserveSpace?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [sdkReady, setSdkReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true';
  const configured = configuredUnitId(placement);
  const unitId = useTestAds ? TestIds.ADAPTIVE_BANNER : configured;
  const size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  const compact = placement === 'chat' || placement === 'story';
  const maxHeight = compact ? 40 : 58;
  const adWidth = Math.max(320, Math.floor(width));
  const containerStyle = useMemo(
    () => [
      styles.container,
      compact ? styles.compact : styles.anchored,
      dark && styles.dark,
      !loaded && !reserveSpace && styles.loading,
    ],
    [dark, loaded, placement],
  );

  useEffect(() => {
    if (disabled || !unitId) return;
    let active = true;
    setFailed(false);
    initializeAds()
      .then((ready) => {
        if (active) setSdkReady(ready);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [disabled, unitId]);

  if (disabled || !unitId) return null;
  if (failed || !sdkReady) {
    return reserveSpace ? <View pointerEvents="none" style={containerStyle} /> : null;
  }
  return (
    <View pointerEvents="box-none" style={containerStyle}>
      <BannerAd
        key={`${unitId}-${size}-${retryNonce}`}
        unitId={unitId}
        size={size}
        width={adWidth}
        maxHeight={maxHeight}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onAdFailedToLoad={() => {
          setLoaded(false);
          if (retryNonce < 2) {
            setTimeout(() => setRetryNonce((value) => value + 1), 1200);
            return;
          }
          if (__DEV__) console.warn('Banner ad failed', { placement, unitId });
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  anchored: {
    borderTopColor: '#E5E5E5',
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 58,
    minHeight: 58,
    maxHeight: 58,
    backgroundColor: '#FFF',
  },
  compact: {
    height: 40,
    minHeight: 40,
    maxHeight: 40,
    borderBottomColor: '#E8E8E8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFF',
  },
  dark: {
    borderBottomColor: '#343434',
    borderTopColor: '#343434',
  },
  loading: {
    opacity: 0,
  },
});
