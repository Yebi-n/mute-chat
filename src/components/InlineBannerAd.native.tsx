import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

export type BannerPlacement = 'main' | 'chat' | 'story';

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
  const containerStyle = useMemo(
    () => [
      styles.container,
      placement === 'story' ? styles.story : styles.anchored,
      dark && styles.dark,
      styles.loading,
    ],
    [dark, placement],
  );

  if (disabled) {
    return reserveSpace ? <View pointerEvents="none" style={containerStyle} /> : null;
  }

  // Keep the layout reservation, but do not mount the native AdMob view during
  // startup. Recent TestFlight builds crash in the native module bridge shortly
  // after launch; isolating the native ad view keeps the app usable while the
  // AdMob configuration is reintroduced behind a safer gate.
  return <View pointerEvents="none" style={containerStyle} />;
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
