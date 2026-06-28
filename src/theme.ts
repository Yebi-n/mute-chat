import { Platform, ViewStyle } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F3F3',
  white: '#FFFFFF',
  border: '#E7E7E7',
  text: '#1C1C1C',
  textSubtle: '#5D5D5D',
  textMuted: '#8E8E8E',
  gray050: '#F7F7F7',
  gray100: '#F1F1F1',
  gray200: '#DADADA',
  gray300: '#BDBDBD',
  mint050: '#EFF9F5',
  mint300: '#9ED8BF',
  mint600: '#5DBB8C',
  mint700: '#3F9A70',
  mint800: '#2E7654',
  green050: '#EFF9F5',
  green100: '#DDF2E7',
  green300: '#9ED8BF',
  green600: '#5DBB8C',
  green700: '#3F9A70',
  green800: '#2E7654',
  pink050: '#FFF2F5',
  pink100: '#FCE1E8',
  pink600: '#D74E70',
  pink700: '#BD4C68',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 13,
  lg: 18,
  xl: 24,
  xxl: 30,
} as const;

const shadow = (ios: ViewStyle, elevation: number): ViewStyle =>
  Platform.select({ ios, android: { elevation } }) ?? {};

export const shadows = {
  tiny: shadow(
    { shadowColor: '#5F6461', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    1,
  ),
  soft: shadow(
    { shadowColor: '#5F6461', shadowOpacity: 0.09, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
    3,
  ),
  card: shadow(
    { shadowColor: '#5F6461', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
    3,
  ),
  floating: shadow(
    { shadowColor: '#4B4F4D', shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
    7,
  ),
  nav: shadow(
    { shadowColor: '#4C4C4C', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
    6,
  ),
  insetLike: shadow(
    { shadowColor: '#5F6461', shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } },
    1,
  ),
} as const;
