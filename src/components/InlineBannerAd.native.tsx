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
      || process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID;
  if (placement === 'story')
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_STORY_ANDROID_ID
      || process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID;
  return process.env.EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID;
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
  const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true';
  const configured = configuredUnitId(placement);
  const unitId = useTestAds ? TestIds.ADAPTIVE_BANNER : configured;
  const size = placement === 'story'
    ? BannerAdSize.INLINE_ADAPTIVE_BANNER
    : placement === 'chat'
      ? BannerAdSize.BANNER
      : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  const maxHeight = placement === 'story' ? 64 : placement === 'chat' ? 50 : 58;
  const adWidth = Math.max(320, Math.floor(width));
  const containerStyle = useMemo(
    () => [
      styles.container,
      placement === 'story' ? styles.story : styles.anchored,
      dark && styles.dark,
      !loaded && styles.loading,
    ],
    [dark, loaded, placement],
  );

  useEffect(() => {
    if (disabled || !unitId) return;
    let active = true;
    const timer = setTimeout(() => {
      initializeAds()
        .then((ready) => {
          if (active) setSdkReady(ready);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [disabled, unitId]);

  if (disabled || !unitId || failed) {
    return reserveSpace ? <View pointerEvents="none" style={containerStyle} /> : null;
  }
  if (!sdkReady) {
    return <View pointerEvents="none" style={containerStyle} />;
  }
  return (
    <View pointerEvents="box-none" style={containerStyle}>
      <BannerAd
        unitId={unitId}
        size={size}
        width={adWidth}
        maxHeight={maxHeight}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setFailed(true)}
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
    height: 50,
    minHeight: 50,
    maxHeight: 50,
  },
  story: {
    borderBottomColor: '#E8E8E8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 4,
    minHeight: 56,
    paddingVertical: 2,
  },
  dark: {
    borderBottomColor: '#343434',
    borderTopColor: '#343434',
  },
  loading: {
    opacity: 0,
  },
});
